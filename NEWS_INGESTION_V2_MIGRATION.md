# News Ingestion V2 - Migration Guide

**Date**: January 20, 2026  
**Migration Type**: Additive (No Breaking Changes)

---

## Overview

This migration introduces a **new worker-based architecture** alongside the existing system. Both systems can run in parallel during the transition period.

**Migration Strategy**: 🟢 **SAFE** - No breaking changes, gradual rollout

---

## Pre-Migration Checklist

### ✅ Prerequisites

- [ ] Redis installed and accessible
- [ ] `.env` file configured with Redis settings
- [ ] Backend dependencies installed (`npm install`)
- [ ] Database schema is up-to-date (no changes needed)

### ✅ Backup (Recommended)

```bash
# Backup database (optional, but recommended)
pg_dump politicai_dev > backup_$(date +%Y%m%d).sql

# Backup .env file
cp .env .env.backup
```

---

## Migration Steps

### Step 1: Install Redis

#### Option A: Docker (Recommended)
```bash
docker run -d \
  --name politicai-redis \
  -p 6379:6379 \
  --restart unless-stopped \
  redis:alpine
```

#### Option B: Windows Native
```bash
# Download from: https://github.com/microsoftarchive/redis/releases
# Or use Chocolatey
choco install redis-64

# Start Redis
redis-server
```

#### Option C: WSL
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo service redis-server start
```

**Verify Redis is running**:
```bash
redis-cli ping
# Should return: PONG
```

---

### Step 2: Update Environment Variables

Add to your `.env` file:

```bash
# ============================================
# News Ingestion V2 Configuration
# ============================================

# Redis Configuration (for BullMQ worker queues)
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""

# News Ingestion Configuration
# Maximum age of articles to ingest (in hours)
NEWS_ARTICLE_MAX_AGE_HOURS=48

# Google News time filter (d=day, w=week, m=month, y=year)
GOOGLE_NEWS_TIME_FILTER="d"

# Worker Configuration
NEWS_WORKER_CONCURRENCY=3
NEWS_WORKER_RATE_LIMIT_MAX=10
NEWS_WORKER_RATE_LIMIT_DURATION=60000

# Analysis Service (Python NLP Microservice)
ANALYSIS_SERVICE_URL="http://localhost:8000"
```

---

### Step 3: Restart Backend

```bash
cd backend

# Stop current backend (Ctrl+C)

# Start with new configuration
npm run start:dev
```

**Look for these log messages**:
```
[BullModule] Redis connection established
[GoogleNewsWorker] Worker registered
[RssFeedWorker] Worker registered
[NewsQueueSchedulerService] Scheduler initialized
```

---

### Step 4: Verify System Health

#### Check Queue Stats
```bash
curl http://localhost:3000/api/v1/admin/news-queue/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
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

### Step 5: Trigger Initial Ingestion (Optional)

```bash
# Trigger Google News ingestion for all active entities
curl -X POST http://localhost:3000/api/v1/admin/news-queue/trigger/google-news-all \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Trigger RSS feed ingestion
curl -X POST http://localhost:3000/api/v1/admin/news-queue/trigger/rss-feeds \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

### Step 6: Monitor for 24 Hours

Watch the logs and queue statistics:

```bash
# Check queue stats periodically
curl http://localhost:3000/api/v1/admin/news-queue/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Watch backend logs
# Look for:
# - [GoogleNewsWorker] Processing...
# - [RssFeedWorker] Processing...
# - "Skipping old article" messages (good - filtering works)
```

---

## Parallel Operation Period

### Both Systems Running

During the migration, **both systems will run**:

1. **Old System** (`NewsIngestionSchedulerService`)
   - Still runs on its original schedule
   - Uses priority-based tiers (Tier 1, 2, 3)
   - Direct processing (no queue)

2. **New System** (`NewsQueueSchedulerService`)
   - Runs every 30 minutes (Google News)
   - Runs every 2 hours (RSS feeds)
   - Queue-based processing

**This is intentional and safe**:
- Duplicate detection prevents duplicate articles
- Both systems use the same database tables
- No conflicts or data corruption

---

## Deprecation Timeline

### Week 1: Monitoring
- ✅ Both systems run in parallel
- ✅ Monitor queue statistics daily
- ✅ Verify article freshness
- ✅ Check for errors in logs

### Week 2: Evaluation
- ✅ Compare performance metrics
- ✅ Verify new system stability
- ✅ Ensure no regressions

### Week 3: Disable Old System
If new system is stable:

```typescript
// In news-ingestion-scheduler.service.ts
// Comment out the @Cron decorators

// @Cron(CronExpression.EVERY_HOUR)  // ← Comment this
async scheduleTier1() {
  // ...
}

// @Cron("0 0 */2 * * *")  // ← Comment this
async scheduleTier2() {
  // ...
}

// @Cron("0 0 */6 * * *")  // ← Comment this
async scheduleTier3() {
  // ...
}
```

### Week 4: Remove Old System
If no issues:

```typescript
// Remove NewsIngestionSchedulerService from news.module.ts
providers: [
  // ... other services
  // NewsIngestionSchedulerService,  // ← Remove this line
],
```

---

## Rollback Plan

If issues occur, rollback is simple:

### Step 1: Stop New System

```typescript
// In news-queue-scheduler.service.ts
// Comment out the @Cron decorators

