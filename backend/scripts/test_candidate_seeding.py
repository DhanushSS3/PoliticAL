#!/usr/bin/env python3
"""
Test script to validate the Candidate seeding logic without database connection.
Tests data loading and candidate extraction only.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import pandas as pd

def test_validation():
    """Test the validation and extraction logic."""
    print("="*60)
    print("Candidate Seeder - Validation Test")
    print("="*60)
    
    # Excel file path
    excel_file = os.path.join(
        os.path.dirname(__file__),
        '..',
        'Election_Data_With_Districts.xlsx'
    )
    
    try:
        # Test 1: Load Excel
        print("\n[Test 1] Loading Excel data...")
        df = pd.read_excel(excel_file)
        df.columns = df.columns.str.strip()
        print(f"[OK] Loaded {len(df)} rows")
        
        # Test 2: Check required columns
        print("\n[Test 2] Checking required columns...")
        required_cols = ['CANDIDATE NAME', 'PARTY', 'SEX', 'AGE', 'CATEGORY']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            print(f"[ERROR] Missing columns: {missing_cols}")
            sys.exit(1)
        print(f"[OK] All required columns present")
        
        # Test 3: Extract unique candidates
        print("\n[Test 3] Extracting unique candidates...")
        # Incorporate cleaning logic from seed_candidates.py
        import re
        def clean_candidate_name(name):
            if pd.isna(name): return name
            name = str(name).strip()
            # 1. Strip leading numeric prefixes
            name = re.sub(r'^\d+\s+', '', name)
            # 2. Normalize NOTA
            if 'NOTA' in name.upper() or 'NONE OF THE ABOVE' in name.upper():
                return 'NOTA'
            return name
            
        print("     Applying name cleaning (stripping prefixes, normalizing NOTA)...")
        df['CANDIDATE NAME'] = df['CANDIDATE NAME'].apply(clean_candidate_name)
        df['PARTY'] = df['PARTY'].str.strip()
        
        # Count raw rows
        print(f"     Total rows: {len(df)}")
        print(f"     Unique candidate names: {df['CANDIDATE NAME'].nunique()}")
        
        # Group by (CANDIDATE NAME, PARTY) - this is how we'll define uniqueness
        unique_candidates = df.groupby(['CANDIDATE NAME', 'PARTY']).size().reset_index(name='count')
        print(f"     Unique (name, party) combinations: {len(unique_candidates)}")
        
        # Test 4: Show sample candidates
        print("\n[Test 4] Sample candidates (first 10):")
        sample_df = df.groupby(['CANDIDATE NAME', 'PARTY']).first().reset_index()
        for i, row in sample_df.head(10).iterrows():
            age = f", age={int(row['AGE'])}" if pd.notna(row['AGE']) else ""
            gender = f", {row['SEX']}" if pd.notna(row['SEX']) else ""
            category = f", {row['CATEGORY']}" if pd.notna(row['CATEGORY']) else ""
            print(f"     {i+1:2d}. {row['CANDIDATE NAME']:<40} ({row['PARTY']}{age}{gender}{category})")
        
        # Test 5: Check for NOTA
        print("\n[Test 5] Checking for NOTA candidates...")
        nota_rows = df[df['CANDIDATE NAME'] == 'NOTA']
        if len(nota_rows) > 0:
            nota_parties = nota_rows['PARTY'].unique()
            print(f"[OK] Found {len(nota_rows)} normalized NOTA rows")
            print(f"     NOTA parties: {list(nota_parties)}")
            # Verify NOTA party is correct
            if 'NOTA' not in nota_parties:
                 print("[WARNING] NOTA candidate not mapped to NOTA party?")
        else:
            print("[WARNING] No NOTA rows found")
        
        # Test 6: Validate data types
        print("\n[Test 6] Validating data quality...")
        null_names = df['CANDIDATE NAME'].isna().sum()
        null_parties = df['PARTY'].isna().sum()
        print(f"     Null candidate names: {null_names}")
        print(f"     Null parties: {null_parties}")
        
        if null_names > 0 or null_parties > 0:
            print("[ERROR] Found null values in critical columns")
            sys.exit(1)
        
        # Test 7: Show candidates with multiple parties
        print("\n[Test 7] Candidates who ran with multiple parties:")
        candidate_party_counts = df.groupby('CANDIDATE NAME')['PARTY'].nunique()
        multi_party = candidate_party_counts[candidate_party_counts > 1]
        if len(multi_party) > 0:
            print(f"     Found {len(multi_party)} candidates with multiple parties")
            for candidate, count in multi_party.head(5).items():
                parties = df[df['CANDIDATE NAME'] == candidate]['PARTY'].unique()
                print(f"     - {candidate}: {list(parties)}")
        else:
            print("     No candidates ran with multiple parties")
        
        print("\n" + "="*60)
        print("[SUCCESS] ALL VALIDATION TESTS PASSED")
        print("="*60)
        print(f"\nReady to seed approximately {len(unique_candidates)} candidates to database.")
        print("Run: python scripts/seed_candidates.py")
        
    except Exception as e:
        print(f"\n[ERROR] TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    test_validation()
