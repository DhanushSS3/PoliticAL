# News Ingestion V2 - Testing Guide

## ✅ Fixes Applied

1. **Queue name error fixed** - Removed colons from queue names
2. **Module configuration fixed** - BullMQ now properly configured globally

---

## 🚀 Start Backend

```bash
cd C:\Users\user\movies\PoliticAI\backend
npm run start:dev
```

**Look for these SUCCESS logs**:
```
[NestApplication] Nest application successfully started
[BullModule] Redis connection established at localhost:6379
[GoogleNewsWorker] Worker registered and listening for jobs
[RssFeedWorker] Worker registered and listening for jobs
[NewsQueueSchedulerService] Scheduler initialized
```

---

## 🧪 Test the APIs

### 1. Get Queue Stats (No Auth Required for Testing)

```bash
curl http://localhost:3000/api/v1/admin/news-queue/stats
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "googleNews": {
      "waiting": 0,
      "active": 0,
      "completed": 0,
      "failed": 0
    },
    "rssFeed": {
      "waiting": 0,
      "active": 0,
      "completed": 0,
      "failed": 0
    }
  }
}
```

---

### 2. Trigger RSS Feed Ingestion

```bash
curl -X POST http://localhost:3000/api/v1/admin/news-queue/trigger/rss-feeds
```

**Expected Response**:
```json
{
  "success": true,
  "message": "RSS feed ingestion triggered"
}
```

---

### 3. Check Stats Again (After 10 seconds)

```bash
curl http://localhost:3000/api/v1/admin/news-queue/stats
```

**Expected Response** (job should be processing or completed):
```json
{
  "rssFeed": {
    "waiting": 0,
    "active": 1,     // Currently processing
    "completed": 0,
    "failed": 0
  }
}
```

---

### 4. Trigger Google News for All

```bash
curl -X POST http://localhost:3000/api/v1/admin/news-queue/trigger/google-news-all
```

---

### 5. Trigger Google News for Specific Entity

```bash
# Example: Candidate #1
curl -X POST http://localhost:3000/api/v1/admin/news-queue/trigger/google-news/CANDIDATE/1
```

---

## 📊 Backend Logs to Watch

### Successful Startup
```
[Nest] 24376  - 20/01/2026, 5:00:00 pm     LOG [NestFactory] Starting Nest application...
[Nest] 24376  - 20/01/2026, 5:00:01 pm     LOG [InstanceLoader] BullModule dependencies initialized +1ms
[Nest] 24376  - 20/01/2026, 5:00:01 pm     LOG [InstanceLoader] NewsModule dependencies initialized +5ms
[Nest] 24376  - 20/01/2026, 5:00:02 pm     LOG [GoogleNewsWorker] Worker registered
[Nest] 24376  - 20/01/2026, 5:00:02 pm     LOG [RssFeedWorker] Worker registered
[Nest] 24376  - 20/01/2026, 5:00:02 pm     LOG [NestApplication] Nest application successfully started +100ms
```

### RSS Feed Processing
```
[RssFeedWorker] Job 1 is now active
[RssFeedIngestionService] Starting RSS feed ingestion from 5 sources...
[RssFeedIngestionService] Fetching from The Hindu - Bangalore...
[RssFeedIngestionService] The Hindu - Bangalore: Processed 12, Skipped (old: 5, duplicate: 2)
[RssFeedIngestionService] Fetching from Times of India - Bangalore...
[RssFeedIngestionService] Times of India - Bangalore: Processed 8, Skipped (old: 3, duplicate: 1)
[RssFeedIngestionService] ✅ RSS feed ingestion completed
[RssFeedWorker] Job 1 completed successfully
```

### Google News Processing
```
[GoogleNewsWorker] Job 2 is now active
[GoogleNewsWorker] Processing Google News job for CANDIDATE #1 (priority: 8)
[NewsIngestionService] Fetching news for CANDIDATE #1 using query: Siddaramaiah
[NewsIngestionService] Feed URL: https://news.google.com/rss/search?q=Siddaramaiah&hl=en-IN&gl=IN&ceid=IN:en&tbs=qdr:d
[NewsIngestionService] Ingested article: "Siddaramaiah announces new scheme" for CANDIDATE #1
[GoogleNewsWorker] ✅ Completed Google News job for CANDIDATE #1
```

---

## 🐛 If You See Errors

### Error: "Cannot connect to Redis"
**Solution**:
```bash
# Check Redis is running
docker ps

# Should show: nammapulse-redis

# If not running, start it
docker start nammapulse-redis
```

---

### Error: "Queue name cannot contain :"
**Solution**: Already fixed! Just restart backend.

---

### Error: "Cannot GET /api/v1/admin/news-queue/stats"
**Cause**: Backend not fully started or module failed to load

**Solution**:
1. Stop backend (Ctrl+C)
2. Clear any errors
3. Restart: `npm run start:dev`
4. Wait for "Nest application successfully started" message

---

## ✅ Success Checklist

- [ ] Backend starts without errors
- [ ] See "Worker registered" logs for both workers
- [ ] GET /stats returns valid JSON
- [ ] POST /trigger/rss-feeds returns success
- [ ] Queue stats show job processing
- [ ] Backend logs show worker activity
- [ ] Jobs complete successfully (check stats)

---

## 🎯 Quick Test Script

Run this after backend starts:

```bash
# 1. Check initial state
echo "=== Initial Queue Stats ==="
curl http://localhost:3000/api/v1/admin/news-queue/stats
echo ""

# 2. Trigger RSS feeds
echo "=== Triggering RSS Feeds ==="
curl -X POST http://localhost:3000/api/v1/admin/news-queue/trigger/rss-feeds
echo ""

# 3. Wait 5 seconds
timeout /t 5

# 4. Check stats again
echo "=== Queue Stats After Trigger ==="
curl http://localhost:3000/api/v1/admin/news-queue/stats
echo ""

# 5. Wait 30 seconds
timeout /t 30

# 6. Final check
echo "=== Final Queue Stats ==="
curl http://localhost:3000/api/v1/admin/news-queue/stats
echo ""
```

---

**Now restart your backend and test!** 🚀
