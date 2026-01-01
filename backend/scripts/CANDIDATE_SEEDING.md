# Candidate Seeding Script

## Overview
Seeds Candidate records from Karnataka Assembly election data.

## What It Does
- ✅ Extracts unique CANDIDATE records
- ✅ Links candidates to Party records (lookup by name)
- ✅ Handles data cleaning:
  - **Strips numeric prefixes** (e.g. "1 A C Srinivasa" -> "A C Srinivasa")
  - **Normalizes NOTA** (e.g. "4 Nota", "None of the Above" -> "NOTA")
- ✅ Idempotent: reuses existing candidates if found (name + party match)
- ✅ Captures metadata: Gender, Age, Category

## Prerequisites

1. **Party records seeded**: Run `seed_parties.py` first
2. **Database connection**: DATABASE_URL in .env
3. **Python dependencies**: Already installed

## Usage

```bash
# Test without database
python scripts/test_candidate_seeding.py

# Run actual seeding
python scripts/seed_candidates.py
```

## Normalization Logic

The script applies the following cleaning to `CANDIDATE NAME`:
1. Strips leading digits + space (ballot numbers)
   - `1 John Doe` -> `John Doe`
2. Normalizes NOTA variants
   - `4 Nota` -> `NOTA`
   - `None of the Above` -> `NOTA`
   - `5 Nota` -> `NOTA`

## Duplication Strategy

A candidate is considered unique by the combination of:
- **Full Name** (cleaned)
- **Party ID**

If a candidate runs in 2013 and 2018 for the same party, they are reused.
If they change parties, a new Candidate record is created (as per schema design).

## Expected Output (Sample)

```
[OK] Connected to PostgreSQL database
[OK] Loaded 154 parties into cache
Loading Excel file: ../Election_Data_With_Districts.xlsx
[OK] Loaded 8645 rows from Excel
Extracting unique CANDIDATE records...
  Cleaning candidate names (removing prefixes, normalizing NOTA)...
  Mapping parties to IDs...
[OK] Found ~7800 unique candidates
  Special: Found 1 NOTA candidate entries
Seeding Candidate records to database...
  [CREATED] Jolle Shashikala Annasaheb (BJP, age=44, GENERAL) id=1
  [CREATED] NOTA (NOTA, age=None, None) id=15
  ...
[SUCCESS] CANDIDATE SEEDING COMPLETED
```

## Verification

### Using Prisma Studio
```bash
npm run prisma:studio
```

Navigate to `Candidate` table:
- Check for clean names (no "1 ", "2 " prefixes)
- Check for single "NOTA" candidate (linked to NOTA party)

### Using SQL
```sql
-- Check NOTA
SELECT * FROM "Candidate" WHERE "fullName" = 'NOTA';

-- Check top parties by candidate count
SELECT p.name, COUNT(c.id) 
FROM "Candidate" c
JOIN "Party" p ON c."partyId" = p.id
GROUP BY p.name
ORDER BY COUNT(c.id) DESC
LIMIT 10;
```
