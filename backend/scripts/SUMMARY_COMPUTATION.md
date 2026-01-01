# GeoElectionSummary Computation Script

## Overview
Computes constituency-level election summaries (Winner, Margin, Turnout) by aggregating `ElectionResultRaw` data. This prepares the data for Dashboard consumption.

## What It Does
- ✅ Aggregates 8,642 raw vote records
- ✅ Computes for **671 constituency-election pairs**:
  - **Winner**: Candidate with max votes
  - **Runner-up**: Candidate with 2nd highest votes
  - **Margin**: (Winner - Runner-up)
  - **Turnout %**: (Total Votes / Total Electors)
- ✅ Seeds `GeoElectionSummary` table
- ✅ Handles missing `Total Electors` by looking up original Excel file

## Prerequisites

1. **All seeding scripts must be run**:
   - `seed_geounits.py`
   - `seed_results.py`
2. **Database connection**: DATABASE_URL in .env

## Usage

```bash
python scripts/compute_summaries.py
```

## Logic

| Metric | Source / Logic |
|--------|----------------|
| `totalVotesCast` | SUM(ElectionResultRaw.votesTotal) |
| `totalElectors` | Lookup from Excel by (Year, AC NO) |
| `turnoutPercent` | (totalVotesCast / totalElectors) * 100 |
| `winningCandidate` | Candidate Name with MAX(votes) |
| `winningMargin` | Winner Votes - RunnerUp Votes |
| `winningMarginPct` | (Margin / totalVotesCast) * 100 |

## Verification

### Using Prisma Studio
Navigate to `GeoElectionSummary`. You should see 671 records.
Check fields `winningCandidate`, `winningParty`, `winningMargin` are populated.

### Using SQL
```sql
-- View computed summaries
SELECT 
    e.year,
    g.name as constituency,
    s."winningParty",
    s."winningCandidate",
    s."winningMargin",
    s."turnoutPercent"
FROM "GeoElectionSummary" s
JOIN "Election" e ON s."electionId" = e.id
JOIN "GeoUnit" g ON s."geoUnitId" = g.id
ORDER BY e.year, s."winningMargin" ASC
LIMIT 10;
```

## Expected Output

```
[OK] Connected to PostgreSQL database
Loading Excel for Total Electors map...
[OK] Loaded 671 elector counts
[OK] Loaded ID maps
Fetching raw results from database...
[OK] Fetched 8642 raw result records
Computing summaries and seeding...
============================================================
SUMMARY COMPUTATION COMPLETE
  Created: 671
  Skipped: 0
  Errors:  0
============================================================
```
