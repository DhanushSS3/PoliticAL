# News Ingestion V2 - Architecture Diagram

## System Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CRON SCHEDULER                              │
│                  (NewsQueueSchedulerService)                        │
│                                                                     │
│  ┌──────────────────┐              ┌──────────────────┐           │
│  │  Every 30 min    │              │  Every 2 hours   │           │
│  │  Google News     │              │  RSS Feeds       │           │
│  └────────┬─────────┘              └────────┬─────────┘           │
└───────────┼──────────────────────────────────┼──────────────────────┘
            │                                  │
            │ Add Jobs (instant)               │ Add Jobs (instant)
            ▼                                  ▼
┌───────────────────────┐          ┌───────────────────────┐
│  GOOGLE NEWS QUEUE    │          │  RSS FEED QUEUE       │
│  (BullMQ/Redis)       │          │  (BullMQ/Redis)       │
│                       │          │                       │
│  ┌─────────────────┐ │          │  ┌─────────────────┐ │
│  │ Job 1: CANDIDATE│ │          │  │ Job 1: All      │ │
│  │        #123     │ │          │  │        Sources  │ │
│  ├─────────────────┤ │          │  └─────────────────┘ │
│  │ Job 2: PARTY    │ │          │                       │
│  │        #45      │ │          │  Priority: High       │
│  ├─────────────────┤ │          │  Retry: 3 attempts    │
│  │ Job 3: GEO_UNIT │ │          │                       │
│  │        #67      │ │          │                       │
│  └─────────────────┘ │          │                       │
│                       │          │                       │
│  Priority: By entity  │          │                       │
│  Retry: 3 attempts    │          │                       │
└───────────┬───────────┘          └───────────┬───────────┘
            │                                  │
            │ Workers pick up jobs             │ Workers pick up jobs
            ▼                                  ▼
┌───────────────────────┐          ┌───────────────────────┐
│  GOOGLE NEWS WORKER   │          │  RSS FEED WORKER      │
│  (3 concurrent jobs)  │          │  (2 concurrent jobs)  │
│                       │          │                       │
│  ┌─────────────────┐ │          │  ┌─────────────────┐ │
│  │ Process Job 1   │ │          │  │ Fetch The Hindu │ │
│  │ Fetch from      │ │          │  │ Fetch TOI       │ │
│  │ Google News     │ │          │  │ Fetch TNIE      │ │
│  │ with tbs=qdr:d  │ │          │  │ Fetch OneIndia  │ │
│  └────────┬────────┘ │          │  │ Fetch Citizen   │ │
│           │          │          │  │ Matters         │ │
│           ▼          │          │  └────────┬────────┘ │
│  ┌─────────────────┐ │          │           │          │
│  │ Check article   │ │          │           ▼          │
│  │ age < 48h?      │ │          │  ┌─────────────────┐ │
│  └────────┬────────┘ │          │  │ Check article   │ │
│           │          │          │  │ age < 48h?      │ │
│           ▼          │          │  └────────┬────────┘ │
│  ┌─────────────────┐ │          │           │          │
│  │ Save to DB      │ │          │           ▼          │
│  │ Link entities   │ │          │  ┌─────────────────┐ │
│  │ Trigger NLP     │ │          │  │ Save to DB      │ │
│  └─────────────────┘ │          │  │ Link entities   │ │
└───────────┬───────────┘          │  │ Trigger NLP     │ │
            │                      │  └─────────────────┘ │
            │                      └───────────┬───────────┘
            │                                  │
            └──────────────┬───────────────────┘
                           ▼
                  ┌─────────────────┐
                  │   DATABASE      │
                  │   (PostgreSQL)  │
                  │                 │
                  │  NewsArticle    │
                  │  EntityMention  │
                  │  Sentiment      │
                  └────────┬────────┘
                           │
                           │ Fast read (<100ms)
                           ▼
                  ┌─────────────────┐
                  │   USER API      │
                  │   (NestJS)      │
                  │                 │
                  │  GET /live-feed │
                  │  GET /news      │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   FRONTEND      │
                  │   (React)       │
                  │                 │
                  │  Dashboard      │
                  │  News Feed      │
                  └─────────────────┘
```

## Data Flow

### 1. Google News Ingestion

```
Cron Trigger (30 min)
  ↓
Get Active Entities from DB
  ↓
For each entity:
  ↓
  Add job to queue {
    entityType: "CANDIDATE",
    entityId: 123,
    priority: 8
  }
  ↓
Worker picks up job
  ↓
Build search query with event keywords
  "Siddaramaiah" + "protest"
  ↓
Fetch from Google News RSS
  URL: news.google.com/rss/search?q=...&tbs=qdr:d
  ↓
For each article:
  ↓
  Check pubDate
  ↓
  Is age < 48 hours? ──No──> Skip article
  ↓ Yes
  Check for duplicate
  ↓
  Save to NewsArticle table
  ↓
  Link to entity (NewsEntityMention)
  ↓
  Trigger sentiment analysis (async)
```

### 2. RSS Feed Ingestion

```
Cron Trigger (2 hours)
  ↓
Add job to queue
  ↓
Worker picks up job
  ↓
