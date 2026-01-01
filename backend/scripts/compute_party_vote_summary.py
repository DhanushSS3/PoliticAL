#!/usr/bin/env python3
"""
Party Vote Summary Computation Script

Computes party-level vote totals and vote share percentages per constituency per election.

SCOPE:
- Aggregates ElectionResultRaw entries by Party and GeoUnit
- Calculates Vote Share % per constituency (excluding NOTA from total)
- Seeds PartyVoteSummary table (linked to GeoElectionSummary)
- Idempotent: UPSERT logic (Check -> Insert/Update)

REQUIREMENTS:
- DATABASE_URL environment variable
- Election, Party, ElectionResultRaw, GeoElectionSummary tables populated
"""

import os
import sys
import logging
from collections import defaultdict
from typing import Dict, List, Set, Tuple

import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)


class PartyVoteAggregator:
    
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.conn = None
        
        # Caches
        self.party_map: Dict[int, str] = {}      # id -> name
        self.nota_ids: Set[int] = set()         # IDs of NOTA party
        self.elections: List[Tuple[int, int]] = [] # list of (id, year)
        
    def connect_db(self) -> None:
        try:
            self.conn = psycopg2.connect(self.db_url)
            logger.info("[OK] Connected to PostgreSQL database")
        except Exception as e:
            logger.error(f"[ERROR] Database connection failed: {e}")
            sys.exit(1)
    
    def close_db(self) -> None:
        if self.conn:
            self.conn.close()
            logger.info("Database connection closed")
            
    def load_metadata(self) -> None:
        """Load Party and Election metadata."""
        cursor = self.conn.cursor()
        try:
            # Load Parties
            cursor.execute('SELECT id, name FROM "Party"')
            for pid, name in cursor.fetchall():
                normalized = name.strip()
                self.party_map[pid] = normalized
                if normalized.upper() == 'NOTA':
                    self.nota_ids.add(pid)
            
            logger.info(f"[OK] Cached {len(self.party_map)} parties (NOTA IDs: {self.nota_ids})")
            
            # Load Elections
            cursor.execute('SELECT id, year FROM "Election" ORDER BY year')
            self.elections = cursor.fetchall()
            logger.info(f"[OK] Cached {len(self.elections)} elections")
            
        except Exception as e:
            logger.error(f"[ERROR] Failed to load metadata: {e}")
            sys.exit(1)
        finally:
            cursor.close()

    def process_elections(self) -> None:
        cursor = self.conn.cursor()
        
        grand_totals = {
            'processed': 0,
            'created': 0,
            'updated': 0
        }
        
        try:
            for election_id, year in self.elections:
                logger.info(f"Processing Election: Karnataka Assembly {year} (ID: {election_id})...")
                
                # 1. Fetch GeoElectionSummary Mapping (geoUnitId -> summaryId)
                # We need this to link PartyVoteSummary to the correct parent Record
                geo_summary_map = {} # geoUnitId -> summaryId
                cursor.execute(
                    'SELECT "geoUnitId", id FROM "GeoElectionSummary" WHERE "electionId" = %s',
                    (election_id,)
                )
                for gu_id, summary_id in cursor.fetchall():
                    geo_summary_map[gu_id] = summary_id
                
                if not geo_summary_map:
                    logger.warning(f"  [WARN] No GeoElectionSummaries found for election {year}. skipping.")
                    continue

                # 2. Fetch Existing PartyVoteSummary Keys logic for Idempotency
                # Map (summaryId, partyId) -> table_id (primary key)
                existing_records = {} # (summaryId, partyId) -> id
                cursor.execute(
                    '''
                    SELECT pv.id, pv."geoElectionSummaryId", pv."partyId"
                    FROM "PartyVoteSummary" pv
                    JOIN "GeoElectionSummary" ges ON pv."geoElectionSummaryId" = ges.id
                    WHERE ges."electionId" = %s
                    ''',
                    (election_id,)
                )
                for row_id, sum_id, party_id in cursor.fetchall():
                    existing_records[(sum_id, party_id)] = row_id

                # 3. Fetch Aggregate Result Data
                # Group by geoUnitId, partyId
                constituency_data = defaultdict(lambda: defaultdict(int)) # geoUnitId -> partyId -> votes
                state_party_votes = defaultdict(int) # partyId -> total_state_votes
                
                cursor.execute(
                    '''
                    SELECT "geoUnitId", "partyId", "votesTotal"
                    FROM "ElectionResultRaw"
                    WHERE "electionId" = %s
                    ''',
                    (election_id,)
                )
                
                raw_rows = cursor.fetchall()
                if not raw_rows:
                    logger.warning(f"  [WARN] No raw results found for election {year}")
                    continue
                    
                for gu_id, p_id, votes in raw_rows:
                    if votes is None:
                        logger.warning(f"  [WARN] Found result with NULL votes. Skipping row.")
                        continue
                    if votes < 0:
                        logger.warning(f"  [WARN] Found negative votes {votes}. Skipping row.")
                        continue
                        
                    constituency_data[gu_id][p_id] += votes
                    state_party_votes[p_id] += votes

                # 4. Check State Level Validity
                # Total votes excluding NOTA
                state_valid_votes = sum(
                    votes for pid, votes in state_party_votes.items() 
                    if pid not in self.nota_ids
                )
                
                if state_valid_votes == 0:
                    logger.error(f"  [ERROR] Total valid votes for election {year} is 0. Skipping election.")
                    continue
                
                logger.info(f"  Total Valid Votes (Excl NOTA): {state_valid_votes:,}")
                logger.info(f"  Parties Processed: {len(state_party_votes)}")

                # 5. Compute Constituency Shares and Prepare Upserts
                insert_batch = []
                update_batch = []
                
                for gu_id, party_counts in constituency_data.items():
                    # Resolve Summary ID
                    summary_id = geo_summary_map.get(gu_id)
                    if not summary_id:
                        # This happens if GeoElectionSummary missing for a geoUnit found in results
                        # Log specific warning only if verbose, else skip silently to avoid spam
                        continue
                    
                    # Compute Constituency Total Valid (Denominator)
                    const_total_valid = sum(
                        votes for pid, votes in party_counts.items()
                        if pid not in self.nota_ids
                    )
                    
                    for party_id, votes in party_counts.items():
                        is_nota = party_id in self.nota_ids
                        
                        share_pct = 0.0
                        if is_nota:
                            share_pct = 0.0
                        else:
                            if const_total_valid > 0:
                                share_pct = round((votes / const_total_valid) * 100, 2)
                            else:
                                share_pct = 0.0
                        
                        # Idempotency Check
                        key = (summary_id, party_id)
                        if key in existing_records:
                            row_id = existing_records[key]
                            # (id, count, pct)
                            update_batch.append((row_id, votes, share_pct))
                        else:
                            # (summary_id, party_id, count, pct)
                            insert_batch.append((summary_id, party_id, votes, share_pct))
                
                # 6. Execute Database Writes
                if insert_batch:
                    execute_values(
                        cursor,
                        '''
                        INSERT INTO "PartyVoteSummary" 
                        ("geoElectionSummaryId", "partyId", "voteCount", "voteSharePercent")
                        VALUES %s
                        ''',
                        insert_batch
                    )
                    grand_totals['created'] += len(insert_batch)
                
                if update_batch:
                    # Batch Update using FROM VALUES logic
                    execute_values(
                        cursor,
                        '''
                        UPDATE "PartyVoteSummary" AS t
                        SET "voteCount" = v.count,
                            "voteSharePercent" = v.pct
                        FROM (VALUES %s) AS v(id, count, pct)
                        WHERE t.id = v.id
                        ''',
                        update_batch
                    )
                    grand_totals['updated'] += len(update_batch)
                
                self.conn.commit()
                grand_totals['processed'] += 1
                
                # 7. Log Top 5 Parties (State Share)
                # Temporary state share calc for logging
                if state_valid_votes > 0:
                    sorted_parties = sorted(
                        [
                            (pid, votes, (votes/state_valid_votes)*100) 
                            for pid, votes in state_party_votes.items() 
                            if pid not in self.nota_ids
                        ],
                        key=lambda x: x[1],
                        reverse=True
                    )
                    
                    logger.info("  Top 5 Parties by Vote Share:")
                    for pid, votes, share in sorted_parties[:5]:
                        pname = self.party_map.get(pid, f"Unknown-{pid}")
                        logger.info(f"    - {pname}: {share:.2f}% ({votes:,})")
                        
            # Final Summary
            logger.info("="*60)
            logger.info("Party Vote Summary Completed")
            logger.info(f"Elections processed: {grand_totals['processed']}")
            logger.info(f"Records created: {grand_totals['created']}")
            logger.info(f"Records updated: {grand_totals['updated']}")
            logger.info("="*60)
            
        except Exception as e:
            self.conn.rollback()
            logger.error(f"[ERROR] Script execution failed: {e}")
            sys.exit(1)
        finally:
            cursor.close()

    def run(self) -> None:
        try:
            self.connect_db()
            self.load_metadata()
            self.process_elections()
        finally:
            self.close_db()


if __name__ == '__main__':
    # Ensure DATABASE_URL is set
    if not os.getenv('DATABASE_URL'):
        # Fallback or error
        # Assuming .env loaded correctly, but just in case
        pass
        
    db_url = os.getenv('DATABASE_URL_PG') or os.getenv('DATABASE_URL')
    if not db_url:
        print("[ERROR] DATABASE_URL not found. Please check .env file.")
        sys.exit(1)
        
    aggregator = PartyVoteAggregator(db_url)
    aggregator.run()
