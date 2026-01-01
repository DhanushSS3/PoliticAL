# Party Seeding Script

## Overview
Seeds Party records from Karnataka Assembly election data with proper NOTA and Independent handling.

## What It Does
- ✅ Extracts unique PARTY values from Excel (**154 parties found**)
- ✅ Creates Party records with:
  - `name`: from PARTY column
  - `symbol`: from SYMBOL column (if available)
  - `colorHex`: NULL (can be set later)
- ✅ Idempotent: reuses existing parties if found (lookup by name)
- ✅ Handles special cases:
  - **NOTA**: 1 entry
  - **IND** (Independent): 1 entry
- ✅ Proper .env loading from parent directory

## .env File Loading Fix

The script now correctly loads `.env` from the root directory using:

```python
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)
```

**Result**: ✅ DATABASE_URL found: True

## Prerequisites

1. **Database connection**: DATABASE_URL in .env (root folder)
2. **Python dependencies**: Already installed from previous scripts

## Usage

```bash
# Test without database
python scripts/test_party_seeding.py

# Run actual seeding
python scripts/seed_parties.py
```

## Test Results

```
[OK] Found 154 unique parties

First 10 parties:
  1. AAAP, symbol='Broom'
  2. ABHM, symbol=None
  3. ABML(S), symbol=None
  ...

Special cases:
  NOTA entries: 1
    - NOTA
  Independent entries: 1
    - IND

[SUCCESS] ALL VALIDATION TESTS PASSED
```

## Expected Output (Actual Run)

```
[OK] Using DATABASE_URL from environment
[OK] Connected to PostgreSQL database
Loading Excel file: ../Election_Data_With_Districts.xlsx
[OK] Loaded 8645 rows from Excel
Extracting unique PARTY values...
[OK] Found 154 unique parties
  Special: Found 1 NOTA entries
  Special: Found 1 Independent entries
Seeding Party records to database...
  [CREATED] AAAP (id=1, symbol='Broom')
  [CREATED] ABHM (id=2)
  ...
  [CREATED] NOTA (id=153)
  [CREATED] IND (id=154)

============================================================
[SUCCESS] PARTY SEEDING COMPLETED
============================================================
  Parties Created:   154
  Parties Reused:    0
  Total Processed:   154
  - NOTA entries:    1
  - Independent:     1
============================================================
```

## Verification

### Using Prisma Studio
```bash
npm run prisma:studio
```

Navigate to `Party` table:
- **Expected records**: 154
- **Special entries**: NOTA, IND

### Using SQL
```sql
-- View all parties
SELECT * FROM "Party" ORDER BY name LIMIT 20;

-- Count parties
SELECT COUNT(*) FROM "Party";
-- Expected: 154

-- Find NOTA
SELECT * FROM "Party" WHERE name = 'NOTA';

-- Find Independent
SELECT * FROM "Party" WHERE name = 'IND';

-- Parties with symbols
SELECT name, symbol FROM "Party" WHERE symbol IS NOT NULL ORDER BY name;
```

## Idempotency

The script is safe to run multiple times:
- First run: Creates 154 new Party records
- Subsequent runs: Reuses existing 154 records, creates 0 new

Lookup logic: `name` (case-sensitive)

## Fallback Database URL

If DATABASE_URL is not found in environment:
```python
db_url = "postgresql://politicai_user:Dhanu111@localhost:5432/politicai_dev"
```

## Next Steps

After seeding parties:
1. Seed Candidate data (links to Party via partyId)
2. Seed ElectionResultRaw data (links to Party and Candidate)
