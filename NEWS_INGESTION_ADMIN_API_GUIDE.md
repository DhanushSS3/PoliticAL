# News Ingestion Admin API Guide

## 🔑 Authentication

All admin endpoints require authentication with an admin token:

```bash
Authorization: Bearer YOUR_ADMIN_TOKEN
```

---

## 📊 Queue Statistics

### Get Queue Stats
**Endpoint**: `GET /api/v1/admin/news-queue/stats`

**Description**: View current queue status, jobs waiting, active, completed, and failed.

**Example**:
```bash
curl http://localhost:3000/api/v1/admin/news-queue/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "googleNews": {
      "waiting": 45,
      "active": 3,
      "completed": 1250,
      "failed": 12
    },
    "rssFeed": {
      "waiting": 0,
      "active": 1,
      "completed": 89,
      "failed": 2
    }
  }
}
```

---

## 🚀 Manual Triggers

### 1. Trigger Google News for All Active Entities
**Endpoint**: `POST /api/v1/admin/news-queue/trigger/google-news-all`

**Description**: Schedules Google News ingestion for ALL active entities (candidates, parties, constituencies).

**Example**:
```bash
curl -X POST http://localhost:3000/api/v1/admin/news-queue/trigger/google-news-all \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "message": "Google News ingestion scheduled for all active entities"
}
```

**What happens**:
- Queries database for all active entities
- Adds jobs to queue for each entity
- Workers process asynchronously
- Check queue stats to see progress

---

### 2. Trigger Google News for Specific Entity
**Endpoint**: `POST /api/v1/admin/news-queue/trigger/google-news/:entityType/:entityId`

**Description**: Trigger Google News ingestion for a specific entity.

**Parameters**:
- `entityType`: CANDIDATE, PARTY, or GEO_UNIT
- `entityId`: Numeric ID of the entity

**Example - Trigger for Candidate #123**:
```bash
curl -X POST http://localhost:3000/api/v1/admin/news-queue/trigger/google-news/CANDIDATE/123 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Example - Trigger for Party #5**:
```bash
curl -X POST http://localhost:3000/api/v1/admin/news-queue/trigger/google-news/PARTY/5 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "message": "Google News ingestion triggered for CANDIDATE #123"
}
```

---

### 3. Trigger RSS Feed Ingestion
**Endpoint**: `POST /api/v1/admin/news-queue/trigger/rss-feeds`

**Description**: Trigger RSS feed ingestion from all Bangalore news sources (The Hindu, TOI, TNIE, OneIndia, Citizen Matters).

**Example**:
```bash
curl -X POST http://localhost:3000/api/v1/admin/news-queue/trigger/rss-feeds \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "message": "RSS feed ingestion triggered"
}
```

**What happens**:
- Fetches from all 5 RSS sources
- Filters articles by age (< 48 hours)
- Links articles to entities
- Triggers sentiment analysis

---

## 🧪 Testing Workflow

### Step 1: Check Initial Queue Status
```bash
curl http://localhost:3000/api/v1/admin/news-queue/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Expected: All counts should be 0 initially.

---

### Step 2: Trigger RSS Feed Ingestion (Fastest Test)
```bash
curl -X POST http://localhost:3000/api/v1/admin/news-queue/trigger/rss-feeds \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

### Step 3: Check Queue Stats Again
```bash
curl http://localhost:3000/api/v1/admin/news-queue/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Expected:
```json
{
  "rssFeed": {
    "waiting": 1,    // Job added
    "active": 1,     // Worker processing
    "completed": 0,
    "failed": 0
  }
}
```

---

### Step 4: Wait 30 seconds, Check Again
```bash
curl http://localhost:3000/api/v1/admin/news-queue/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Expected:
```json
{
  "rssFeed": {
    "waiting": 0,
    "active": 0,
    "completed": 1,  // Job completed!
    "failed": 0
  }
}
```

---

### Step 5: Trigger Google News for All Entities
```bash
curl -X POST http://localhost:3000/api/v1/admin/news-queue/trigger/google-news-all \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

