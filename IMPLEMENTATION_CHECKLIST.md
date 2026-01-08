# PoliticAI - Implementation Checklist & Quick Reference

> **Generated:** January 9, 2026  
> **For:** Complete implementation of pending features

---

## 📋 At-a-Glance Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ TOTAL EFFORT: 16-23 hours across 6 features                    │
│ RECOMMENDED TIMELINE: 3-4 weeks (4 hours/day)                  │
│ DEPENDENCIES: Features should be done in order (1→2→3→4→5→6)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 FEATURE 1: RELEVANCE WEIGHTS (2-3 hours)

### What It Does
- Stores calculated relevance weights in database
- Makes weights visible in API responses
- Enables historical weight analysis

### Database Changes
```prisma
// ADD to SentimentSignal model:
relevanceWeight Float?        // 0.4-1.0
sourceEntityType EntityType?  // CANDIDATE|PARTY|GEO_UNIT
sourceEntityId Int?           // Entity ID

// ADD indexes:
@@index([relevanceWeight])
```

### Code Changes Required
| File | Change | Lines |
|------|--------|-------|
| `prisma/schema.prisma` | Add 3 fields + index | +5 lines |
| `sentiment-analysis.service.ts` | Store weight when creating signal | +15 lines |
| `relevance-calculator.service.ts` | Expose weight calculation | Already exists ✓ |
| `analytics.controller.ts` | Add `/pulse/:id/detailed` endpoint | +10 lines |

### Implementation Steps
```typescript
// 1. Update schema.prisma
// 2. Run migration
npx prisma migrate dev --name add_relevance_weights

// 3. Update sentiment-analysis.service.ts (lines ~70)
// Replace this:
await this.prisma.sentimentSignal.create({
  data: { geoUnitId, sourceType, sourceRefId, sentiment, sentimentScore, confidence }
});

// With this:
const weight = this.relevanceCalculator.calculateRelevanceWeight(
  article.entityMentions,
  mention.entityType,
  mention.entityId
);
await this.prisma.sentimentSignal.create({
  data: { 
    geoUnitId, sourceType, sourceRefId, sentiment, sentimentScore, confidence,
    relevanceWeight: weight,
    sourceEntityType: mention.entityType,
    sourceEntityId: mention.entityId
  }
});

// 4. Add API endpoint in analytics.controller.ts
@Get('pulse/:candidateId/detailed')
async getPulseWithWeights(...) { ... }

// 5. Test with: GET /analytics/pulse/123/detailed
```

### ✅ Verification
- [ ] Migration runs without errors
- [ ] Old SentimentSignal records query still work
- [ ] New signals have relevanceWeight populated
- [ ] API endpoint returns weight details
- [ ] Unit tests pass for weight calculation

---

## 🎯 FEATURE 2: PRIORITY-BASED NEWS FETCHING (4-6 hours)

### What It Does
- High-priority entities (subscribed candidates) fetched every 1 hour
- Medium-priority entities (districts) fetched every 2 hours
- Low-priority entities (other states) fetched every 6 hours

### Database Changes
```prisma
// ADD to EntityMonitoring:
priority Int @default(5)  // 1-10 scale
```

### Code Changes Required
| File | Change | Lines |
|------|--------|-------|
| `prisma/schema.prisma` | Add priority field | +1 line |
| `news-ingestion-scheduler.service.ts` | NEW - 3 tier schedulers | +120 lines |
| `news-ingestion.service.ts` | Refactor to `fetchNewsForEntity()` | +30 lines |
| `health.controller.ts` | Add scheduler status endpoint | +15 lines |

### Priority Reference
```
TIER 1 (Every 1 hour):  priority >= 8
  • Subscribed candidate        priority: 10
  • Primary constituency        priority: 9
  • Opposition in constituency  priority: 9
  • Candidate's party           priority: 8

TIER 2 (Every 2 hours): priority 5-7
  • Parent district             priority: 6
  • Adjacent constituencies     priority: 5

TIER 3 (Every 6 hours): priority <= 4
  • Parent state                priority: 3
  • Other states                priority: 2
  • National news               priority: 1
```