For each RSS source:
  ↓
  Fetch RSS feed
  (The Hindu, TOI, TNIE, OneIndia, Citizen Matters)
  ↓
  For each article:
    ↓
    Check pubDate
    ↓
    Is age < 48 hours? ──No──> Skip article
    ↓ Yes
    Check for duplicate
    ↓
    Save to NewsArticle table
    ↓
    Match keywords to entities
    ↓
    Link to entities (NewsEntityMention)
    ↓
    Trigger sentiment analysis (async)
```

## Component Responsibilities

```
┌─────────────────────────────────────────────────────────────┐
│                    SCHEDULER LAYER                          │
│  Responsibility: Schedule jobs, don't process them          │
├─────────────────────────────────────────────────────────────┤
│  NewsQueueSchedulerService                                  │
│  - Runs cron jobs                                           │
│  - Queries database for active entities                     │
│  - Adds jobs to BullMQ queues                               │
│  - Provides manual trigger methods                          │
│  - Exposes queue statistics                                 │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     QUEUE LAYER                             │
│  Responsibility: Store jobs, manage priorities, retry       │
├─────────────────────────────────────────────────────────────┤
│  BullMQ Queues (Redis)                                      │
│  - news:google-ingestion                                    │
│  - news:rss-ingestion                                       │
│                                                             │
│  Features:                                                  │
│  - Priority-based processing                                │
│  - Automatic retry with exponential backoff                 │
│  - Job persistence (survives crashes)                       │
│  - Rate limiting                                            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    WORKER LAYER                             │
│  Responsibility: Process jobs asynchronously                │
├─────────────────────────────────────────────────────────────┤
│  GoogleNewsWorker                                           │
│  - Picks up jobs from google-ingestion queue                │
│  - Calls NewsIngestionService                               │
│  - Handles errors and retries                               │
│  - Logs job lifecycle events                                │
│                                                             │
│  RssFeedWorker                                              │
│  - Picks up jobs from rss-ingestion queue                   │
│  - Calls RssFeedIngestionService                            │
│  - Handles errors and retries                               │
│  - Logs job lifecycle events                                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   SERVICE LAYER                             │
│  Responsibility: Business logic for fetching news           │
├─────────────────────────────────────────────────────────────┤
│  NewsIngestionService                                       │
│  - Builds search queries with event keywords                │
│  - Fetches from Google News RSS with tbs parameter          │
│  - Validates article age                                    │
│  - Saves articles to database                               │
│  - Links articles to entities                               │
│                                                             │
│  RssFeedIngestionService                                    │
│  - Fetches from Bangalore RSS sources                       │
│  - Validates article age                                    │
│  - Saves articles to database                               │
│  - Links articles to entities via keyword matching          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   DATA LAYER                                │
│  Responsibility: Persist data                               │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL Database                                        │
│  - NewsArticle (title, summary, sourceUrl, publishedAt)     │
│  - NewsEntityMention (links articles to entities)           │
│  - EntityMonitoring (tracks which entities to monitor)      │
│  - NewsSentiment (sentiment scores from NLP)                │
└─────────────────────────────────────────────────────────────┘
```

## Configuration Flow

```
.env file
  ↓
  ├─> REDIS_HOST ──────────────────────> BullModule.forRootAsync()
  ├─> REDIS_PORT ──────────────────────> BullModule.forRootAsync()
  ├─> NEWS_ARTICLE_MAX_AGE_HOURS ──────> NewsIngestionService
  ├─> NEWS_ARTICLE_MAX_AGE_HOURS ──────> RssFeedIngestionService
  ├─> GOOGLE_NEWS_TIME_FILTER ─────────> NewsIngestionService
  ├─> NEWS_WORKER_CONCURRENCY ─────────> Worker decorators
  └─> NEWS_WORKER_RATE_LIMIT_MAX ──────> Worker decorators
```

## Error Handling & Retry Flow

```
Job added to queue
  ↓
Worker picks up job
  ↓
Try to process
  ↓
  Success? ──Yes──> Mark as completed
  ↓ No              Remove from queue
  Error occurred
  ↓
  Attempt < 3? ──No──> Mark as failed
  ↓ Yes                Keep in failed queue
  Wait (exponential backoff)
  5s → 10s → 20s
  ↓
  Retry job
  (back to "Try to process")
```

## Monitoring & Admin Flow

```
Admin Dashboard
  ↓
  GET /api/v1/admin/news-queue/stats
  ↓
  Returns:
  {
    googleNews: {
      waiting: 45,    ← Jobs in queue
      active: 3,      ← Currently processing
      completed: 1250,← Successfully processed
      failed: 12      ← Failed jobs
    },
    rssFeed: { ... }
  }
  ↓
  Admin can:
  - Monitor queue health
  - Trigger manual ingestion
  - See processing status
```

---

This architecture ensures:
- ✅ **Separation of Concerns** - Each layer has one job
- ✅ **Scalability** - Add more workers to handle load
- ✅ **Reliability** - Jobs persist, auto-retry on failure
- ✅ **Performance** - Non-blocking, users never wait
- ✅ **Maintainability** - SOLID principles, clean code
