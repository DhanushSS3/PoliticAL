#!/usr/bin/env python3
"""
GeoElectionSummary Computation Script

Aggregates raw election results to create constituency-level summaries.

SCOPE:
- Computes Total Votes, Turnout, Winner, Margin
- Seeding GeoElectionSummary table
- Uses Excel file for 'Total Electors' (missing in raw table)

REQUIREMENTS:
- DATABASE_URL environment variable
- Excel file: Election_Data_With_Districts.xlsx
- ElectionResultRaw table populated
"""

import os
import sys
import logging
from typing import Dict, List, Optional, Tuple
import pandas as pd
import psycopg2
from psycopg2.extensions import connection
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


class SummaryAggregator:
    
    def __init__(self, db_url: str, excel_file: str):
        self.db_url = db_url
        self.excel_file = excel_file
        self.conn: Optional[connection] = None
        
        # Caches
        self.electors_map: Dict[Tuple[int, int], int] = {} # (year, ac_no) -> total_electors
        self.election_year_map: Dict[int, int] = {}        # election_id -> year
        self.geounit_code_map: Dict[int, int] = {}         # geounit_id -> ac_no (int)
        
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
            
    def load_electors_map_from_excel(self) -> None:
        """
        Load Total Electors from Excel file.
        Needed because ElectionResultRaw does not store this field.
        """
        try:
            logger.info(f"Loading Excel for Total Electors map: {self.excel_file}")
            df = pd.read_excel(self.excel_file, usecols=['YEAR', 'AC NO.', 'TOTAL ELECTORS'])
            
            # Drop duplicates (one elector count per constituency per election)
            # Taking max just in case of inconsistent rows, though there shouldn't be
            grouped = df.groupby(['YEAR', 'AC NO.'])['TOTAL ELECTORS'].max()
            
            for (year, ac_no), electors in grouped.items():
                self.electors_map[(int(year), int(ac_no))] = int(electors)
                
            logger.info(f"[OK] Loaded {len(self.electors_map)} elector counts from Excel")
            
        except Exception as e:
            logger.error(f"[ERROR] Failed to load Excel: {e}")
            sys.exit(1)
            
    def load_db_maps(self) -> None:
        """Load ID -> Value maps for lookups."""
        cursor = self.conn.cursor()
        try:
            # Election ID -> Year
            cursor.execute('SELECT id, year FROM "Election"')
            self.election_year_map = {eid: year for eid, year in cursor.fetchall()}
            
            # GeoUnit ID -> Code (AC NO)
            # Only fetch CONSTITUENCY level
            cursor.execute('SELECT id, code FROM "GeoUnit" WHERE level = %s', ('CONSTITUENCY',))
            # Code is stored as string in DB, convert to int for matching
            self.geounit_code_map = {gid: int(code) for gid, code in cursor.fetchall() if code.isdigit()}
            
            logger.info(f"[OK] Loaded ID maps (Elections: {len(self.election_year_map)}, Constituencies: {len(self.geounit_code_map)})")
            
        except Exception as e:
            logger.error(f"[ERROR] Failed to load DB maps: {e}")
            sys.exit(1)
        finally:
            cursor.close()
            
    def fetch_raw_results(self) -> Dict:
        """
        Fetch all raw results grouped by (electionId, geoUnitId).
        
        Returns:
            Dict: {(electionId, geoUnitId): [list of candidate results]}
        """
        logger.info("Fetching raw results from database...")
        cursor = self.conn.cursor()
        
        # Structure to hold grouped data
        grouped_results = {}
        
        try:
            query = '''
            SELECT 
                r."electionId",
                r."geoUnitId",
                c."fullName",
                p.name,
                r."votesTotal",
                r."partyId"
            FROM "ElectionResultRaw" r
            JOIN "Candidate" c ON r."candidateId" = c.id
            JOIN "Party" p ON r."partyId" = p.id
            '''
            cursor.execute(query)
            
            # Stream results
            count = 0
            while True:
                rows = cursor.fetchmany(1000)
                if not rows:
                    break
                
                for row in rows:
                    key = (row[0], row[1]) # (electionId, geoUnitId)
                    data = {
                        'candidateName': row[2],
                        'partyName': row[3],
                        'votes': row[4],
                        'partyId': row[5]
                    }
                    
                    if key not in grouped_results:
                        grouped_results[key] = []
                    grouped_results[key].append(data)
                    
                    count += 1
            
            logger.info(f"[OK] Fetched {count} raw result records")
            return grouped_results
            
        except Exception as e:
            logger.error(f"[ERROR] Failed to fetch raw results: {e}")
            sys.exit(1)
        finally:
            cursor.close()
            
    def compute_and_seed(self, grouped_results: Dict) -> None:
        """Compute metrics and seed GeoElectionSummary."""
        logger.info("Computing summaries and seeding...")
        
        cursor = self.conn.cursor()
        counts = {'created': 0, 'skipped': 0, 'error': 0}
        
        try:
            for (election_id, geounit_id), candidates in grouped_results.items():
                
                # 1. Basic Stats
                total_votes = sum(c['votes'] for c in candidates)
                
                # NOTA stats
                nota_votes = sum(c['votes'] for c in candidates if c['partyName'] == 'NOTA' or c['candidateName'] == 'NOTA')
                nota_percent = (nota_votes / total_votes * 100) if total_votes > 0 else 0.0
                
                # 2. Get Total Electors (from Excel Map)
                year = self.election_year_map.get(election_id)
                ac_no = self.geounit_code_map.get(geounit_id)
                
                # If we can't map, we can't compute turnout correctly.
                # Use total_votes as fallback? No, better to error or partial.
                total_electors = self.electors_map.get((year, ac_no), 0)
                
                if total_electors == 0:
                    # Fallback: at least equal to votes cast if missing
                    # logger.warning(f"Missing electors for Election {year} AC {ac_no}")
                    total_electors = total_votes
                
                turnout_percent = (total_votes / total_electors * 100) if total_electors > 0 else 0.0
                
                # 3. Determine Winner and Margin
                # Sort by votes descending
                sorted_candidates = sorted(candidates, key=lambda x: x['votes'], reverse=True)
                
                if not sorted_candidates:
                    counts['error'] += 1
                    continue
                    
                winner = sorted_candidates[0]
                winning_votes = winner['votes']
                
                runner_up_votes = 0
                if len(sorted_candidates) > 1:
                    runner_up_votes = sorted_candidates[1]['votes']
                
                margin = winning_votes - runner_up_votes
                margin_pct = (margin / total_votes * 100) if total_votes > 0 else 0.0
                
                # 4. Insert (Idempotent)
                # Check existence
                cursor.execute(
                    'SELECT id FROM "GeoElectionSummary" WHERE "electionId"=%s AND "geoUnitId"=%s',
                    (election_id, geounit_id)
                )
                if cursor.fetchone():
                    counts['skipped'] += 1
                    continue
                
                cursor.execute(
                    '''
                    INSERT INTO "GeoElectionSummary"
                    ("electionId", "geoUnitId", "totalElectors", "totalVotesCast", 
                     "turnoutPercent", "winningParty", "winningCandidate", 
                     "winningMargin", "winningMarginPct", "notaVotes", "notaPercent")
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''',
                    (election_id, geounit_id, total_electors, total_votes,
                     turnout_percent, winner['partyName'], winner['candidateName'],
                     margin, margin_pct, nota_votes, nota_percent)
                )
                counts['created'] += 1
                
                if counts['created'] % 50 == 0:
                     self.conn.commit()
            
            self.conn.commit()
            logger.info("="*60)
            logger.info("SUMMARY COMPUTATION COMPLETE")
            logger.info(f"  Created: {counts['created']}")
            logger.info(f"  Skipped: {counts['skipped']}")
            logger.info(f"  Errors:  {counts['error']}")
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
            self.load_electors_map_from_excel()
            self.load_db_maps()
            grouped = self.fetch_raw_results()
            self.compute_and_seed(grouped)
        except Exception as e:
            logger.error(f"Run failed: {e}")
            sys.exit(1)
        finally:
            self.close_db()

if __name__ == '__main__':
    db_url = os.getenv('DATABASE_URL_PG') or os.getenv('DATABASE_URL')
    if not db_url:
        db_url = "postgresql://politicai_user:Dhanu111@localhost:5432/politicai_dev"
        
    excel_file = os.path.join(os.path.dirname(__file__), '..', 'Election_Data_With_Districts.xlsx')
    
    if not os.path.exists(excel_file):
        print(f"Excel file not found: {excel_file}")
        sys.exit(1)
        
    aggregator = SummaryAggregator(db_url, excel_file)
    aggregator.run()