### Implementation Steps
```typescript
// 1. Update schema.prisma
// Add: priority Int @default(5) to EntityMonitoring

// 2. Run migration
npx prisma migrate dev --name add_priority_to_entity_monitoring

// 3. Backfill priorities
// UPDATE EntityMonitoring SET priority = 10 WHERE reason = 'SUBSCRIBED';
// UPDATE EntityMonitoring SET priority = 9 WHERE reason = 'GEO_CONTEXT';
// etc.

// 4. Create news-ingestion-scheduler.service.ts
@Injectable()
export class NewsIngestionSchedulerService {
  @Cron('0 * * * * *') // Every hour
  async scheduleTier1() {
    const entities = await this.prisma.entityMonitoring.findMany({
      where: { isActive: true, priority: { gte: 8 } }
    });
    for (const entity of entities) {
      await this.newsIngestion.fetchNewsForEntity(entity.entityType, entity.entityId);
    }
  }
  
  @Cron('0 */2 * * * *') // Every 2 hours
  async scheduleTier2() { ... }
  
  @Cron('0 */6 * * * *') // Every 6 hours
  async scheduleTier3() { ... }
}

// 5. Update news-ingestion.service.ts
// Split fetchAllNews() into:
// - fetchAllNews() → calls ALL entities (backward compat)
// - fetchNewsForEntity(entityType, entityId) → NEW, called by scheduler

// 6. Register in news.module.ts
providers: [NewsIngestionService, NewsIngestionSchedulerService]

// 7. Test with:
// Check logs for "Starting TIER 1", "Starting TIER 2", etc. at correct times
```

### ✅ Verification
- [ ] Migration adds priority column
- [ ] Existing entities have default priority: 5
- [ ] Backfill script runs (manually or in migration)
- [ ] Scheduler logs show correct tier runs at correct intervals
- [ ] Tier 1 entities fetched every hour
- [ ] Tier 2 entities fetched every 2 hours
- [ ] Tier 3 entities fetched every 6 hours

---

## 🎯 FEATURE 3: DOMINANT ISSUE EXTRACTION (3-4 hours)

### What It Does
- Analyzes articles each day
- Extracts most discussed topic/issue
- Stores in `DailyGeoStats.dominantIssue`

### Database Changes
```prisma
// Already exists, just needs population:
model DailyGeoStats {
  dominantIssue: String?  // e.g., "Infrastructure"
}
```

### Code Changes Required
| File | Change | Lines |
|------|--------|-------|
| `issue-keywords.ts` | NEW - Keyword mappings | +100 lines |
| `daily-geo-stats.service.ts` | NEW - Calculation service | +200 lines |
| `analytics.module.ts` | Register new service | +2 lines |
| `analytics.controller.ts` | Add endpoints | +15 lines |

### Issue Categories
```
INFRASTRUCTURE  → roads, metro, bridge, highway, construction
WELFARE         → scheme, benefit, healthcare, pension, subsidy
ELECTIONS       → voting, candidate, campaign, polls, ballot
POLITICAL       → government, policy, law, minister, cabinet
CONTROVERSY     → scandal, corruption, charges, arrest, dispute
AGRICULTURE     → farmer, crop, irrigation, monsoon, fertilizer
EDUCATION       → school, college, student, exam, teacher
```

