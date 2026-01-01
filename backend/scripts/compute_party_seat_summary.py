#!/usr/bin/env python3
"""
Party Seat Summary Computation Script

Computes seat share per party per election based on GeoElectionSummary winners.

SCOPE:
- Aggregates winningParty from GeoElectionSummary
- Resolves Party Names to IDs
- Seeds PartySeatSummary table
- Idempotent: safe to run multiple times (UPSERT logic)

REQUIREMENTS:
- DATABASE_URL environment variable
- GeoElectionSummary, Party, Election tables populated
"""

import os
import sys
import logging
from typing import Dict, List, Optional, Tuple
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


class PartySeatAggregator:
    
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.conn: Optional[connection] = None
        
        # Caches
        self.party_map: Dict[str, int] = {}    # normalized_name -> id
        self.elections: Dict[int, int] = {}    # id -> year (for logging)
        
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
            # Map name -> id
            # Note: names should be stripped
            self.party_map = {name.strip(): pid for pid, name in cursor.fetchall()}
            logger.info(f"[OK] Cached {len(self.party_map)} parties")
            
            # Load Elections
            cursor.execute('SELECT id, year FROM "Election"')
            self.elections = {pid: year for pid, year in cursor.fetchall()}
            logger.info(f"[OK] Cached {len(self.elections)} elections")
            
        except Exception as e:
            logger.error(f"[ERROR] Failed to load metadata: {e}")
            sys.exit(1)
        finally:
            cursor.close()
            
    def compute_seat_shares(self) -> None:
        """Aggregate seats and update DB."""
        cursor = self.conn.cursor()
        
        counts = {'updated': 0, 'created': 0, 'skipped': 0}
        
        try:
            for election_id, year in sorted(self.elections.items(), key=lambda x: x[1]):
                logger.info(f"Processing Election: {year} (id={election_id})...")
                
                # Fetch constituency winners for this election
                cursor.execute(
                    '''
                    SELECT "winningParty", COUNT(*) as seats
                    FROM "GeoElectionSummary"
                    WHERE "electionId" = %s
                    GROUP BY "winningParty"
                    ''',
                    (election_id,)
                )
                results = cursor.fetchall()
                
                if not results:
                    logger.warning(f"  [WARN] No summaries found for election {year}")
                    continue
                
                total_constituencies = 0
                party_seats = {} # party_name -> count
                
                for party_name, seats in results:
                    if not party_name:
                        logger.warning("  [WARN] Found winner with NULL party name")
                        continue
                    if party_name == 'NOTA':
                        continue # Ignore NOTA wins (rare/theoretical)
                        
                    clean_name = party_name.strip()
                    if clean_name not in self.party_map:
                        logger.warning(f"  [WARN] Winning party '{clean_name}' not found in Party table. Skipping.")
                        continue
                        
                    party_id = self.party_map[clean_name]
                    party_seats[party_id] = seats
                    total_constituencies += seats
                
                logger.info(f"  Total constituencies counted: {total_constituencies}")
                
                # UPSERT into PartySeatSummary
                for party_id, seats in party_seats.items():
                    # Check existence
                    cursor.execute(
                        '''
                        SELECT id, "seatsWon" FROM "PartySeatSummary" 
                        WHERE "electionId" = %s AND "partyId" = %s
                        ''',
                        (election_id, party_id)
                    )
                    existing = cursor.fetchone()
                    
                    if existing:
                        current_seats = existing[1]
                        if current_seats != seats:
                            cursor.execute(
                                '''
                                UPDATE "PartySeatSummary"
                                SET "seatsWon" = %s
                                WHERE id = %s
                                ''',
                                (seats, existing[0])
                            )
                            counts['updated'] += 1
                            logger.info(f"    Party ID {party_id}: Updated seats {current_seats} -> {seats}")
                        else:
                            counts['skipped'] += 1
                    else:
                        cursor.execute(
                            '''
                            INSERT INTO "PartySeatSummary" ("electionId", "partyId", "seatsWon")
                            VALUES (%s, %s, %s)
                            ''',
                            (election_id, party_id, seats)
                        )
                        counts['created'] += 1
                        logger.info(f"    Party ID {party_id}: Created with {seats} seats")
                        
                self.conn.commit()
                
            logger.info("="*60)
            logger.info("SEAT SUMMARY COMPUTATION COMPLETE")
            logger.info(f"  Created: {counts['created']}")
            logger.info(f"  Updated: {counts['updated']}")
            logger.info(f"  Skipped: {counts['skipped']}")
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
            self.compute_seat_shares()
        finally:
            self.close_db()

if __name__ == '__main__':
    db_url = os.getenv('DATABASE_URL_PG') or os.getenv('DATABASE_URL')
    if not db_url:
        db_url = "postgresql://politicai_user:Dhanu111@localhost:5432/politicai_dev"
        
    aggregator = PartySeatAggregator(db_url)
    aggregator.run()
