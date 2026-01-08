# 🚀 Quick Start Guide - PoliticAI Sentiment System

## Start Both Services

### Terminal 1: Start Python NLP Service
```bash
cd C:\Users\user\movies\PoliticAI\analysis-service
venv\Scripts\activate
uvicorn app.main:app --reload
```
**Expected**: `INFO: Application startup complete.`

### Terminal 2: Start Node.js Backend
```bash
cd C:\Users\user\movies\PoliticAI\backend
npm run start:dev
```
**Expected**: `Nest application successfully started` 

---

## Test the System

### 1. Manual Trigger (Quick Test)
```bash
cd C:\Users\user\movies\PoliticAI\backend
npx ts-node src/scripts/trigger-ingestion.ts
```

**Look for**:
```
✅ Sentiment stored for article #X across 1 GeoUnit(s)
```

**NOT**:
```
⚠️ No GeoUnit linked for article #X
```

### 2. Check Sentiment Signals in Database
```bash
npx prisma studio
```
Navigate to `SentimentSignal` table → should see new rows!

---

## API Endpoints (Available Now)

### Get News Feed
```http
GET http://localhost:3000/api/news
```

### Trigger Manual Ingestion (Admin Only)
```http
POST http://localhost:3000/api/admin/news/ingest-google
Headers: Authorization: Bearer <SESSION_TOKEN>
```

---

## Cron Schedule (Automatic)

| Job | Schedule | What it does |
|-----|----------|--------------|
| **News Ingestion** | Every hour | Fetches latest news from Google |

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/modules/news/services/geo-attribution-resolver.service.ts` | ✨ Fixes missing geo |
| `backend/src/modules/news/services/sentiment-analysis.service.ts` | Calls Python NLP |
| `backend/IMPLEMENTATION_PLAN.md` | Next steps roadmap |
| `COMPLETE_SYSTEM_SUMMARY.md` | Full documentation |

---

## Troubleshooting

### Problem: "No sentiment signals stored"
**Fix**: Check if:
1. Python service is running (port 8000)
2. CandidateProfiles are seeded (run `seed-candidate-profiles.ts`)
3. Karnataka state exists in GeoUnit table

### Problem: "Duplicate candidates"
**Fix**: Run `seed-candidate-profiles.ts` with `skipDuplicates: true`

### Problem: "Lint error: candidateProfile not found"
**Fix**: Run `npx prisma generate` to regenerate Prisma Client

---

## Phase 2 Preview (Coming Next)

### Analytics Endpoints (To be built)
```http
GET /api/analytics/candidate/:id/pulse
GET /api/analytics/constituency/:geoId/comparison
```

### Alert System (To be built)
- Sentiment spike detection
- Negative surge alerts
- High-confidence warnings

---

## Quick Commands Cheat Sheet

```bash
# Regenerate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed candidates
npx ts-node src/scripts/seed-candidate-profiles.ts

# Trigger ingestion
npx ts-node src/scripts/trigger-ingestion.ts

# View database
npx prisma studio
```

---

**Status**: ✅ System Operational
**Last Updated**: Phase 1 Complete
