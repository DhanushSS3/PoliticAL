#!/usr/bin/env python3
"""
Test script to validate the Party seeding logic without database connection.
Tests data loading and party extraction only.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from seed_parties import PartySeeder
import pandas as pd

def test_validation():
    """Test the validation and extraction logic."""
    print("="*60)
    print("Party Seeder - Validation Test")
    print("="*60)
    
    # Excel file path
    excel_file = os.path.join(
        os.path.dirname(__file__),
        '..',
        'Election_Data_With_Districts.xlsx'
    )
    
    seeder = PartySeeder("postgresql://dummy", excel_file)
    
    try:
        # Test 1: Load Excel
        print("\n[Test 1] Loading Excel data...")
        df = seeder.load_excel()
        print(f"[OK] Loaded {len(df)} rows")
        
        # Test 2: Extract parties
        print("\n[Test 2] Extracting unique PARTY values...")
        parties = seeder.extract_parties(df)
        print(f"[OK] Found {len(parties)} unique parties")
        
        # Test 3: Show first 10 parties
        print("\n[Test 3] First 10 parties:")
        for i, party in enumerate(parties[:10], 1):
            symbol = f", symbol='{party['symbol']}'" if party['symbol'] else ", symbol=None"
            print(f"     {i:2d}. {party['name']:<40} {symbol}")
        
        # Test 4: Show special cases
        print("\n[Test 4] Special cases:")
        
        # NOTA
        nota_parties = [p for p in parties if 'NOTA' in p['name'].upper()]
        print(f"     NOTA entries: {len(nota_parties)}")
        for party in nota_parties:
            print(f"       - {party['name']}")
        
        # Independent
        ind_parties = [p for p in parties if p['name'].upper() == 'IND' or 'INDEPENDENT' in p['name'].upper()]
        print(f"     Independent entries: {len(ind_parties)}")
        for party in ind_parties:
            print(f"       - {party['name']}")
        
        # Test 5: Validate PARTY column
        print("\n[Test 5] Validating PARTY data...")
        null_count = df['PARTY'].isna().sum()
        print(f"     Null values: {null_count}")
        print(f"     Total unique parties in raw data: {df['PARTY'].nunique()}")
        
        # Test 6: Show last 10 parties (alphabetically)
        print("\n[Test 6] Last 10 parties (alphabetically):")
        for i, party in enumerate(parties[-10:], len(parties)-9):
            symbol = f", symbol='{party['symbol']}'" if party['symbol'] else ", symbol=None"
            print(f"     {i:2d}. {party['name']:<40} {symbol}")
        
        print("\n" + "="*60)
        print("[SUCCESS] ALL VALIDATION TESTS PASSED")
        print("="*60)
        print(f"\nReady to seed {len(parties)} parties to database.")
        print("Run: python scripts/seed_parties.py")
        
    except Exception as e:
        print(f"\n[ERROR] TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    test_validation()