### Implementation Steps
```typescript
// 1. Create src/modules/analytics/data/issue-keywords.ts
export const ISSUE_KEYWORDS = {
  INFRASTRUCTURE: {
    weight: 1.0,
    keywords: ['roads', 'metro', 'bridge', 'highway', ...]
  },
  // ... more categories
};

// 2. Create src/modules/analytics/services/daily-geo-stats.service.ts
@Injectable()
export class DailyGeoStatsService {
  @Cron('59 23 * * *') // 11:59 PM every night
  async computeDailyStats() {
    const geoUnits = await this.prisma.geoUnit.findMany();
    for (const geoUnit of geoUnits) {
      await this.computeStatsForGeoUnit(geoUnit.id);
    }
  }
  
  private extractDominantIssue(signals: any[]): string | null {
    // Get all article texts
    const allText = signals.map(s => s.newsArticle?.title + ' ' + s.newsArticle?.summary).join(' ');
    
    // Count keyword frequencies
    const issueScores = {};
    for (const [issue, config] of Object.entries(ISSUE_KEYWORDS)) {
      issueScores[issue] = config.keywords
        .reduce((count, kw) => count + (allText.match(new RegExp(kw, 'gi')) || []).length, 0);
    }
    
    // Return highest scoring issue
    return Object.entries(issueScores).sort(([,a], [,b]) => b - a)[0]?.[0] || null;
  }
  
  async computeStatsForGeoUnit(geoUnitId: number, date = new Date()) {
    const signals = await this.prisma.sentimentSignal.findMany({
      where: { geoUnitId, createdAt: { gte: startOfDay(date) } },
      include: { newsArticle: true }
    });
    
    const dominantIssue = this.extractDominantIssue(signals);
    const avgSentiment = average(signals.map(s => s.sentimentScore));
    const pulseScore = average(signals.map(s => s.sentimentScore * s.confidence));
    
    await this.prisma.dailyGeoStats.upsert({
      where: { geoUnitId_date: { geoUnitId, date } },
      create: { geoUnitId, date, dominantIssue, avgSentiment, pulseScore },
      update: { dominantIssue, avgSentiment, pulseScore }
    });
  }
}

// 3. Register in analytics.module.ts
providers: [..., DailyGeoStatsService]

// 4. Add API endpoints in analytics.controller.ts
@Get('daily-stats/:geoUnitId')
async getDailyStats(@Param('geoUnitId') id: number, @Query('date') date?: string) {
  return await this.dailyGeoStatsService.getStats(id, date);
}

@Get('daily-stats/:geoUnitId/month')
async getMonthlyStats(@Param('geoUnitId') id: number, @Query('month') month: string) {
  return await this.dailyGeoStatsService.getMonthlyStats(id, month);
}

// 5. Test with:
// Manually call: service.computeStatsForGeoUnit(123)
// Wait for 11:59 PM to see automatic run
// GET /analytics/daily-stats/123?date=2026-01-09
```

### ✅ Verification
- [ ] Issue keywords loaded correctly
- [ ] Service calculates dominant issue
- [ ] DailyGeoStats records created each day
- [ ] API endpoints return stats
- [ ] Scheduler runs at 11:59 PM
- [ ] Dominant issue matches most frequent keywords

---

## 🎯 FEATURE 4: MULTI-GEOUNIT NEWS FETCHING (2-3 hours)

### What It Does
- Allows explicit subscription to geographic units
- Fetches news for all geounit levels
- Integrates with priority scheduling (Feature 2)

### Dependencies
- ✅ Feature 1 (Relevance Weights) - optional
- ✅ Feature 2 (Priority Scheduling) - required for tier fetching

### Implementation Steps
```typescript
// 1. Update EntityMonitoring to allow GEO_UNIT monitoring
// (Already supported in schema)

// 2. Add geounit subscription option in CandidateProfile/User subscription
@Put('subscribe/geounit/:geoUnitId')
async subscribeToGeoUnit(@Param('geoUnitId') id: number, @Req() req: Request) {
  await this.entityMonitoring.upsert({
    entityType: 'GEO_UNIT',
    entityId: id,
    reason: 'SUBSCRIBED',
    isActive: true,
    priority: 9  // Medium-high priority
  });
}

// 3. Update news-keyword-builder to handle geounits
async getKeywordsForGeoUnit(geoUnitId: number): Promise<string[]> {
  const geoUnit = await this.prisma.geoUnit.findUnique({
    where: { id: geoUnitId },
    include: { parent: true }
  });
  
  return [
    geoUnit.name,
    geoUnit.code,
    geoUnit.localName,
    ...(geoUnit.parent ? [geoUnit.parent.name] : [])
  ];
}

// 4. Test with:
// Subscribe to "Karnataka" or "Bangalore"
// Verify EntityMonitoring record created with priority
// Verify news fetched at scheduled intervals
```

