#!/usr/bin/env python3
"""
GeoUnit Data Ingestion Script

Extracts geographical reference data from Karnataka Assembly election Excel file
and loads it into PostgreSQL using the Prisma schema.

SCOPE:
- Seeds GeoUnit data ONLY (State, Districts, Constituencies)
- Does NOT seed candidates, parties, or election results
- Validates data strictly and fails fast on errors
- Idempotent: can be run multiple times safely

REQUIREMENTS:
- DATABASE_URL environment variable
- Excel file: Election_Data_With_Districts.xlsx
- Python 3.8+
"""

import os
import sys
import re
import logging
from typing import Dict, List, Tuple, Optional
import pandas as pd
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import connection
from dotenv import load_dotenv
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


load_dotenv() 

# DEBUG: See if the variable actually exists in the environment
print(f"DATABASE_URL found in env: {'DATABASE_URL' in os.environ}")


class GeoUnitSeeder:
    """Handles GeoUnit data extraction, validation, and seeding."""
    
    def __init__(self, db_url: str, excel_file: str):
        self.db_url = db_url
        self.excel_file = excel_file
        self.conn: Optional[connection] = None
        
    def connect_db(self) -> None:
        """Establish PostgreSQL connection."""
        try:
            self.conn = psycopg2.connect(self.db_url)
            logger.info("✅ Connected to PostgreSQL database")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            sys.exit(1)
    
    def close_db(self) -> None:
        """Close PostgreSQL connection."""
        if self.conn:
            self.conn.close()
            logger.info("Database connection closed")
    
    def normalize_text(self, text: str) -> str:
        """
        Normalize text by:
        - Stripping leading/trailing whitespace
        - Collapsing multiple spaces to single space
        - Title case for consistency
        """
        if pd.isna(text):
            return ""
        text = str(text).strip()
        text = re.sub(r'\s+', ' ', text)  # Collapse multiple spaces
        return text
    
    def generate_district_code(self, district_name: str) -> str:
        """
        Generate district code from name.
        Rules:
        - Uppercase
        - Replace spaces with underscores
        - Remove special characters except underscores
        
        Examples:
        - "Belagavi" → "BELAGAVI"
        - "Bengaluru Urban (North)" → "BENGALURU_URBAN_NORTH"
        """
        code = district_name.upper()
        # Remove special characters (keep only alphanumeric and spaces)
        code = re.sub(r'[^\w\s]', '', code)
        # Replace spaces with underscores
        code = code.replace(' ', '_')
        # Collapse multiple underscores
        code = re.sub(r'_+', '_', code)
        return code.strip('_')
    
    def load_and_normalize_excel(self) -> pd.DataFrame:
        """Load Excel file and normalize data."""
        try:
            logger.info(f"Loading Excel file: {self.excel_file}")
            df = pd.read_excel(self.excel_file)
            logger.info(f"✅ Loaded {len(df)} rows from Excel")
            
            # Normalize column names (strip spaces)
            df.columns = df.columns.str.strip()
            
            # Normalize AC NAME (critical for deduplication)
            if 'AC NAME' in df.columns:
                df['AC NAME'] = df['AC NAME'].apply(self.normalize_text)
            
            # Normalize DISTRICTS
            if 'DISTRICTS' in df.columns:
                df['DISTRICTS'] = df['DISTRICTS'].apply(self.normalize_text)
            
            # Normalize STATE/UT NAME
            if 'STATE/UT NAME' in df.columns:
                df['STATE/UT NAME'] = df['STATE/UT NAME'].apply(self.normalize_text)
            
            # CRITICAL FIX: Resolve AC NAME variants
            # Some AC NO. have multiple spelling variants (e.g., Jewargi vs Jevargi, Homnabad vs Humnabad)
            # We standardize by selecting the most common variant for each AC NO.
            if 'AC NO.' in df.columns and 'AC NAME' in df.columns:
                logger.info("  Resolving AC NAME variants...")
                ac_name_mapping = {}
                for ac_no in df['AC NO.'].unique():
                    ac_names = df[df['AC NO.'] == ac_no]['AC NAME']
                    # Get the most common variant (mode)
                    most_common_name = ac_names.mode()[0] if not ac_names.mode().empty else ac_names.iloc[0]
                    ac_name_mapping[ac_no] = most_common_name
                
                # Apply the standardized naming
                df['AC NAME'] = df['AC NO.'].map(ac_name_mapping)
                logger.info("  AC NAME variants resolved")
            
            return df
            
        except FileNotFoundError:
            logger.error(f"❌ Excel file not found: {self.excel_file}")
            sys.exit(1)
        except Exception as e:
            logger.error(f"❌ Error loading Excel: {e}")
            sys.exit(1)
    
    def validate_data(self, df: pd.DataFrame) -> None:
        """
        Strict data validation. Fails fast on any error.
        """
        logger.info("Validating data...")
        
        # Check required columns exist
        required_cols = ['STATE/UT NAME', 'AC NO.', 'AC NAME', 'DISTRICTS']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            logger.error(f"❌ Missing required columns: {missing_cols}")
            sys.exit(1)
        
        # Validate STATE/UT NAME
        if df['STATE/UT NAME'].isna().any():
            logger.error("❌ Found null values in STATE/UT NAME")
            sys.exit(1)
        
        unique_states = df['STATE/UT NAME'].unique()
        if len(unique_states) != 1 or unique_states[0] != 'Karnataka':
            logger.error(f"❌ Expected only 'Karnataka', found: {unique_states}")
            sys.exit(1)
        
        # Validate DISTRICTS
        if df['DISTRICTS'].isna().any():
            null_count = df['DISTRICTS'].isna().sum()
            logger.error(f"❌ Found {null_count} null values in DISTRICTS")
            sys.exit(1)
        
        # Validate AC NO.
        if df['AC NO.'].isna().any():
            logger.error("❌ Found null values in AC NO.")
            sys.exit(1)
        
        # Validate AC NAME
        if df['AC NAME'].isna().any():
            logger.error("❌ Found null values in AC NAME")
            sys.exit(1)
        
        # Check AC NO. consistency (each AC NO. → exactly ONE AC NAME)
        ac_consistency = df.groupby('AC NO.').agg({
            'AC NAME': lambda x: list(x.unique()),
            'DISTRICTS': lambda x: list(x.unique())
        })
        
        # Check for AC NO. with multiple names
        multiple_names = ac_consistency[ac_consistency['AC NAME'].apply(len) > 1]
        if not multiple_names.empty:
            logger.error("❌ VALIDATION FAILED: Some AC NO. map to multiple AC NAMEs:")
            for ac_no, row in multiple_names.iterrows():
                logger.error(f"  AC NO. {ac_no}: {row['AC NAME']}")
            sys.exit(1)
        
        # Check for AC NO. with multiple districts
        multiple_districts = ac_consistency[ac_consistency['DISTRICTS'].apply(len) > 1]
        if not multiple_districts.empty:
            logger.error("❌ VALIDATION FAILED: Some AC NO. map to multiple DISTRICTs:")
            for ac_no, row in multiple_districts.iterrows():
                logger.error(f"  AC NO. {ac_no}: {row['DISTRICTS']}")
            sys.exit(1)
        
        logger.info("✅ Data validation passed")
    
    def extract_geounits(self, df: pd.DataFrame) -> Dict:
        """
        Extract and deduplicate GeoUnit data.
        
        Returns:
            Dict with 'state', 'districts', and 'constituencies' keys
        """
        logger.info("Extracting GeoUnit data...")
        
        # Extract state
        state = {
            'name': 'Karnataka',
            'code': 'KA',
            'level': 'STATE'
        }
        
        # Extract unique districts
        districts_df = df[['DISTRICTS']].drop_duplicates().sort_values('DISTRICTS')
        districts = []
        for _, row in districts_df.iterrows():
            district_name = row['DISTRICTS']
            districts.append({
                'name': district_name,
                'code': self.generate_district_code(district_name),
                'level': 'DISTRICT'
            })
        
        # Extract unique constituencies
        constituencies_df = df[['AC NO.', 'AC NAME', 'DISTRICTS']].drop_duplicates().sort_values('AC NO.')
        constituencies = []
        for _, row in constituencies_df.iterrows():
            constituencies.append({
                'ac_no': int(row['AC NO.']),
                'name': row['AC NAME'],
                'code': str(int(row['AC NO.'])),  # Code is string representation of AC NO.
                'level': 'CONSTITUENCY',
                'district_name': row['DISTRICTS']
            })
        
        logger.info(f"✅ Extracted: 1 state, {len(districts)} districts, {len(constituencies)} constituencies")
        
        return {
            'state': state,
            'districts': districts,
            'constituencies': constituencies
        }
    
    def insert_or_get_geounit(
        self,
        name: str,
        code: str,
        level: str,
        parent_id: Optional[int]
    ) -> int:
        """
        Insert GeoUnit if not exists, otherwise return existing id.
        Lookup by (code, level) for idempotency.
        
        Returns:
            GeoUnit id (int)
        """
        cursor = self.conn.cursor()
        
        try:
            # Check if exists
            cursor.execute(
                'SELECT id FROM "GeoUnit" WHERE code = %s AND level = %s',
                (code, level)
            )
            result = cursor.fetchone()
            
            if result:
                # Already exists
                return result[0]
            else:
                # Insert new
                cursor.execute(
                    '''
                    INSERT INTO "GeoUnit" (name, code, level, "parentId", "createdAt")
                    VALUES (%s, %s, %s, %s, NOW())
                    RETURNING id
                    ''',
                    (name, code, level, parent_id)
                )
                new_id = cursor.fetchone()[0]
                self.conn.commit()
                return new_id
                
        except Exception as e:
            self.conn.rollback()
            logger.error(f"❌ Error inserting GeoUnit {name}: {e}")
            raise
        finally:
            cursor.close()
    
    def seed_geounits(self, geounits_data: Dict) -> Dict[str, int]:
        """
        Seed GeoUnit data to database.
        
        Returns:
            Dict with counts of created units
        """
        logger.info("Seeding GeoUnit data to database...")
        
        counts = {
            'state': 0,
            'districts': 0,
            'constituencies': 0
        }
        
        # Track district name → id mapping
        district_id_map = {}
        
        try:
            # 1. Insert STATE
            state = geounits_data['state']
            state_id = self.insert_or_get_geounit(
                name=state['name'],
                code=state['code'],
                level=state['level'],
                parent_id=None
            )
            counts['state'] = 1
            logger.info(f"  STATE: {state['name']} (id={state_id}, code={state['code']})")
            
            # 2. Insert DISTRICTS
            for district in geounits_data['districts']:
                district_id = self.insert_or_get_geounit(
                    name=district['name'],
                    code=district['code'],
                    level=district['level'],
                    parent_id=state_id
                )
                district_id_map[district['name']] = district_id
                counts['districts'] += 1
            
            logger.info(f"  ✅ Processed {counts['districts']} districts")
            
            # 3. Insert CONSTITUENCIES
            for constituency in geounits_data['constituencies']:
                parent_district_id = district_id_map[constituency['district_name']]
                
                constituency_id = self.insert_or_get_geounit(
                    name=constituency['name'],
                    code=constituency['code'],
                    level=constituency['level'],
                    parent_id=parent_district_id
                )
                counts['constituencies'] += 1
            
            logger.info(f"  ✅ Processed {counts['constituencies']} constituencies")
            
            return counts
            
        except Exception as e:
            logger.error(f"❌ Error during seeding: {e}")
            self.conn.rollback()
            raise
    
    def run(self) -> None:
        """Main execution flow."""
        try:
            # 1. Connect to database
            self.connect_db()
            
            # 2. Load and normalize Excel data
            df = self.load_and_normalize_excel()
            
            # 3. Validate data strictly
            self.validate_data(df)
            
            # 4. Extract GeoUnit data
            geounits_data = self.extract_geounits(df)
            
            # 5. Seed to database
            counts = self.seed_geounits(geounits_data)
            
            # 6. Report results
            total = counts['state'] + counts['districts'] + counts['constituencies']
            logger.info("\n" + "="*60)
            logger.info("✅ SEEDING COMPLETED SUCCESSFULLY")
            logger.info("="*60)
            logger.info(f"  State:          {counts['state']}")
            logger.info(f"  Districts:      {counts['districts']}")
            logger.info(f"  Constituencies: {counts['constituencies']}")
            logger.info(f"  Total GeoUnits: {total}")
            logger.info("="*60)
            
        except Exception as e:
            logger.error(f"\n❌ SEEDING FAILED: {e}")
            sys.exit(1)
        finally:
            self.close_db()


def main():
    """Entry point."""
    # Load DATABASE_URL from environment
    db_url = os.getenv('DATABASE_URL_PG', "postgresql://politicai_user:Dhanu111@localhost:5432/politicai_dev")
    if not db_url:
        logger.error("❌ DATABASE_URL environment variable not set")
        logger.error("   Please set DATABASE_URL in your .env file or environment")
        sys.exit(1)
    
    # Excel file path
    excel_file = os.path.join(
        os.path.dirname(__file__),
        '..',
        'Election_Data_With_Districts.xlsx'
    )
    
    if not os.path.exists(excel_file):
        logger.error(f"❌ Excel file not found: {excel_file}")
        sys.exit(1)
    
    # Run seeder
    seeder = GeoUnitSeeder(db_url, excel_file)
    seeder.run()


if __name__ == '__main__':
    main()
