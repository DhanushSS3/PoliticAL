# Election Seeding Script

## Overview
Seeds Election records from Karnataka Assembly election data.

## What It Does
- ✅ Extracts unique YEAR values from Excel (2013, 2018, 2023)
- ✅ Creates Election records with:
  - `year`: from YEAR column
  - `type`: ASSEMBLY (Karnataka Assembly Elections)
  - `stateId`: GeoUnit id for Karnataka (code=KA, level=STATE)
- ✅ Idempotent: reuses existing elections if found
- ✅ Validates Karnataka GeoUnit exists before proceeding

## Prerequisites

1. **GeoUnits seeded**: Run `seed_geounits.py` first
2. **Database connection**: DATABASE_URL in .env
3. **Python dependencies**: Already installed from seed_geounits.py

## Usage

```bash
# Test without database
python scripts/test_election_seeding.py

# Run actual seeding
python scripts/seed_elections.py
```

## Expected Output

```
[OK] Connected to PostgreSQL database
Loading Excel file: ../Election_Data_With_Districts.xlsx
[OK] Loaded 8645 rows from Excel
Extracting unique YEAR values...
[OK] Found 3 unique years: [2013, 2018, 2023]
Seeding Election records to database...
  Found Karnataka GeoUnit (id=1)
  [CREATED] Karnataka Assembly Election 2013 (id=1)
  [CREATED] Karnataka Assembly Election 2018 (id=2)
  [CREATED] Karnataka Assembly Election 2023 (id=3)

============================================================
[SUCCESS] ELECTION SEEDING COMPLETED
============================================================
  Elections Created: 3
  Elections Reused:  0
  Total Processed:   3
============================================================
```

## Verification

### Using Prisma Studio
```bash
npm run prisma:studio
```

Navigate to `Election` table:
- **Expected records**: 3
- **Records**:
  - id=1, year=2013, type=ASSEMBLY, stateId=1
  - id=2, year=2018, type=ASSEMBLY, stateId=1
  - id=3, year=2023, type=ASSEMBLY, stateId=1

### Using SQL
```sql
-- View all elections
SELECT * FROM "Election" ORDER BY year;

-- Verify with state information
SELECT 
    e.id,
    e.year,
    e.type,
    g.name as state_name,
    g.code as state_code
FROM "Election" e
LEFT JOIN "GeoUnit" g ON e."stateId" = g.id;
```

## Idempotency

The script is safe to run multiple times:
- First run: Creates 3 new Election records
- Subsequent runs: Reuses existing 3 records, creates 0 new

Lookup logic: `(year, type, stateId)`

## Error Handling

### Error: "Karnataka GeoUnit not found"
**Solution**: Run `seed_geounits.py` first

### Error: "YEAR column not found"
**Solution**: Ensure Excel file has YEAR column

### Error: "Invalid YEAR values"
**Solution**: Check YEAR column contains valid integers

## Next Steps

After seeding elections:
1. Seed Party data
2. Seed Candidate data  
3. Seed ElectionResultRaw data
