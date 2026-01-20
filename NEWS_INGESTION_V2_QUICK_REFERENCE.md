# News Ingestion V2 - Quick Reference

## 🔑 Environment Variables

Copy to your `.env` file:

```bash
# Redis Configuration (for BullMQ worker queues)
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""

# News Ingestion Configuration
NEWS_ARTICLE_MAX_AGE_HOURS=48
GOOGLE_NEWS_TIME_FILTER="d"

# Worker Configuration
NEWS_WORKER_CONCURRENCY=3
NEWS_WORKER_RATE_LIMIT_MAX=10
NEWS_WORKER_RATE_LIMIT_DURATION=60000

# Analysis Service (Python NLP Microservice)
ANALYSIS_SERVICE_URL="http://localhost:8000"
```

---

## 📡 Admin API Endpoints

### Get Queue Statistics
```http
GET /api/v1/admin/news-queue/stats
Authorization: Bearer <admin-token>
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

### Trigger Google News for Specific Entity
```http
POST /api/v1/admin/news-queue/trigger/google-news/:entityType/:entityId
Authorization: Bearer <admin-token>

# Example
POST /api/v1/admin/news-queue/trigger/google-news/CANDIDATE/123
```

### Trigger Google News for All Active Entities
```http
POST /api/v1/admin/news-queue/trigger/google-news-all
Authorization: Bearer <admin-token>
```

### Trigger RSS Feed Ingestion
```http
POST /api/v1/admin/news-queue/trigger/rss-feeds
Authorization: Bearer <admin-token>
```

---

## 🏃 Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Start Redis
```bash
# Option 1: Docker (recommended)
docker run -d -p 6379:6379 --name politicai-redis redis:alpine

# Option 2: Windows (if Redis installed)
redis-server

# Option 3: WSL
sudo service redis-server start
```

### 3. Configure Environment
```bash
# Copy example
cp .env.example .env

# Edit .env and add Redis configuration
```

### 4. Start Backend
```bash
npm run start:dev
```

### 5. Verify Workers Started
Look for these log messages:
```
[GoogleNewsWorker] Worker registered
[RssFeedWorker] Worker registered
[NewsQueueSchedulerService] Scheduler initialized
```

---

## 🧪 Testing

### Test Queue System
```bash
# 1. Trigger manual ingestion
curl -X POST http://localhost:3000/api/v1/admin/news-queue/trigger/rss-feeds \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 2. Check queue stats
curl http://localhost:3000/api/v1/admin/news-queue/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 3. Watch logs for processing
# You should see workers picking up jobs
```

---

## 📊 Cron Schedule

| Job | Cron Expression | Frequency | Description |
|-----|----------------|-----------|-------------|
| Google News | `*/30 * * * *` | Every 30 min | Fetches for active entities |
| RSS Feeds | `0 */2 * * *` | Every 2 hours | Fetches from Bangalore sources |

---

## 🔍 Monitoring

### Check Redis Connection
```bash
redis-cli ping
# Should return: PONG
```

### Check Queue Contents
```bash
# Using Redis CLI
redis-cli

# List all keys
KEYS *

# Check specific queue
LRANGE bull:news:google-ingestion:wait 0 -1
```

### View Worker Logs
```bash
# In backend terminal, filter for worker logs
# Look for:
# - [GoogleNewsWorker] Processing...
# - [RssFeedWorker] Processing...
# - [NewsQueueSchedulerService] Scheduling...
```

---

## 🐛 Common Issues

### Issue: "Cannot connect to Redis"
**Solution**:
```bash
# Check if Redis is running
redis-cli ping

# If not, start Redis
docker start politicai-redis
# OR
redis-server
```

### Issue: "Workers not processing jobs"
**Solution**:
1. Check Redis connection
2. Verify environment variables are set
3. Restart backend: `npm run start:dev`

### Issue: "Old articles still being ingested"
**Solution**:
1. Check `NEWS_ARTICLE_MAX_AGE_HOURS` in `.env`
2. Verify it's set to desired value (default: 48)
3. Restart backend to apply changes

---

## 📈 Performance Tuning

### High Load (Many Entities)
```bash
# Increase worker concurrency
NEWS_WORKER_CONCURRENCY=5

# Increase rate limit
NEWS_WORKER_RATE_LIMIT_MAX=20
```

### Low Load (Few Entities)
```bash
# Reduce concurrency to save resources
NEWS_WORKER_CONCURRENCY=1

# Reduce rate limit
NEWS_WORKER_RATE_LIMIT_MAX=5
```

### Aggressive Recency Filtering
```bash
# Only articles from past 24 hours
NEWS_ARTICLE_MAX_AGE_HOURS=24

# Only articles from past hour (Google News)
GOOGLE_NEWS_TIME_FILTER="h"
```

---

## 🎯 Key Features

✅ **5 New RSS Sources** - Bangalore-specific news  
✅ **Time-Based Filtering** - `tbs` parameter forces recency  
✅ **Event Keywords** - Finds actionable news (protests, announcements)  
✅ **Post-Processing Filter** - Discards old articles  
✅ **Worker Architecture** - Non-blocking, scalable  
✅ **SOLID Principles** - Clean, maintainable code  

---

## 📞 Support

For issues or questions:
1. Check logs in backend terminal
2. Verify Redis is running
3. Check environment variables
4. Review full documentation: `NEWS_INGESTION_V2_IMPLEMENTATION.md`