### Step 6: Monitor Progress
```bash
# Check every 10 seconds
curl http://localhost:3000/api/v1/admin/news-queue/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

You'll see:
- `waiting` count decrease
- `active` count (max 3 concurrent)
- `completed` count increase

---

## 📝 Backend Logs to Watch

When you trigger ingestion, watch your backend terminal for:

### RSS Feed Worker Logs
```
[RssFeedWorker] Job 1 is now active
[RssFeedIngestionService] Starting RSS feed ingestion from 5 sources...
[RssFeedIngestionService] Fetching from The Hindu - Bangalore...
[RssFeedIngestionService] The Hindu - Bangalore: Processed 15, Skipped (old: 3, duplicate: 2)
[RssFeedIngestionService] Fetching from Times of India - Bangalore...
[RssFeedWorker] Job 1 completed successfully
```

### Google News Worker Logs
```
[GoogleNewsWorker] Job 2 is now active
[GoogleNewsWorker] Processing Google News job for CANDIDATE #123 (priority: 8)
[NewsIngestionService] Fetching news for CANDIDATE #123 using query: Siddaramaiah
[NewsIngestionService] Ingested article: "Siddaramaiah announces new scheme" for CANDIDATE #123
[GoogleNewsWorker] ✅ Completed Google News job for CANDIDATE #123
```

### Age Filtering Logs (Debug)
```
[NewsIngestionService] Skipping old article (72.5h old): "Old news from 3 days ago"
[RssFeedIngestionService] Skipping old article (96.2h old): "Article from last week"
```

---

## 🔄 Automatic Cron Schedule

Once running, the system automatically triggers:

### Google News Ingestion
- **Frequency**: Every 30 minutes
- **Cron**: `*/30 * * * *`
- **What it does**: Fetches news for all active entities

### RSS Feed Ingestion
- **Frequency**: Every 2 hours
- **Cron**: `0 */2 * * *`
- **What it does**: Fetches from all 5 Bangalore sources

**You don't need to manually trigger after initial setup!**

---

## 🐛 Troubleshooting

### Issue: Queue stats show all zeros
**Cause**: Workers not registered or Redis not connected

**Solution**:
1. Check backend logs for:
   ```
   [GoogleNewsWorker] Worker registered
   [RssFeedWorker] Worker registered
   ```
2. If missing, restart backend:
   ```bash
   # Stop backend (Ctrl+C)
   npm run start:dev
   ```

---

### Issue: Jobs stuck in "waiting"
**Cause**: Workers not processing

**Solution**:
1. Check Redis is running:
   ```bash
   docker ps  # Should show nammapulse-redis
   ```
2. Check backend logs for errors
3. Restart backend

---

### Issue: All jobs failing
**Cause**: Network issues, rate limiting, or configuration error

**Solution**:
1. Check backend logs for error messages
2. Look for "Rate limited (503)" messages
3. If rate limited, wait 5 minutes and try again
4. Check `.env` has correct configuration

---

## 📊 Understanding Queue Metrics

### Waiting
- Jobs added to queue but not yet started
- Normal to see this number fluctuate

### Active
- Jobs currently being processed by workers
- Max: 3 for Google News, 2 for RSS Feeds

### Completed
- Successfully processed jobs
- This number should keep increasing

### Failed
- Jobs that failed after 3 retry attempts
- Check logs to see why they failed

---

## 🎯 Quick Commands (Copy-Paste Ready)

### Get Stats
```bash
curl http://localhost:3000/api/v1/admin/news-queue/stats -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Trigger Everything
```bash
# RSS Feeds
curl -X POST http://localhost:3000/api/v1/admin/news-queue/trigger/rss-feeds -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Google News (All)
curl -X POST http://localhost:3000/api/v1/admin/news-queue/trigger/google-news-all -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Trigger Specific Entity
```bash
# Replace 123 with actual candidate ID
curl -X POST http://localhost:3000/api/v1/admin/news-queue/trigger/google-news/CANDIDATE/123 -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 🔐 Getting Your Admin Token

If you don't have an admin token:

1. **Login as admin**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@example.com",
       "password": "your_password"
     }'
   ```

2. **Copy the token from response**:
   ```json
   {
     "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": { ... }
   }
   ```

3. **Use in subsequent requests**:
   ```bash
   -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   ```

---

## ✅ Success Checklist

After triggering ingestion:

- [ ] Queue stats show jobs being processed
- [ ] Backend logs show worker activity
- [ ] `completed` count increases
- [ ] `failed` count stays at 0 (or very low)
- [ ] Database has new articles (check with your DB client)
- [ ] Articles are recent (< 48 hours old)

---

**Ready to test!** Start with RSS feeds first (faster), then try Google News. 🚀