### ✅ Verification
- [ ] GeoUnit subscription works in UI
- [ ] EntityMonitoring record created
- [ ] News fetched for subscribed geounit
- [ ] Priority scheduling applies

---

## 🎯 FEATURE 5: DAILY GEO STATS BATCH SERVICE (included in Feature 3)

### Status: ✅ Covered by Feature 3

The `DailyGeoStatsService` handles:
- ✅ Nightly batch job to compute for all geos
- ✅ API endpoints to retrieve stats
- ✅ Dominant issue extraction
- ✅ Average sentiment calculation
- ✅ Weighted pulse calculation

---

## 🎯 FEATURE 6: SENTIMENT SIGNAL SCHEMA OPTIMIZATION (2-3 hours)

### What It Does
- Adds entity type/ID to SentimentSignal
- Eliminates need to join through NewsArticle
- Enables direct entity-level queries
- Improves pulse calculation performance

### Dependencies
- ✅ Feature 1 (Relevance Weights) - provides the fields

### Current Query Pattern (Inefficient)
```typescript
// Current pulse calculation (3 joins)
const signals = await this.prisma.sentimentSignal.findMany({
  where: {
    geoUnitId: ...,
    newsArticle: {
      entityMentions: {
        some: { entityType: 'CANDIDATE', entityId: 123 }
      }
    }
  },
  include: { newsArticle: { include: { entityMentions: true } } }
});
```

### After Optimization
```typescript
// After adding sourceEntityType/sourceEntityId (direct query, 1 join)
const signals = await this.prisma.sentimentSignal.findMany({
  where: {
    geoUnitId: ...,
    sourceEntityType: 'CANDIDATE',
    sourceEntityId: 123
  }
  // NO joins needed!
});
```

### Performance Impact
- **Before:** ~200ms (3 table joins)
- **After:** ~50ms (direct index lookup)
- **Improvement:** 4x faster pulse calculations

### Implementation
- Already included in Feature 1's schema changes
- Just ensure indexes are created:
  ```prisma
  @@index([sourceEntityType, sourceEntityId])
  ```

---

## 🚀 Quick Start Implementation Order

### Week 1: Foundation
```
Day 1-2: Feature 1 (Relevance Weights)
├─ Update schema
├─ Backfill data
└─ Test API endpoint

Day 3-4: Feature 2 (Priority Fetching)
├─ Add priority field
├─ Create scheduler
└─ Test cron jobs
```

### Week 2: Analytics
```
Day 1-2: Feature 3 (Dominant Issues)
├─ Create keywords
├─ Implement extraction
└─ Test daily computation

Day 3: Feature 4 (GeoUnit Subscriptions)
├─ Add subscription endpoints
└─ Test with scheduler
```

### Week 3: Polish
```
Day 1-2: Feature 5 & 6 (Batch jobs & Optimization)
├─ Verify DailyGeoStats runs
├─ Optimize queries
└─ Performance testing
```

---

## 🧪 Testing Checklist

### Feature 1: Weights
- [ ] Weight calculation returns 1.0 for direct candidate mention
- [ ] Weight calculation returns 0.8 for geo mention
- [ ] Weight calculation returns 0.6 for party mention
- [ ] SentimentSignal.relevanceWeight populated on create
- [ ] API endpoint returns detailed pulse with weights
- [ ] Old pulse calculation still works
- [ ] Backward compatibility: null weights handled gracefully

