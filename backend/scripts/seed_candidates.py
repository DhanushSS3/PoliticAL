#!/usr/bin/env python3
"""
Candidate Data Seeding Script

Seeds Candidate records from Karnataka Assembly election Excel file.

SCOPE:
- Creates Candidate records (fullName, gender, age, category, partyId)
- Does NOT seed election results or vote data
- Idempotent: safe to run multiple times
- Links candidates to parties

REQUIREMENTS:
- DATABASE_URL environment variable
- Excel file: Election_Data_With_Districts.xlsx
- Party table must be seeded
- Python 3.8+
"""

import os
import sys
import logging
from typing import Dict, List, Optional, Tuple
import pandas as pd
import re
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


class CandidateSeeder:
    """Handles Candidate data extraction, validation, and seeding."""
    
    def __init__(self, db_url: str, excel_file: str):
        self.db_url = db_url
        self.excel_file = excel_file
        self.conn: Optional[connection] = None
        self.party_cache: Dict[str, int] = {}  # party_name -> party_id
        
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
    
    def load_party_cache(self) -> None:
        """Load all parties into memory for fast lookup."""
        cursor = self.conn.cursor()
        try:
            cursor.execute('SELECT name, id FROM "Party"')
            self.party_cache = {name: party_id for name, party_id in cursor.fetchall()}
            logger.info(f"[OK] Loaded {len(self.party_cache)} parties into cache")
        except Exception as e:
            logger.error(f"[ERROR] Failed to load parties: {e}")
            sys.exit(1)
        finally:
            cursor.close()
    
    def get_party_id(self, party_name: str) -> int:
        """
        Get party ID by name from cache.
        
        Args:
            party_name: Party name
            
        Returns:
            Party ID
            
        Raises:
            ValueError if party not found
        """
        if party_name not in self.party_cache:
            raise ValueError(f"Party '{party_name}' not found. Please seed parties first.")
        return self.party_cache[party_name]
    
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
    
    def extract_candidates(self, df: pd.DataFrame) -> List[Dict]:
        """
        Extract unique CANDIDATE records from Excel.
        
        A candidate is unique by (fullName, partyId).
        We take the first occurrence for gender, age, category.
        
        Args:
            df: DataFrame with candidate data
            
        Returns:
            List of candidate dictionaries
        """
        logger.info("Extracting unique CANDIDATE records...")
        
        # Check required columns
        required_cols = ['CANDIDATE NAME', 'PARTY', 'SEX', 'AGE', 'CATEGORY']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            logger.error(f"[ERROR] Missing required columns: {missing_cols}")
            sys.exit(1)
        
        # Normalize candidate names and party names
        df['CANDIDATE NAME'] = df['CANDIDATE NAME'].str.strip()
        df['PARTY'] = df['PARTY'].str.strip()
        
        # Helper to clean candidate name
        def clean_candidate_name(name):
            if pd.isna(name):
                return name
            
            # Normalize strings roughly first
            name = str(name).strip()
            
            # 1. Strip leading 'X ' or 'XX ' (ballot numbers)
            # Regex: Start of string, one or more digits, followed by space
            name = re.sub(r'^\d+\s+', '', name)
            
            # 2. Normalize NOTA
            if 'NOTA' in name.upper() or 'NONE OF THE ABOVE' in name.upper():
                return 'NOTA'
                
            return name
            
        logger.info("  Cleaning candidate names (removing prefixes, normalizing NOTA)...")
        df['CANDIDATE NAME'] = df['CANDIDATE NAME'].apply(clean_candidate_name)
        
        # Check for empty names after cleaning
        empty_mask = df['CANDIDATE NAME'].isna() | (df['CANDIDATE NAME'] == '')
        if empty_mask.any():
            empty_count = empty_mask.sum()
            logger.error(f"[ERROR] Found {empty_count} candidate names that are empty after cleaning")
            sys.exit(1)
        
        # Get party IDs for all rows
        logger.info("  Mapping parties to IDs...")
        try:
            df['party_id'] = df['PARTY'].apply(self.get_party_id)
        except ValueError as e:
            logger.error(f"[ERROR] {e}")
            sys.exit(1)
        
        # Group by (CANDIDATE NAME, party_id) and take first occurrence
        # This handles candidates who may run in multiple constituencies
        candidate_groups = df.groupby(['CANDIDATE NAME', 'party_id']).first().reset_index()
        
        candidates = []
        for _, row in candidate_groups.iterrows():
            # Handle age - convert to int or None
            age = None
            if pd.notna(row['AGE']):
                try:
                    age = int(row['AGE'])
                except (ValueError, TypeError):
                    age = None
            
            candidates.append({
                'fullName': row['CANDIDATE NAME'],
                'gender': row['SEX'] if pd.notna(row['SEX']) else None,
                'age': age,
                'category': row['CATEGORY'] if pd.notna(row['CATEGORY']) else None,
                'partyId': int(row['party_id']),
                'partyName': row['PARTY']
            })
        
        logger.info(f"[OK] Found {len(candidates)} unique candidates")
        
        # Log special cases
        nota_candidates = [c for c in candidates if c['fullName'].upper() == 'NOTA']
        if nota_candidates:
            logger.info(f"  Special: Found {len(nota_candidates)} NOTA candidate entries")
        
        return candidates
    
    def insert_or_get_candidate(
        self,
        full_name: str,
        gender: Optional[str],
        age: Optional[int],
        category: Optional[str],
        party_id: int
    ) -> Tuple[int, bool]:
        """
        Insert Candidate if not exists, otherwise return existing id.
        
        Lookup by (fullName, partyId) for idempotency.
        
        Args:
            full_name: Candidate full name
            gender: Gender (optional)
            age: Age (optional)
            category: Category like SC/ST/OBC/General (optional)
            party_id: Party ID
            
        Returns:
            Tuple of (candidate_id, was_created)
        """
        cursor = self.conn.cursor()
        
        try:
            # Check if exists (by fullName and partyId)
            cursor.execute(
                '''
                SELECT id FROM "Candidate" 
                WHERE "fullName" = %s AND "partyId" = %s
                ''',
                (full_name, party_id)
            )
            result = cursor.fetchone()
            
            if result:
                # Already exists
                return result[0], False
            else:
                # Insert new
                cursor.execute(
                    '''
                    INSERT INTO "Candidate" ("fullName", gender, age, category, "partyId")
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                    ''',
                    (full_name, gender, age, category, party_id)
                )
                new_id = cursor.fetchone()[0]
                self.conn.commit()
                return new_id, True
                
        except Exception as e:
            self.conn.rollback()
            logger.error(f"[ERROR] Error inserting Candidate '{full_name}': {e}")
            raise
        finally:
            cursor.close()
    
    def seed_candidates(self, candidates: List[Dict]) -> Dict[str, int]:
        """
        Seed Candidate records to database.
        
        Args:
            candidates: List of candidate dictionaries
            
        Returns:
            Dict with counts of created vs reused candidates
        """
        logger.info("Seeding Candidate records to database...")
        
        counts = {
            'created': 0,
            'reused': 0,
            'total': 0,
            'nota': 0
        }
        
        try:
            for i, candidate in enumerate(candidates, 1):
                candidate_id, was_created = self.insert_or_get_candidate(
                    full_name=candidate['fullName'],
                    gender=candidate['gender'],
                    age=candidate['age'],
                    category=candidate['category'],
                    party_id=candidate['partyId']
                )
                
                # Track NOTA
                if candidate['fullName'].upper() == 'NOTA':
                    counts['nota'] += 1
                
                if was_created:
                    counts['created'] += 1
                    if i <= 10 or candidate['fullName'].upper() == 'NOTA':  # Log first 10 and NOTA
                        age_str = f", age={candidate['age']}" if candidate['age'] else ""
                        category_str = f", {candidate['category']}" if candidate['category'] else ""
                        logger.info(f"  [CREATED] {candidate['fullName']} ({candidate['partyName']}{age_str}{category_str}) id={candidate_id}")
                else:
                    counts['reused'] += 1
                    if i <= 5:  # Log first 5 reused
                        logger.info(f"  [REUSED]  {candidate['fullName']} ({candidate['partyName']}) id={candidate_id}")
                
                counts['total'] += 1
                
                # Progress indicator every 100 candidates
                if i % 100 == 0:
                    logger.info(f"  Progress: {i}/{len(candidates)} candidates processed...")
            
            return counts
            
        except Exception as e:
            logger.error(f"[ERROR] Error during seeding: {e}")
            self.conn.rollback()
            raise
    
    def run(self) -> None:
        """Main execution flow."""
        try:
            # 1. Connect to database
            self.connect_db()
            
            # 2. Load party cache
            self.load_party_cache()
            
            # 3. Load Excel data
            df = self.load_excel()
            
            # 4. Extract unique candidates
            candidates = self.extract_candidates(df)
            
            # 5. Seed candidates
            counts = self.seed_candidates(candidates)
            
            # 6. Report results
            logger.info("\n" + "="*60)
            logger.info("[SUCCESS] CANDIDATE SEEDING COMPLETED")
            logger.info("="*60)
            logger.info(f"  Candidates Created: {counts['created']}")
            logger.info(f"  Candidates Reused:  {counts['reused']}")
            logger.info(f"  Total Processed:    {counts['total']}")
            logger.info(f"  - NOTA entries:     {counts['nota']}")
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
    # Load DATABASE_URL from environment with fallback
    db_url = os.getenv('DATABASE_URL_PG') or os.getenv('DATABASE_URL')
    
    # Fallback to hardcoded value if environment variables not set
    if not db_url:
        logger.warning("[WARNING] DATABASE_URL not found in environment, using fallback")
        db_url = "postgresql://politicai_user:Dhanu111@localhost:5432/politicai_dev"
    else:
        logger.info(f"[OK] Using DATABASE_URL from environment")
    
    # Excel file path
    excel_file = os.path.join(
        os.path.dirname(__file__),
        '..',
        'Election_Data_With_Districts.xlsx'
    )
    
    if not os.path.exists(excel_file):
        logger.error(f"[ERROR] Excel file not found: {excel_file}")
        sys.exit(1)
    
    # Run seeder
    seeder = CandidateSeeder(db_url, excel_file)
    seeder.run()


if __name__ == '__main__':
    main()
