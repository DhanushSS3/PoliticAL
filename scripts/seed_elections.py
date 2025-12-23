#!/usr/bin/env python3
"""
Election Data Seeding Script

Seeds Election records from Karnataka Assembly election Excel file.

SCOPE:
- Creates Election records ONLY (year, type, stateId)
- Does NOT seed election results, candidates, or parties
- Idempotent: safe to run multiple times

REQUIREMENTS:
- DATABASE_URL environment variable
- Excel file: Election_Data_With_Districts.xlsx
- GeoUnit table must have Karnataka state seeded
- Python 3.8+
"""

import os
import sys
import logging
from typing import Dict, List, Optional
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
load_dotenv()


class ElectionSeeder:
    """Handles Election data extraction, validation, and seeding."""
    
    def __init__(self, db_url: str, excel_file: str):
        self.db_url = db_url
        self.excel_file = excel_file
        self.conn: Optional[connection] = None
        self.karnataka_geo_id: Optional[int] = None
        
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
    
    def get_karnataka_geo_id(self) -> int:
        """
        Fetch the GeoUnit id for Karnataka state.
        
        Returns:
            GeoUnit id for Karnataka
        """
        cursor = self.conn.cursor()
        try:
            cursor.execute(
                '''
                SELECT id FROM "GeoUnit" 
                WHERE code = %s AND level = %s
                ''',
                ('KA', 'STATE')
            )
            result = cursor.fetchone()
            
            if not result:
                logger.error("[ERROR] Karnataka GeoUnit not found (code=KA, level=STATE)")
                logger.error("        Please run seed_geounits.py first")
                sys.exit(1)
            
            karnataka_id = result[0]
            logger.info(f"  Found Karnataka GeoUnit (id={karnataka_id})")
            return karnataka_id
            
        except Exception as e:
            logger.error(f"[ERROR] Failed to fetch Karnataka GeoUnit: {e}")
            sys.exit(1)
        finally:
            cursor.close()
    
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
    
    def extract_years(self, df: pd.DataFrame) -> List[int]:
        """
        Extract unique YEAR values from Excel.
        
        Args:
            df: DataFrame with YEAR column
            
        Returns:
            List of unique years
        """
        logger.info("Extracting unique YEAR values...")
        
        # Check if YEAR column exists
        if 'YEAR' not in df.columns:
            logger.error("[ERROR] YEAR column not found in Excel")
            sys.exit(1)
        
        # Check for null values
        if df['YEAR'].isna().any():
            null_count = df['YEAR'].isna().sum()
            logger.error(f"[ERROR] Found {null_count} null values in YEAR column")
            sys.exit(1)
        
        # Extract unique years
        unique_years = sorted(df['YEAR'].unique())
        
        # Validate years are integers
        try:
            unique_years = [int(year) for year in unique_years]
        except (ValueError, TypeError) as e:
            logger.error(f"[ERROR] Invalid YEAR values: {e}")
            sys.exit(1)
        
        logger.info(f"[OK] Found {len(unique_years)} unique years: {unique_years}")
        
        return unique_years
    
    def insert_or_get_election(
        self,
        year: int,
        election_type: str,
        state_geo_id: int
    ) -> tuple[int, bool]:
        """
        Insert Election if not exists, otherwise return existing id.
        
        Lookup by (year, type, stateId) for idempotency.
        
        Args:
            year: Election year
            election_type: ElectionType enum value (ASSEMBLY, PARLIAMENT, MUNICIPAL)
            state_geo_id: GeoUnit id for the state
            
        Returns:
            Tuple of (election_id, was_created)
        """
        cursor = self.conn.cursor()
        
        try:
            # Check if exists
            cursor.execute(
                '''
                SELECT id FROM "Election" 
                WHERE year = %s AND type = %s AND "stateId" = %s
                ''',
                (year, election_type, state_geo_id)
            )
            result = cursor.fetchone()
            
            if result:
                # Already exists
                return result[0], False
            else:
                # Insert new
                cursor.execute(
                    '''
                    INSERT INTO "Election" (year, type, "stateId", "createdAt")
                    VALUES (%s, %s, %s, NOW())
                    RETURNING id
                    ''',
                    (year, election_type, state_geo_id)
                )
                new_id = cursor.fetchone()[0]
                self.conn.commit()
                return new_id, True
                
        except Exception as e:
            self.conn.rollback()
            logger.error(f"[ERROR] Error inserting Election for year {year}: {e}")
            raise
        finally:
            cursor.close()
    
    def seed_elections(self, years: List[int]) -> Dict[str, int]:
        """
        Seed Election records to database.
        
        Args:
            years: List of election years
            
        Returns:
            Dict with counts of created vs reused elections
        """
        logger.info("Seeding Election records to database...")
        
        counts = {
            'created': 0,
            'reused': 0,
            'total': 0
        }
        
        # Get Karnataka GeoUnit id
        self.karnataka_geo_id = self.get_karnataka_geo_id()
        
        try:
            for year in years:
                election_id, was_created = self.insert_or_get_election(
                    year=year,
                    election_type='ASSEMBLY',
                    state_geo_id=self.karnataka_geo_id
                )
                
                if was_created:
                    counts['created'] += 1
                    logger.info(f"  [CREATED] Karnataka Assembly Election {year} (id={election_id})")
                else:
                    counts['reused'] += 1
                    logger.info(f"  [REUSED]  Karnataka Assembly Election {year} (id={election_id})")
                
                counts['total'] += 1
            
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
            
            # 2. Load Excel data
            df = self.load_excel()
            
            # 3. Extract unique years
            years = self.extract_years(df)
            
            # 4. Seed elections
            counts = self.seed_elections(years)
            
            # 5. Report results
            logger.info("\n" + "="*60)
            logger.info("[SUCCESS] ELECTION SEEDING COMPLETED")
            logger.info("="*60)
            logger.info(f"  Elections Created: {counts['created']}")
            logger.info(f"  Elections Reused:  {counts['reused']}")
            logger.info(f"  Total Processed:   {counts['total']}")
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
    # Load DATABASE_URL from environment
    db_url = os.getenv('DATABASE_URL_PG', "postgresql://politicai_user:Dhanu111@localhost:5432/politicai_dev")
    if not db_url:
        logger.error("[ERROR] DATABASE_URL environment variable not set")
        logger.error("        Please set DATABASE_URL in your .env file or environment")
        sys.exit(1)
    
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
    seeder = ElectionSeeder(db_url, excel_file)
    seeder.run()


if __name__ == '__main__':
    main()
