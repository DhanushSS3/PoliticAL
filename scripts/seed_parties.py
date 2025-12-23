#!/usr/bin/env python3
"""
Party Data Seeding Script

Seeds Party records from Karnataka Assembly election Excel file.

SCOPE:
- Creates Party records ONLY (name, symbol, colorHex)
- Does NOT seed candidates or election results
- Idempotent: safe to run multiple times
- Handles NOTA and Independent (IND) correctly

REQUIREMENTS:
- DATABASE_URL environment variable
- Excel file: Election_Data_With_Districts.xlsx
- Python 3.8+
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

# Load environment variables from parent directory
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

# Debug: Check if environment variables are loaded
logger.info(f"Loading .env from: {env_path}")
logger.info(f"DATABASE_URL found: {'DATABASE_URL' in os.environ}")
logger.info(f"DATABASE_URL_PG found: {'DATABASE_URL_PG' in os.environ}")


class PartySeeder:
    """Handles Party data extraction, validation, and seeding."""
    
    def __init__(self, db_url: str, excel_file: str):
        self.db_url = db_url
        self.excel_file = excel_file
        self.conn: Optional[connection] = None
        
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
    
    def extract_parties(self, df: pd.DataFrame) -> List[Dict]:
        """
        Extract unique PARTY and SYMBOL values from Excel.
        
        Args:
            df: DataFrame with PARTY and SYMBOL columns
            
        Returns:
            List of party dictionaries with name, symbol
        """
        logger.info("Extracting unique PARTY values...")
        
        # Check if required columns exist
        if 'PARTY' not in df.columns:
            logger.error("[ERROR] PARTY column not found in Excel")
            sys.exit(1)
        
        if 'SYMBOL' not in df.columns:
            logger.error("[ERROR] SYMBOL column not found in Excel")
            sys.exit(1)
        
        # Check for null values in PARTY
        if df['PARTY'].isna().any():
            null_count = df['PARTY'].isna().sum()
            logger.error(f"[ERROR] Found {null_count} null values in PARTY column")
            sys.exit(1)
        
        # Extract unique party-symbol combinations
        party_df = df[['PARTY', 'SYMBOL']].drop_duplicates()
        
        # Normalize party names and symbols
        party_df['PARTY'] = party_df['PARTY'].str.strip()
        party_df['SYMBOL'] = party_df['SYMBOL'].fillna('').str.strip()
        
        # Group by PARTY to handle cases where one party might have multiple symbols
        # (take the most common symbol for each party)
        parties = []
        for party_name in sorted(party_df['PARTY'].unique()):
            party_symbols = party_df[party_df['PARTY'] == party_name]['SYMBOL']
            # Get most common symbol (or first if all are unique)
            symbol = party_symbols.mode()[0] if not party_symbols.mode().empty else party_symbols.iloc[0]
            
            parties.append({
                'name': party_name,
                'symbol': symbol if symbol else None,
                'colorHex': None  # Will be set later if needed
            })
        
        logger.info(f"[OK] Found {len(parties)} unique parties")
        
        # Log special cases
        nota_parties = [p for p in parties if 'NOTA' in p['name'].upper()]
        ind_parties = [p for p in parties if p['name'].upper() == 'IND' or 'INDEPENDENT' in p['name'].upper()]
        
        if nota_parties:
            logger.info(f"  Special: Found {len(nota_parties)} NOTA entries")
        if ind_parties:
            logger.info(f"  Special: Found {len(ind_parties)} Independent entries")
        
        return parties
    
    def insert_or_get_party(
        self,
        name: str,
        symbol: Optional[str],
        color_hex: Optional[str]
    ) -> Tuple[int, bool]:
        """
        Insert Party if not exists, otherwise return existing id.
        
        Lookup by name for idempotency.
        
        Args:
            name: Party name
            symbol: Party symbol (optional)
            color_hex: Party color (optional)
            
        Returns:
            Tuple of (party_id, was_created)
        """
        cursor = self.conn.cursor()
        
        try:
            # Check if exists (by name)
            cursor.execute(
                '''
                SELECT id FROM "Party" 
                WHERE name = %s
                ''',
                (name,)
            )
            result = cursor.fetchone()
            
            if result:
                # Already exists
                return result[0], False
            else:
                # Insert new
                cursor.execute(
                    '''
                    INSERT INTO "Party" (name, symbol, "colorHex")
                    VALUES (%s, %s, %s)
                    RETURNING id
                    ''',
                    (name, symbol, color_hex)
                )
                new_id = cursor.fetchone()[0]
                self.conn.commit()
                return new_id, True
                
        except Exception as e:
            self.conn.rollback()
            logger.error(f"[ERROR] Error inserting Party '{name}': {e}")
            raise
        finally:
            cursor.close()
    
    def seed_parties(self, parties: List[Dict]) -> Dict[str, int]:
        """
        Seed Party records to database.
        
        Args:
            parties: List of party dictionaries
            
        Returns:
            Dict with counts of created vs reused parties
        """
        logger.info("Seeding Party records to database...")
        
        counts = {
            'created': 0,
            'reused': 0,
            'total': 0,
            'nota': 0,
            'independent': 0
        }
        
        try:
            for party in parties:
                party_id, was_created = self.insert_or_get_party(
                    name=party['name'],
                    symbol=party['symbol'],
                    color_hex=party['colorHex']
                )
                
                # Track special cases
                if 'NOTA' in party['name'].upper():
                    counts['nota'] += 1
                elif party['name'].upper() == 'IND' or 'INDEPENDENT' in party['name'].upper():
                    counts['independent'] += 1
                
                if was_created:
                    counts['created'] += 1
                    symbol_display = f", symbol='{party['symbol']}'" if party['symbol'] else ""
                    logger.info(f"  [CREATED] {party['name']} (id={party_id}{symbol_display})")
                else:
                    counts['reused'] += 1
                    logger.info(f"  [REUSED]  {party['name']} (id={party_id})")
                
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
            
            # 3. Extract unique parties
            parties = self.extract_parties(df)
            
            # 4. Seed parties
            counts = self.seed_parties(parties)
            
            # 5. Report results
            logger.info("\n" + "="*60)
            logger.info("[SUCCESS] PARTY SEEDING COMPLETED")
            logger.info("="*60)
            logger.info(f"  Parties Created:   {counts['created']}")
            logger.info(f"  Parties Reused:    {counts['reused']}")
            logger.info(f"  Total Processed:   {counts['total']}")
            logger.info(f"  - NOTA entries:    {counts['nota']}")
            logger.info(f"  - Independent:     {counts['independent']}")
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
    seeder = PartySeeder(db_url, excel_file)
    seeder.run()


if __name__ == '__main__':
    main()
