# GeoUnit Data Seeding Scripts

## Overview
This directory contains scripts to seed geographical reference data into the PoliticAI database.

## Scripts

### `seed_geounits.py`
Seeds GeoUnit data (State, Districts, Constituencies) from Karnataka Assembly election Excel file.

**What it does:**
- ✅ Extracts and validates geographical data from Excel
- ✅ Normalizes inconsistent data (spacing, casing)
- ✅ Creates hierarchical GeoUnit records (STATE → DISTRICT → CONSTITUENCY)
- ✅ Idempotent: safe to run multiple times
- ✅ Fail-fast validation with clear error messages

**What it does NOT do:**
- ❌ Does NOT seed candidates, parties, or election results
- ❌ Does NOT create any API endpoints
- ❌ Does NOT modify existing GeoUnit records

---

## Prerequisites

### 1. Database Setup
Ensure PostgreSQL is running and the database is migrated:

```bash
# Create migration (if not done already)
npx prisma migrate dev --name init

# Verify database schema
npx prisma studio
```

### 2. Python Environment
Python 3.8+ required.

Install dependencies:

```bash
# Navigate to scripts directory
cd scripts

# Install required packages
pip install -r requirements.txt
```

### 3. Environment Configuration
Ensure `.env` file exists in project root with `DATABASE_URL`:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/politicai_dev?schema=public"
```

### 4. Excel File
Ensure `Election_Data_With_Districts.xlsx` is in project root.

---

## Usage

### Run the Script

```bash
# From project root
python scripts/seed_geounits.py
```

**Expected Output:**
```
2025-12-23 14:05:00 - INFO - Loading Excel file: ../Election_Data_With_Districts.xlsx
2025-12-23 14:05:01 - INFO - ✅ Loaded 8645 rows from Excel
2025-12-23 14:05:01 - INFO - Validating data...
2025-12-23 14:05:01 - INFO - ✅ Data validation passed
2025-12-23 14:05:01 - INFO - Extracting GeoUnit data...
2025-12-23 14:05:01 - INFO - ✅ Extracted: 1 state, 31 districts, 224 constituencies
2025-12-23 14:05:01 - INFO - Seeding GeoUnit data to database...
2025-12-23 14:05:01 - INFO -   STATE: Karnataka (id=1, code=KA)
2025-12-23 14:05:02 - INFO -   ✅ Processed 31 districts
2025-12-23 14:05:03 - INFO -   ✅ Processed 224 constituencies
2025-12-23 14:05:03 - INFO - 
============================================================
2025-12-23 14:05:03 - INFO - ✅ SEEDING COMPLETED SUCCESSFULLY
2025-12-23 14:05:03 - INFO - ============================================================
2025-12-23 14:05:03 - INFO -   State:          1
2025-12-23 14:05:03 - INFO -   Districts:      31
2025-12-23 14:05:03 - INFO -   Constituencies: 224
2025-12-23 14:05:03 - INFO -   Total GeoUnits: 256
2025-12-23 14:05:03 - INFO - ============================================================
```

---

## Verification

### 1. Using Prisma Studio (Recommended)

```bash
# Open Prisma Studio
npm run prisma:studio
```

Navigate to the `GeoUnit` table:
- **Expected records**: 256 total
  - 1 STATE (Karnataka, code="KA", parentId=null)
  - 31 DISTRICT (parent=Karnataka)
  - 224 CONSTITUENCY (parent=District)

### 2. Using SQL Queries

```sql
-- Count by level
SELECT level, COUNT(*) FROM "GeoUnit" GROUP BY level;
-- Expected: STATE=1, DISTRICT=31, CONSTITUENCY=224

-- Verify hierarchy (root state)
SELECT * FROM "GeoUnit" WHERE "parentId" IS NULL;
-- Expected: 1 row (Karnataka)

-- Sample districts
SELECT id, name, code, level FROM "GeoUnit" WHERE level = 'DISTRICT' LIMIT 5;

-- Sample constituencies with parent info
SELECT 
    c.id, c.name, c.code,
    d.name as district_name
FROM "GeoUnit" c
JOIN "GeoUnit" d ON c."parentId" = d.id
WHERE c.level = 'CONSTITUENCY'
LIMIT 10;
```

---

## How It Works

### 1. Data Normalization
The script normalizes inconsistent data in the Excel file:

**Problem**: Same AC NO. with different AC NAMEs due to spacing/casing:
- "Kudachi (SC)" vs "Kudachi  (SC)" (extra space)
- "Saundatti Yellamma" vs "Saundatti yellamma" (different case)

**Solution**: Normalize by:
- Trimming whitespace
- Collapsing multiple spaces to single space
- Consistent formatting

### 2. Code Generation Rules

**STATE**:
- name: "Karnataka"
- code: "KA"

**DISTRICT**:
- name: from DISTRICTS column
- code: UPPERCASE with spaces → underscores
  - "Belagavi" → "BELAGAVI"
  - "Bengaluru Urban (North)" → "BENGALURU_URBAN_NORTH"

**CONSTITUENCY**:
- name: AC NAME (normalized)
- code: string value of AC NO.
  - AC NO. 1 → code = "1"

### 3. Idempotency
The script is safe to run multiple times:
- Checks if GeoUnit exists by `(code, level)` before inserting
- Reuses existing records if found
- Only inserts new records when needed

### 4. Validation Rules
Strict validation with fail-fast behavior:
- ✅ All rows must have STATE = "Karnataka"
- ✅ No null values in DISTRICTS, AC NO., AC NAME
- ✅ Each AC NO. must map to exactly ONE AC NAME (after normalization)
- ✅ Each AC NO. must map to exactly ONE DISTRICT

---

## Troubleshooting

### Error: "DATABASE_URL environment variable not set"
**Solution**: Create `.env` file with DATABASE_URL or set environment variable

### Error: "Excel file not found"
**Solution**: Ensure `Election_Data_With_Districts.xlsx` is in project root

### Error: "Can't reach database server"
**Solution**: 
- Check PostgreSQL is running
- Verify DATABASE_URL credentials
- Test connection: `psql -U username -d politicai_dev`

### Error: "relation 'GeoUnit' does not exist"
**Solution**: Run Prisma migration first:
```bash
npx prisma migrate dev --name init
```

### Error: "VALIDATION FAILED: AC NO. X maps to multiple names"
**Solution**: This indicates normalization failed. Check the error message for specific AC NO. and report as a bug.

---

## Next Steps

After successfully seeding GeoUnits:

1. **Seed Party data** (create separate script)
2. **Seed Candidate data** (create separate script)
3. **Seed Election and ElectionResultRaw** (create separate script)
4. **Run aggregation job** to populate GeoElectionSummary
5. **Build REST APIs** for frontend consumption

---

## Safety Notes

✅ **Safe to run multiple times** - idempotent design  
✅ **Read-only Excel access** - does not modify source file  
✅ **Transaction-based** - database changes are atomic  
✅ **Fail-fast validation** - stops on first error  

❌ **Does NOT delete existing data**  
❌ **Does NOT update existing GeoUnit records**  
❌ **Does NOT seed candidate/party/election data**
