#!/usr/bin/env python3
"""
Test script to validate Result seeding logic.
Tests ID resolution against actual database.
"""

import sys
import os
import logging
sys.path.insert(0, os.path.dirname(__file__))

from seed_results import ResultSeeder

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_validation():
    print("="*60)
    print("Result Seeder - Validation Test")
    print("="*60)
    
    db_url = os.getenv('DATABASE_URL_PG') or "postgresql://politicai_user:Dhanu111@localhost:5432/politicai_dev"
    excel_file = os.path.join(os.path.dirname(__file__), '..', 'Election_Data_With_Districts.xlsx')
    
    seeder = ResultSeeder(db_url, excel_file)
    
    try:
        # 1. Connect and Load Caches
        seeder.connect_db()
        seeder.load_caches()
        
        # 2. Load Excel
        df = seeder.load_excel()
        
        # 3. Test mapping on first 100 rows
        print("\n[Test] Mapping first 100 rows...")
        sample_df = df.head(100)
        results = seeder.extract_results(sample_df)
        
        print(f"\n[OK] Successfully mapped {len(results)}/100 rows")
        print("Sample result record:")
        print(results[0])
        
        print("\n" + "="*60)
        print("[SUCCESS] VALIDATION PASSED - LOOKUPS WORKING")
        print("="*60)
        
    except Exception as e:
        print(f"\n[ERROR] TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        seeder.close_db()

if __name__ == '__main__':
    test_validation()
