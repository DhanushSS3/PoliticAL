#!/usr/bin/env python3
"""
Constituency Margin Computation Script

Computes winning margin and runner-up statistics for each constituency-election pair.
Derived from PartyVoteSummary and GeoElectionSummary.

SCOPE:
- Determines Winner and Runner-up (Excluding NOTA)
- Calculates Margin (Votes and %)
- Seeds ConstituencyMarginSummary table
- Idempotent: UPSERT logic

REQUIREMENTS:
- DATABASE_URL environment variable
- GeoElectionSummary, PartyVoteSummary populated
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


class MarginComputer:
    
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.conn = None
        
        self.nota_ids: Set[int] = set()
        self.geo_unit_names: Dict[int, str] = {} # id -> name (for logging)
        
    def connect_db(self) -> None:
        try:
            self.conn = psycopg2.connect(self.db_url)
            logger.info("[OK] Connected to PostgreSQL database")
        except Exception as e:
            logger.error(f"[ERROR] Database connection failed: {e}")
            sys.exit(1)
            
    def load_metadata(self) -> None:
        cursor = self.conn.cursor()
        try:
            # Load NOTA Parties
            cursor.execute('SELECT id, name FROM "Party"')
            for pid, name in cursor.fetchall():
                if name.strip().upper() == 'NOTA':
                    self.nota_ids.add(pid)
            
            # Load GeoUnit Names (Constituencies Only)
            cursor.execute('SELECT id, name FROM "GeoUnit" WHERE level = \'CONSTITUENCY\'')
            for pid, name in cursor.fetchall():
                self.geo_unit_names[pid] = name
                
        finally:
            cursor.close()

    def process_margins(self) -> None:
        cursor = self.conn.cursor()
        grand_totals = {'created': 0, 'updated': 0, 'skipped': 0}
        
        try:
            # Process each election
            cursor.execute('SELECT id, year FROM "Election" ORDER BY year')
            elections = cursor.fetchall()
            
            for election_id, year in elections:
                logger.info(f"Processing Election: {year}...")
                
                # 1. Fetch all GeoSummaries for this election
                # (id, geoUnitId)
                cursor.execute(
                    'SELECT id, "geoUnitId" FROM "GeoElectionSummary" WHERE "electionId" = %s',
                    (election_id,)
                )
                geo_summaries = cursor.fetchall() # List of (summaryId, geoUnitId)
                
                if not geo_summaries:
                    logger.warning(f"  No summaries found for election {year}")
                    continue
                    
                summary_ids = [s[0] for s in geo_summaries]
                geo_unit_map = {s[0]: s[1] for s in geo_summaries} # summaryId -> geoUnitId
                
                # 2. Bulk fetch PartyVoteSummary
                # group by geoElectionSummaryId
                votes_map = defaultdict(list) # summaryId -> list of (partyId, voteCount)
                
                if summary_ids:
                    # chunking if necessary? 672 IDs is fine for IN clause
                    query = '''
                        SELECT "geoElectionSummaryId", "partyId", "voteCount"
                        FROM "PartyVoteSummary"
                        WHERE "geoElectionSummaryId" = ANY(%s)
                    '''
                    cursor.execute(query, (summary_ids,))
                    for row in cursor.fetchall():
                        votes_map[row[0]].append((row[1], row[2]))
                
                # 3. Compute Margins
                batch_insert = []
                batch_update = []
                
                for summary_id, geo_unit_id in geo_unit_map.items():
                    name = self.geo_unit_names.get(geo_unit_id, f"GeoUnit-{geo_unit_id}")
                    raw_votes = votes_map.get(summary_id, [])
                    
                    # Filter NOTA
                    valid_parties = [
                        (pid, count) for pid, count in raw_votes
                        if pid not in self.nota_ids
                    ]
                    
                    # Sort Desc
                    valid_parties.sort(key=lambda x: x[1], reverse=True)
                    
                    if len(valid_parties) < 2:
                        logger.warning(f"  [SKIPPED] {name} – {year} – Fewer than 2 valid parties")
                        grand_totals['skipped'] += 1
                        continue
                        
                    winner = valid_parties[0]
                    runner_up = valid_parties[1]
                    
                    winner_id, winner_votes = winner
                    runner_id, runner_votes = runner_up
                    
                    # Compute Margin
                    margin_votes = winner_votes - runner_votes
                    
                    total_valid = sum(count for _, count in valid_parties)
                    
                    margin_pct = 0.0
                    if total_valid > 0:
                        margin_pct = (margin_votes / total_valid) * 100
                    
                    # Check if exists (Idempotency)
                    cursor.execute(
                        '''
                        SELECT id FROM "ConstituencyMarginSummary"
                        WHERE "geoUnitId" = %s AND "electionId" = %s
                        ''',
                        (geo_unit_id, election_id)
                    )
                    existing = cursor.fetchone()
                    
                    record_data = (
                        election_id, geo_unit_id, winner_id, runner_id,
                        winner_votes, runner_votes, margin_votes, margin_pct
                    )
                    
                    if existing:
                        # Add ID for update
                        batch_update.append((existing[0],) + record_data)
                        # Log sample (verbose)
                        # logger.info(f"  [UPDATED] {name}")
                    else:
                        batch_insert.append(record_data)
                        logger.info(f"  [CREATED] {name} – {year} – Margin: {margin_pct:.2f}%")
                
                # 4. Execute Batch Writes
                if batch_insert:
                    sql_insert = '''
                        INSERT INTO "ConstituencyMarginSummary"
                        ("electionId", "geoUnitId", "winningPartyId", "runnerUpPartyId", 
                         "winningVotes", "runnerUpVotes", "marginVotes", "marginPercent")
                        VALUES %s
                    '''
                    execute_values(cursor, sql_insert, batch_insert)
                    grand_totals['created'] += len(batch_insert)
                    
                if batch_update:
                    # Manual loop for updates is safer for complex set, but execute_values with FROM VALUES is better
                    # Columns: id, elect, geo, winP, runP, winV, runV, margV, margP
                    sql_update = '''
                        UPDATE "ConstituencyMarginSummary" AS t
                        SET "winningPartyId" = v.winP,
                            "runnerUpPartyId" = v.runP,
                            "winningVotes" = v.winV,
                            "runnerUpVotes" = v.runV,
                            "marginVotes" = v.margV,
                            "marginPercent" = v.margP
                        FROM (VALUES %s) AS v(id, elect, geo, winP, runP, winV, runV, margV, margP)
                        WHERE t.id = v.id
                    '''
                    execute_values(cursor, sql_update, batch_update)
                    grand_totals['updated'] += len(batch_update)
                
                self.conn.commit()
                
            logger.info("="*60)
            logger.info("MARGIN COMPUTATION COMPLETE")
            logger.info(f"  Created: {grand_totals['created']}")
            logger.info(f"  Updated: {grand_totals['updated']}")
            logger.info(f"  Skipped: {grand_totals['skipped']}")
            logger.info("="*60)
            
        except Exception as e:
            self.conn.rollback()
            logger.error(f"[ERROR] Computation failed: {e}")
            raise
        finally:
            cursor.close()

    def run(self) -> None:
        try:
            self.connect_db()
            self.load_metadata()
            self.process_margins()
        finally:
            if self.conn:
                self.conn.close()

if __name__ == '__main__':
    db_url = os.getenv('DATABASE_URL_PG') or os.getenv('DATABASE_URL')
    if not db_url:
        logger.error("DATABASE_URL not set")
        sys.exit(1)
        
    computer = MarginComputer(db_url)
    computer.run()