### Feature 2: Scheduling
- [ ] Tier 1 logs show "every 1 hour"
- [ ] Tier 2 logs show "every 2 hours"
- [ ] Tier 3 logs show "every 6 hours"
- [ ] Priority >= 8 fetched by Tier 1
- [ ] Priority 5-7 fetched by Tier 2
- [ ] Priority < 5 fetched by Tier 3
- [ ] No duplicate fetches within tier
- [ ] Fallback to default priority (5) for new entities

### Feature 3: Issues
- [ ] Keywords loaded for all categories
- [ ] Dominant issue extraction identifies most frequent keywords
- [ ] DailyGeoStats created daily
- [ ] Old records updated, not duplicated
- [ ] API returns last 30 days of stats
- [ ] Null handling when no articles for day

### Feature 4: GeoUnits
- [ ] Geounit subscription creates EntityMonitoring
- [ ] Geounit subscription sets correct priority
- [ ] News fetched for subscribed geounits
- [ ] Multi-level geo hierarchy handled (state → district → constituency)
- [ ] Keywords built correctly from geounit + parent names

### Feature 5: DailyStats
- [ ] Batch job runs every night at 11:59 PM
- [ ] All geounit stats computed
- [ ] No geounit skipped
- [ ] Performance acceptable (< 5 min for all geos)
- [ ] API pagination works for large result sets

### Feature 6: Optimization
- [ ] SentimentSignal index exists: `(sourceEntityType, sourceEntityId)`
- [ ] Pulse query uses direct lookup (no NewsArticle join)
- [ ] Query performance improved 3-4x
- [ ] All existing queries still return correct results
- [ ] Backward compatibility maintained

---

## 📞 Commands Reference

```bash
# Migrations
npx prisma migrate dev --name [migration_name]
npx prisma migrate reset  # ⚠️ Deletes data!
npx prisma studio       # Browse database

# Testing
npm run test            # All tests
npm run test -- --watch # Watch mode
npm run test:e2e        # E2E tests

# Development
npm run start:dev       # Watch + reload
npm run build          # Production build
npm run lint           # ESLint check

# Database
npx prisma db push     # Apply schema (dev only)
npx prisma db seed     # Seed test data
```

---

## ⏱️ Time Estimates

| Task | Min | Max | Avg | Notes |
|------|-----|-----|-----|-------|
| Feature 1 Setup | 2h | 3h | 2.5h | Schema, migration, tests |
| Feature 2 Setup | 4h | 6h | 5h | Scheduler logic, backfill |
| Feature 3 Setup | 3h | 4h | 3.5h | Keywords, extraction logic |
| Feature 4 Setup | 2h | 3h | 2.5h | Subscription endpoints |
| Feature 5 Setup | (incl. 3) | (incl. 3) | - | Already in Feature 3 |
| Feature 6 Setup | 2h | 3h | 2.5h | Index optimization |
| **TOTAL** | **13h** | **19h** | **16h** | Full implementation |
| Testing | 3h | 4h | 3.5h | Unit + integration |
| **WITH TESTS** | **16h** | **23h** | **19.5h** | Complete with QA |

---

## 🔗 Related Documentation

- **Full Details:** [IMPLEMENTATION_PRIORITIES.md](IMPLEMENTATION_PRIORITIES.md)
- **Architecture:** [SYSTEM_ARCHITECTURE_DETAILED.md](SYSTEM_ARCHITECTURE_DETAILED.md)
- **Status:** [PROJECT_STATUS.md](PROJECT_STATUS.md)

---

## 💡 Pro Tips

1. **Start Feature 1 first** - It's foundation for others
2. **Test each scheduler independently** - Use fake timers in jest
3. **Keyword list is expandable** - Add more categories as needed
4. **Keep weights configurable** - Consider moving to database later
5. **Monitor performance** - Log query times before/after optimization
6. **Batch operations** - Compute daily stats for all geos in one job, not per-geounit
7. **Error handling** - Add try-catch in schedulers to prevent job crashes

---

**Questions? Check the full IMPLEMENTATION_PRIORITIES.md for detailed code examples.**
