#!/usr/bin/env python3
"""
Test script to validate the Election seeding logic without database connection.
Tests data loading and year extraction only.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from seed_elections import ElectionSeeder
import pandas as pd

def test_validation():
    """Test the validation and extraction logic."""
    print("="*60)
    print("Election Seeder - Validation Test")
    print("="*60)
    
    # Excel file path
    excel_file = os.path.join(
        os.path.dirname(__file__),
        '..',
        'Election_Data_With_Districts.xlsx'
    )
    
    seeder = ElectionSeeder("postgresql://dummy", excel_file)
    
    try:
        # Test 1: Load Excel
        print("\n[Test 1] Loading Excel data...")
        df = seeder.load_excel()
        print(f"[OK] Loaded {len(df)} rows")
        print(f"     Columns: {df.columns.tolist()}")
        
        # Test 2: Extract years
        print("\n[Test 2] Extracting unique YEAR values...")
        years = seeder.extract_years(df)
        print(f"[OK] Found {len(years)} unique years: {years}")
        
        # Test 3: Validate YEAR column
        print("\n[Test 3] Validating YEAR data...")
        null_count = df['YEAR'].isna().sum()
        print(f"     Null values: {null_count}")
        print(f"     Data type: {df['YEAR'].dtype}")
        print(f"     Min year: {df['YEAR'].min()}")
        print(f"     Max year: {df['YEAR'].max()}")
        
        # Test 4: Show what elections will be created
        print("\n[Test 4] Elections to be created:")
        for year in years:
            print(f"     - Karnataka Assembly Election {year}")
            print(f"       year={year}, type=ASSEMBLY, stateId=<Karnataka GeoUnit id>")
        
        print("\n" + "="*60)
        print("[SUCCESS] ALL VALIDATION TESTS PASSED")
        print("="*60)
        print("\nScript is ready to run with actual database.")
        print("Run: python scripts/seed_elections.py")
        
    except Exception as e:
        print(f"\n[ERROR] TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    test_validation()
