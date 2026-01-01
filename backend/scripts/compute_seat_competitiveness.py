#!/usr/bin/env python3
"""
Seat Competitiveness Computation Script

Classifies seats as SAFE, MARGINAL, or SWING based on victory margins.
Derived from ConstituencyMarginSummary.

SCOPE:
- Reads Margin %
- Applies Classification Rules (>=10: SAFE, >=5: MARGINAL, <5: SWING)
- Seeds SeatCompetitivenessSummary table
- Idempotent: UPSERT logic

REQUIREMENTS:
- DATABASE_URL environment variable
- ConstituencyMarginSummary populated
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


class CompetitivenessComputer:
    
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.conn = None
        
        self.geo_unit_names: Dict[int, str] = {} # id -> name
        
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
            # Load GeoUnit Names
            cursor.execute('SELECT id, name FROM "GeoUnit" WHERE level = \'CONSTITUENCY\'')
            for pid, name in cursor.fetchall():
                self.geo_unit_names[pid] = name
                
        finally:
            cursor.close()

    def process_classifications(self) -> None:
        cursor = self.conn.cursor()
        grand_totals = {'created': 0, 'updated': 0, 'skipped': 0}
        
        try:
            # Process each election
            cursor.execute('SELECT id, year FROM "Election" ORDER BY year')
            elections = cursor.fetchall()
            
            for election_id, year in elections:
                logger.info(f"Processing Election: {year}...")
                
                # 1. Fetch Margins
                cursor.execute(
                    '''
                    SELECT 
                        "geoUnitId", "winningPartyId", "marginPercent"
                    FROM "ConstituencyMarginSummary"
                    WHERE "electionId" = %s
                    ''',
                    (election_id,)
                )
                margins = cursor.fetchall()
                
                if not margins:
                    logger.warning(f"  No margin data found for election {year}")
                    continue
                
                batch_insert = []
                batch_update = []
                
                existing_map = {} # geoUnitId -> id
                cursor.execute(
                    '''
                    SELECT id, "geoUnitId" FROM "SeatCompetitivenessSummary"
                    WHERE "electionId" = %s
                    ''',
                    (election_id,)
                )
                for rid, guid in cursor.fetchall():
                    existing_map[guid] = rid
                
                for geo_id, winning_party_id, margin_pct in margins:
                    name = self.geo_unit_names.get(geo_id, f"GeoUnit-{geo_id}")
                    
                    if margin_pct is None:
                        logger.warning(f"  [SKIPPED] {name} - margin is NULL")
                        grand_totals['skipped'] += 1
                        continue
                        
                    # 2. Determine Classification
                    # Rules: >= 10 SAFE, >= 5 MARGINAL, else SWING
                    classification = "SWING"
                    if margin_pct >= 10.0:
                        classification = "SAFE"
                    elif margin_pct >= 5.0:
                        classification = "MARGINAL"
                        
                    # Prepare Record
                    # (elect, geo, party, margin, class) provided in DB
                    
                    if geo_id in existing_map:
                        rid = existing_map[geo_id]
                        # (id, party, margin, class)
                        batch_update.append((rid, winning_party_id, margin_pct, classification))
                        # logger.info(f"  [UPDATED] {name}")
                    else:
                        batch_insert.append((election_id, geo_id, winning_party_id, margin_pct, classification))
                        logger.info(f"  [CREATED] {name} – {year} – {classification} ({margin_pct:.2f}%)")
                
                # 3. Execute Writes
                if batch_insert:
                    sql_insert = '''
                        INSERT INTO "SeatCompetitivenessSummary"
                        ("electionId", "geoUnitId", "winningPartyId", "marginPercent", "classification")
                        VALUES %s
                    '''
                    execute_values(cursor, sql_insert, batch_insert)
                    grand_totals['created'] += len(batch_insert)
                    
                if batch_update:
                    sql_update = '''
                        UPDATE "SeatCompetitivenessSummary" AS t
                        SET "winningPartyId" = v.pid,
                            "marginPercent" = v.mpct,
                            "classification" = v.cls
                        FROM (VALUES %s) AS v(id, pid, mpct, cls)
                        WHERE t.id = v.id
                    '''
                    execute_values(cursor, sql_update, batch_update)
                    grand_totals['updated'] += len(batch_update)
                
                self.conn.commit()
                
            logger.info("="*60)
            logger.info("COMPETITIVENESS COMPUTATION COMPLETE")
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
            self.process_classifications()
        finally:
            if self.conn:
                self.conn.close()

if __name__ == '__main__':
    db_url = os.getenv('DATABASE_URL_PG') or os.getenv('DATABASE_URL')
    if not db_url:
        logger.error("DATABASE_URL not set")
        sys.exit(1)
        
    computer = CompetitivenessComputer(db_url)
    computer.run()
