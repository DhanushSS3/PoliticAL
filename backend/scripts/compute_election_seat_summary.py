#!/usr/bin/env python3
"""
Election Seat Summary Computation Script

Computes high-level election outcomes (Winner, Hung Assembly, Total Seats).

SCOPE:
- Aggregates PartySeatSummary
- Determines if any party crossed Majority Mark
- Seeds ElectionSeatSummary table
- Purely arithmetic: No coalition guessing

REQUIREMENTS:
- DATABASE_URL environment variable
- PartySeatSummary table populated
"""

import os
import sys
import logging
import math
from typing import Dict, List, Optional
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


class ElectionSeatComputer:
    
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.conn: Optional[connection] = None
        
        # Caches
        self.elections: Dict[int, int] = {}          # id -> year
        self.party_names: Dict[int, str] = {}        # id -> name
        
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
        cursor = self.conn.cursor()
        try:
            # Load Elections
            cursor.execute('SELECT id, year FROM "Election"')
            self.elections = {row[0]: row[1] for row in cursor.fetchall()}
            
            # Load Party Names (for logging)
            cursor.execute('SELECT id, name FROM "Party"')
            self.party_names = {row[0]: row[1] for row in cursor.fetchall()}
            
        except Exception as e:
            logger.error(f"[ERROR] Failed to load metadata: {e}")
            sys.exit(1)
        finally:
            cursor.close()
            
    def compute_summaries(self) -> None:
        logger.info("Computing Election Summaries...")
        cursor = self.conn.cursor()
        
        counts = {'created': 0, 'updated': 0}
        
        try:
            # Process each election
            for election_id, year in sorted(self.elections.items(), key=lambda x: x[1]):
                logger.info(f"Processing Election {year}...")
                
                # Fetch seat counts
                cursor.execute(
                    '''
                    SELECT "partyId", "seatsWon" 
                    FROM "PartySeatSummary" 
                    WHERE "electionId" = %s
                    ''',
                    (election_id,)
                )
                party_seats = cursor.fetchall()
                
                if not party_seats:
                    logger.warning(f"  [WARN] No seat data found for {year}")
                    continue
                    
                # 1. Compute totals
                total_seats = sum(seats for _, seats in party_seats)
                majority_mark = (total_seats // 2) + 1
                
                logger.info(f"  Total Seats: {total_seats} | Majority Mark: {majority_mark}")
                
                # 2. Determine Winner
                winning_party_id = None
                is_hung = True
                
                for pid, seats in party_seats:
                    if seats >= majority_mark:
                        winning_party_id = pid
                        is_hung = False
                        break
                
                # Log outcome
                if is_hung:
                    logger.info("  Outcome: HUNG ASSEMBLY")
                else:
                    pname = self.party_names.get(winning_party_id, "Unknown")
                    logger.info(f"  Outcome: WINNER = {pname} (ID: {winning_party_id})")
                
                # 3. UPSERT
                cursor.execute(
                    '''
                    INSERT INTO "ElectionSeatSummary" 
                    ("electionId", "totalSeats", "majorityMark", "winningPartyId", "isHungAssembly", "createdAt")
                    VALUES (%s, %s, %s, %s, %s, NOW())
                    ON CONFLICT ("electionId") DO UPDATE SET
                    "totalSeats" = EXCLUDED."totalSeats",
                    "majorityMark" = EXCLUDED."majorityMark",
                    "winningPartyId" = EXCLUDED."winningPartyId",
                    "isHungAssembly" = EXCLUDED."isHungAssembly"
                    RETURNING (xmax = 0) AS is_insert
                    ''',
                    (election_id, total_seats, majority_mark, winning_party_id, is_hung)
                )
                
                # Check if insert or update (xmax=0 means insert)
                result = cursor.fetchone()
                if result and result[0]:
                    counts['created'] += 1
                else:
                    counts['updated'] += 1
                    
                self.conn.commit()
                
            logger.info("="*60)
            logger.info("ELECTION SUMMARY COMPLETE")
            logger.info(f"  Created: {counts['created']}")
            logger.info(f"  Updated: {counts['updated']}")
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
            self.compute_summaries()
        finally:
            self.close_db()

if __name__ == '__main__':
    db_url = os.getenv('DATABASE_URL_PG') or os.getenv('DATABASE_URL')
    if not db_url:
        db_url = "postgresql://politicai_user:Dhanu111@localhost:5432/politicai_dev"
        
    computer = ElectionSeatComputer(db_url)
    computer.run()