// @Cron('*/30 * * * *')  // ← Comment this
async scheduleGoogleNewsIngestion() {
  // ...
}

// @Cron('0 */2 * * *')  // ← Comment this
async scheduleRssFeedIngestion() {
  // ...
}
```

### Step 2: Restart Backend

```bash
npm run start:dev
```

### Step 3: Verify Old System Still Works

The old system should continue functioning as before.

---

## Database Impact

### No Schema Changes Required ✅

The new system uses **existing tables**:
- `NewsArticle`
- `NewsEntityMention`
- `EntityMonitoring`
- `NewsSentiment`

**No migrations needed!**

### Data Compatibility

Both systems:
- ✅ Use same `NewsIngestType` enum
- ✅ Use same entity linking logic
- ✅ Use same sentiment analysis service
- ✅ Use same deduplication logic

---

## Performance Comparison

### Before Migration

```
User Request Flow:
User → API → Fetch News (10s) → Return Data
Total: 10-15 seconds
```

### After Migration

```
Background:
Cron → Queue → Worker → Database (async)

User Request Flow:
User → API → Query Database → Return Data
Total: <100ms
```

**Improvement**: 150x faster for users

---

## Monitoring Checklist

### Daily (First Week)

- [ ] Check queue statistics
- [ ] Review error logs
- [ ] Verify article freshness (< 48 hours)
- [ ] Check Redis memory usage
- [ ] Monitor worker processing times

### Weekly (First Month)

- [ ] Review queue performance trends
- [ ] Adjust worker concurrency if needed
- [ ] Fine-tune rate limits
- [ ] Evaluate article quality

---

## Common Issues & Solutions

### Issue: Workers not processing jobs

**Symptoms**:
- Queue stats show jobs in "waiting" state
- No worker log messages

**Solution**:
```bash
# 1. Check Redis connection
redis-cli ping

# 2. Check environment variables
cat .env | grep REDIS

# 3. Restart backend
npm run start:dev
```

---

### Issue: Too many old articles

**Symptoms**:
- Articles older than 48 hours in database

**Solution**:
```bash
# 1. Check configuration
cat .env | grep NEWS_ARTICLE_MAX_AGE_HOURS

# 2. Verify filtering is working
# Look for "Skipping old article" in logs

# 3. Reduce threshold if needed
NEWS_ARTICLE_MAX_AGE_HOURS=24  # More aggressive
```

---

### Issue: Rate limiting errors (503)

**Symptoms**:
- "Rate limited (503)" in logs
- Jobs failing repeatedly

**Solution**:
```bash
# Reduce worker concurrency
NEWS_WORKER_CONCURRENCY=1

# Increase rate limit duration
NEWS_WORKER_RATE_LIMIT_DURATION=120000  # 2 minutes
```

---

## Success Metrics

### Week 1 Goals
- ✅ Zero crashes or errors
- ✅ Queue processing working
- ✅ Articles being ingested
- ✅ Age filtering working (< 48h)

### Week 2 Goals
- ✅ Consistent performance
- ✅ No duplicate articles
- ✅ Sentiment analysis working
- ✅ Entity linking accurate

### Week 4 Goals
- ✅ Old system deprecated
- ✅ New system stable
- ✅ Performance metrics met
- ✅ Documentation complete

---

## Support & Troubleshooting

### Log Locations

```bash
# Backend logs (stdout)
# Look for:
[GoogleNewsWorker] ...
[RssFeedWorker] ...
[NewsQueueSchedulerService] ...

# Redis logs (if using Docker)
docker logs politicai-redis
```

### Debug Mode

```bash
# Enable debug logging
# In news-ingestion.service.ts and rss-feed-ingestion.service.ts
# Debug logs show:
# - Feed URLs being fetched
# - Articles being skipped (age filtering)
# - Entity linking results
```

---

## Final Checklist

### Pre-Migration
- [ ] Redis installed and running
- [ ] `.env` updated with Redis config
- [ ] Dependencies installed
- [ ] Database backed up (optional)

### During Migration
- [ ] Backend restarted successfully
- [ ] Workers registered (check logs)
- [ ] Queue stats accessible
- [ ] Manual trigger works

### Post-Migration
- [ ] Monitor for 24 hours
- [ ] Check queue statistics daily
- [ ] Verify article freshness
- [ ] Review error logs

### Deprecation (Week 3-4)
- [ ] New system stable for 2 weeks
- [ ] No regressions detected
- [ ] Old system disabled
- [ ] Old system removed (optional)

---

## Migration Complete ✅

Once all checklist items are complete, the migration is successful!

**Next Steps**:
1. Continue monitoring for 1 month
2. Fine-tune worker settings based on load
3. Consider adding more news sources
4. Implement advanced features (webhooks, etc.)

---

**Questions or Issues?**

Refer to:
- `NEWS_INGESTION_V2_IMPLEMENTATION.md` - Full documentation
- `NEWS_INGESTION_V2_QUICK_REFERENCE.md` - Quick commands
- `NEWS_INGESTION_V2_ARCHITECTURE.md` - System diagrams
