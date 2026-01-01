#!/usr/bin/env python3
"""
Election Result Seeding Script

Seeds ElectionResultRaw records from Karnataka Assembly election Excel file.

SCOPE:
- Creates ElectionResultRaw records (votesGeneral, votesPostal, votesTotal)
- Links to Election, GeoUnit (Constituency), Candidate, and Party
- Idempotent: safe to run multiple times
- Validates vote math (Total = General + Postal)

REQUIREMENTS:
- DATABASE_URL environment variable
- Excel file: Election_Data_With_Districts.xlsx
- All dependent tables (Election, GeoUnit, Candidate, Party) must be seeded
- Python 3.8+
"""

import os
import sys
import logging
import re
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

# Load environment variables from parent directory
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)


class ResultSeeder:
    """Handles ElectionResultRaw data extraction, validation, and seeding."""
    
    def __init__(self, db_url: str, excel_file: str):
        self.db_url = db_url
        self.excel_file = excel_file
        self.conn: Optional[connection] = None
        
        # Caches
        self.election_cache: Dict[int, int] = {}       # year -> election_id
        self.geounit_cache: Dict[str, int] = {}        # code -> geounit_id
        self.party_cache: Dict[str, int] = {}          # name -> party_id
        self.candidate_cache: Dict[Tuple[str, int], int] = {} # (name, party_id) -> candidate_id
        
    def connect_db(self) -> None:
        """Establish PostgreSQL connection."""
        try:
            self.conn = psycopg2.connect(self.db_url)
            logger.info("[OK] Connected to PostgreSQL database")
        except Exception as e:
            logger.error(f"[ERROR] Database connection failed: {e}")
            sys.exit(1)
    
    def close_db(self) -> None:
        """Close PostgreSQL connection."""
        if self.conn:
            self.conn.close()
            logger.info("Database connection closed")
    
    def load_caches(self) -> None:
        """Load all necessary lookups into memory."""
        logger.info("Loading caches...")
        cursor = self.conn.cursor()
        
        try:
            # 1. Elections (ASSEMBLY type)
            cursor.execute('SELECT year, id FROM "Election" WHERE type = %s', ('ASSEMBLY',))
            self.election_cache = {int(year): eid for year, eid in cursor.fetchall()}
            logger.info(f"  [OK] Cached {len(self.election_cache)} elections")
            
            # 2. GeoUnits (CONSTITUENCY level only)
            cursor.execute('SELECT code, id FROM "GeoUnit" WHERE level = %s', ('CONSTITUENCY',))
            self.geounit_cache = {code: gid for code, gid in cursor.fetchall()}
            logger.info(f"  [OK] Cached {len(self.geounit_cache)} constituencies")
            
            # 3. Parties
            cursor.execute('SELECT name, id FROM "Party"')
            self.party_cache = {name: pid for name, pid in cursor.fetchall()}
            logger.info(f"  [OK] Cached {len(self.party_cache)} parties")
            
            # 4. Candidates
            # Note: We need to cache ALL candidates to resolve IDs correctly
            logger.info("  Loading candidate cache (this may take a moment)...")
            cursor.execute('SELECT "fullName", "partyId", id FROM "Candidate"')
            self.candidate_cache = {(name, pid): cid for name, pid, cid in cursor.fetchall()}
            logger.info(f"  [OK] Cached {len(self.candidate_cache)} candidates")
            
        except Exception as e:
            logger.error(f"[ERROR] Failed to load caches: {e}")
            sys.exit(1)
        finally:
            cursor.close()
            
    def get_election_id(self, year: int) -> int:
        if year not in self.election_cache:
            # Try reloading cache once if missing
            logger.warning(f"Election {year} not found in cache. Possible missing seed data.")
            raise ValueError(f"Election for year {year} not found")
        return self.election_cache[year]
        
    def get_geounit_id(self, ac_no: int) -> int:
        code = str(ac_no)
        if code not in self.geounit_cache:
            raise ValueError(f"Constituency AC NO {ac_no} not found")
        return self.geounit_cache[code]
        
    def get_party_id(self, name: str) -> int:
        if name not in self.party_cache:
            raise ValueError(f"Party '{name}' not found")
        return self.party_cache[name]
        
    def get_candidate_id(self, name: str, party_id: int) -> int:
        key = (name, party_id)
        if key not in self.candidate_cache:
            raise ValueError(f"Candidate '{name}' (Party ID: {party_id}) not found")
        return self.candidate_cache[key]
    
    def clean_candidate_name(self, name) -> str:
        """Apply same cleaning logic as seed_candidates.py"""
        if pd.isna(name): return ""
        name = str(name).strip()
        # 1. Strip leading numeric prefixes (e.g., "1 ")
        name = re.sub(r'^\d+\s+', '', name)
        # 2. Normalize NOTA
        if 'NOTA' in name.upper() or 'NONE OF THE ABOVE' in name.upper():
            return 'NOTA'
        return name
    
    def load_excel(self) -> pd.DataFrame:
        """Load Excel file."""
        try:
            logger.info(f"Loading Excel file: {self.excel_file}")
            df = pd.read_excel(self.excel_file)
            logger.info(f"[OK] Loaded {len(df)} rows from Excel")
            
            # Normalize column names
            df.columns = df.columns.str.strip()
            
            return df
            
        except FileNotFoundError:
            logger.error(f"[ERROR] Excel file not found: {self.excel_file}")
            sys.exit(1)
        except Exception as e:
            logger.error(f"[ERROR] Error loading Excel: {e}")
            sys.exit(1)
    
    def extract_results(self, df: pd.DataFrame) -> List[Dict]:
        """
        Extract formatted result records from Excel.
        """
        logger.info("Mapping rows to database IDs...")
        
        results = []
        errors = 0
        
        # Prepare DataFrame columns for processing
        df['CANDIDATE NAME CLEAN'] = df['CANDIDATE NAME'].apply(self.clean_candidate_name)
        df['PARTY'] = df['PARTY'].str.strip()
        
        total_rows = len(df)
        
        for index, row in df.iterrows():
            try:
                # 1. IDs lookup
                election_id = self.get_election_id(int(row['YEAR']))
                geo_unit_id = self.get_geounit_id(int(row['AC NO.']))
                party_id = self.get_party_id(row['PARTY'])
                candidate_id = self.get_candidate_id(row['CANDIDATE NAME CLEAN'], party_id)
                
                # 2. Vote Data
                votes_general = int(row['GENERAL']) if pd.notna(row['GENERAL']) else 0
                votes_postal = int(row['POSTAL']) if pd.notna(row['POSTAL']) else 0
                votes_total = int(row['TOTAL']) if pd.notna(row['TOTAL']) else 0
                
                # 3. Validation
                calc_total = votes_general + votes_postal
                if calc_total != votes_total:
                    logger.warning(f"  [WARN] Vote mismatch Row {index}: Gen({votes_general}) + Pos({votes_postal}) != Total({votes_total})")
                
                results.append({
                    'electionId': election_id,
                    'geoUnitId': geo_unit_id,
                    'candidateId': candidate_id,
                    'partyId': party_id,
                    'votesGeneral': votes_general,
                    'votesPostal': votes_postal,
                    'votesTotal': votes_total
                })
                
            except ValueError as e:
                logger.error(f"[ERROR] Row {index}: {e}")
                errors += 1
                if errors > 10:
                    logger.error("Too many mapping errors. Aborting.")
                    sys.exit(1)
            except Exception as e:
                logger.error(f"[ERROR] Unexpected error Row {index}: {e}")
                sys.exit(1)
                
            if (index + 1) % 1000 == 0:
                logger.info(f"  Mapped {index + 1}/{total_rows} rows...")
                
        logger.info(f"[OK] Successfully mapped {len(results)} result records")
        return results
    
    def seed_results(self, results: List[Dict]) -> Dict[str, int]:
        """
        Batch insert results using copy_from or bulk inserts for performance?
        Prisma schema: id is autoincrement.
        We need to be idempotent, so we check existence.
        Given 8645 rows, row-by-row check is slow but safe. 
        For speed, we can assume if count matches, we skip? 
        No, let's keep it safe with check-then-insert.
        """
        logger.info("Seeding ElectionResultRaw records to database...")
        
        counts = {
            'created': 0,
            'reused': 0,
            'total': 0
        }
        
        cursor = self.conn.cursor()
        
        try:
            for i, res in enumerate(results, 1):
                # Check existance by (electionId, geoUnitId, candidateId)
                # Uniqueness is strictly (electionId, geoUnitId, candidateId) in logic,
                # though schema index is [electionId, geoUnitId].
                # We should check if this specific result exists.
                
                cursor.execute(
                    '''
                    SELECT id FROM "ElectionResultRaw" 
                    WHERE "electionId" = %s AND "geoUnitId" = %s AND "candidateId" = %s
                    ''',
                    (res['electionId'], res['geoUnitId'], res['candidateId'])
                )
                existing = cursor.fetchone()
                
                if existing:
                    counts['reused'] += 1
                    # Optional: Update votes if changed?
                    # For now just skip
                else:
                    cursor.execute(
                        '''
                        INSERT INTO "ElectionResultRaw" 
                        ("electionId", "geoUnitId", "candidateId", "partyId", 
                         "votesGeneral", "votesPostal", "votesTotal")
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ''',
                        (res['electionId'], res['geoUnitId'], res['candidateId'], res['partyId'],
                         res['votesGeneral'], res['votesPostal'], res['votesTotal'])
                    )
                    counts['created'] += 1
                
                counts['total'] += 1
                
                if i % 1000 == 0:
                    self.conn.commit() # Commit batch
                    logger.info(f"  Processed {i}/{len(results)} results...")
            
            self.conn.commit() # Final commit
            return counts
            
        except Exception as e:
            self.conn.rollback()
            logger.error(f"[ERROR] Error during seeding: {e}")
            raise
        finally:
            cursor.close()
    
    def run(self) -> None:
        """Main execution flow."""
        try:
            self.connect_db()
            self.load_caches()
            df = self.load_excel()
            results = self.extract_results(df)
            counts = self.seed_results(results)
            
            logger.info("\n" + "="*60)
            logger.info("[SUCCESS] RESULT SEEDING COMPLETED")
            logger.info("="*60)
            logger.info(f"  Results Created: {counts['created']}")
            logger.info(f"  Results Reused:  {counts['reused']}")
            logger.info(f"  Total Processed: {counts['total']}")
            logger.info("="*60)
            
        except Exception as e:
            logger.error(f"\n[ERROR] SEEDING FAILED: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
        finally:
            self.close_db()


def main():
    """Entry point."""
    db_url = os.getenv('DATABASE_URL_PG') or os.getenv('DATABASE_URL')
    if not db_url:
        logger.warning("[WARNING] DATABASE_URL not found, using fallback")
        db_url = "postgresql://politicai_user:Dhanu111@localhost:5432/politicai_dev"
    
    excel_file = os.path.join(
        os.path.dirname(__file__),
        '..',
        'Election_Data_With_Districts.xlsx'
    )
    
    if not os.path.exists(excel_file):
        logger.error(f"[ERROR] Excel file not found: {excel_file}")
        sys.exit(1)
    
    seeder = ResultSeeder(db_url, excel_file)
    seeder.run()


if __name__ == '__main__':
    main()
