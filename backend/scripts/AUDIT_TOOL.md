# Election Data Audit Tool

## Overview
A diagnostic script to verify the completeness and quality of the seeded election data.

## features
- ✅ Checks for missing (Election × Constituency) pairs
- ✅ Validates data logic (Turnout > 100%, Zero Votes)
- ✅ Generates CSV report for further analysis

## Usage

```bash
python scripts/audit_election_data.py
```

## Audit Results (Example)

```
[OK] Connected to PostgreSQL database
Metadata: 3 elections, 224 constituencies
Running audit...
Checking 672 combinations...
============================================================
AUDIT COMPLETE
  Total Expected: 672
  Total Found:    671
  Missing:        1
  Anomalies:      0
============================================================
Top 5 Issues Found:
  - MISSING_SUMMARY: Jayanagar (Karnataka Assembly 2018)
```

## Known Issues

### Jayanagar (2018) Missing
The audit correctly identifies that `Jayanagar` is missing for the `2018` election.
**Reason**: The election in Jayanagar was countermanded (postponed) in May 2018 due to the death of the BJP candidate. It was held later in June 2018. The source Excel file likely contains only the main election results from May 2018.

**Action**: No action needed. This is accurate historical data behavior.

## Output
The script generates `election_audit_report.csv`:
```csv
electionId,electionName,constituencyId,constituencyName,issueType
2,Karnataka Assembly 2018,172,Jayanagar,MISSING_SUMMARY
```
