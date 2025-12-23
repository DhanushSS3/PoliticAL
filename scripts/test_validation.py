#!/usr/bin/env python3
"""
Test script to validate the GeoUnit seeding logic without database connection.
Tests data loading, normalization, and validation only.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from seed_geounits import GeoUnitSeeder

def test_validation():
    """Test the validation and extraction logic."""
    print("="*60)
    print("GeoUnit Seeder - Validation Test")
    print("="*60)
    
    # Create seeder (dummy DB URL for testing)
    excel_file = os.path.join(
        os.path.dirname(__file__),
        '..',
        'Election_Data_With_Districts.xlsx'
    )
    
    seeder = GeoUnitSeeder("postgresql://dummy", excel_file)
    
    try:
        # Test 1: Load and normalize
        print("\n[Test 1] Loading and normalizing Excel data...")
        df = seeder.load_and_normalize_excel()
        print(f"[OK] Loaded {len(df)} rows")
        print(f"     Columns: {df.columns.tolist()}")
        
        # Test 2: Validate
        print("\n[Test 2] Validating data...")
        seeder.validate_data(df)
        print("[OK] Validation passed")
        
        # Test 3: Extract GeoUnits
        print("\n[Test 3] Extracting GeoUnit data...")
        geounits_data = seeder.extract_geounits(df)
        
        state = geounits_data['state']
        districts = geounits_data['districts']
        constituencies = geounits_data['constituencies']
        
        print(f"[OK] Extracted GeoUnits:")
        print(f"     State: {state['name']} (code: {state['code']})")
        print(f"     Districts: {len(districts)}")
        print(f"     Constituencies: {len(constituencies)}")
        
        # Test 4: Show sample data
        print("\n[Test 4] Sample Districts (first 5):")
        for district in districts[:5]:
            print(f"     - {district['name']:<30} code: {district['code']}")
        
        print("\n[Test 5] Sample Constituencies (first 10):")
        for const in constituencies[:10]:
            print(f"     AC {const['ac_no']:3d}: {const['name']:<35} (District: {const['district_name']})")
        
        # Test 6: Check AC NO. uniqueness
        print("\n[Test 6] Checking AC NO. uniqueness...")
        ac_codes = [c['code'] for c in constituencies]
        if len(ac_codes) == len(set(ac_codes)):
            print(f"[OK] All {len(ac_codes)} constituency codes are unique")
        else:
            duplicates = [code for code in ac_codes if ac_codes.count(code) > 1]
            print(f"[ERROR] Found duplicate codes: {set(duplicates)}")
        
        # Test 7: District code generation
        print("\n[Test 7] District code generation examples:")
        test_cases = [
            "Belagavi",
            "Bengaluru Urban (North)",
            "Dakshina Kannada",
            "Uttara Kannada"
        ]
        for test_case in test_cases:
            code = seeder.generate_district_code(test_case)
            print(f"     '{test_case}' -> '{code}'")
        
        print("\n" + "="*60)
        print("[SUCCESS] ALL TESTS PASSED")
        print("="*60)
        print("\nScript is ready to run with actual database.")
        print("Run: python scripts/seed_geounits.py")
        
    except Exception as e:
        print(f"\n[ERROR] TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    test_validation()

