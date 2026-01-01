# Election Result Seeding Script

## Overview
Seeds `ElectionResultRaw` records from Karnataka Assembly election data. This is the final step that connects Elections, GeoUnits, Candidates, and Parties.

## What It Does
- ✅ Maps 8,645 Excel rows to database entities
- ✅ Validates all foreign keys (Election, GeoUnit, Candidate, Party)
- ✅ Validates vote math (General + Postal = Total)
- ✅ Idempotent: safe to run multiple times
- ✅ Fast: Uses caching to avoid N+1 queries (caches 8000+ candidates)

## Prerequisites

1. **All prior seeding scripts must be run**:
   - `seed_geounits.py`
   - `seed_elections.py`
   - `seed_parties.py`
   - `seed_candidates.py`
2. **Database connection**: DATABASE_URL in .env

## Usage

```bash
# Test without database writes
python scripts/test_result_seeding.py

# Run actual seeding
python scripts/seed_results.py
```

## Data Mapping

| Excel Column | Database Field | Lookup Method |
|--------------|----------------|---------------|
| `YEAR` | `electionId` | Lookup by year (ASSEMBLY type) |
| `AC NO.` | `geoUnitId` | Lookup by Constituency Code |
| `CANDIDATE NAME` | `candidateId` | Lookup by (Clean Name, Party ID) |
| `PARTY` | `partyId` | Lookup by Name |
| `GENERAL` | `votesGeneral` | Direct value |
| `POSTAL` | `votesPostal` | Direct value |
| `TOTAL` | `votesTotal` | Direct value |

## Data Quality Issues Found

- **Row 3716**: Vote mismatch (General 849 + Postal 1 != Total 580). Script logs warning but preserves original Total.
- **Candidate Names**: Handled prefix stripping ("1 Name" -> "Name") and NOTA normalization to ensure matches.

## Expected Output

```
[OK] Connected to PostgreSQL database
Loading caches...
  [OK] Cached 3 elections
  [OK] Cached 224 constituencies
  [OK] Cached 154 parties
  [OK] Cached 8039 candidates
Loading Excel file: ../Election_Data_With_Districts.xlsx
[OK] Loaded 8645 rows from Excel
Mapping rows to database IDs...
  Mapped 1000/8645 rows...
  ...
[OK] Successfully mapped 8645 result records
Seeding ElectionResultRaw records to database...
  Processed 1000/8645 results...
  ...
[SUCCESS] RESULT SEEDING COMPLETED
  Results Created: 8642
  Results Reused:  3
  Total Processed: 8645
```

## Verification

### Using SQL
```sql
-- Count total results
SELECT COUNT(*) FROM "ElectionResultRaw";
-- Expected: 8645 (approx)

-- Verify linking
SELECT 
    e.year,
    g.name as constituency,
    p.name as party,
    c."fullName" as candidate,
    r."votesTotal"
FROM "ElectionResultRaw" r
JOIN "Election" e ON r."electionId" = e.id
JOIN "GeoUnit" g ON r."geoUnitId" = g.id
JOIN "Party" p ON r."partyId" = p.id
JOIN "Candidate" c ON r."candidateId" = c.id
LIMIT 10;
```
