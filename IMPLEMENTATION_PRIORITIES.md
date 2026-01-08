# PoliticAI - Pending Implementation Tasks

**Last Updated:** January 9, 2026  
**Status:** All items documented with implementation requirements

---

## 📋 Quick Summary

| Feature | Status | Priority | Effort | Dependencies |
|---------|--------|----------|--------|--------------|
| 1. Relevance Weights (Database & UI) | ❌ Not Started | 🔴 HIGH | 2-3h | None |
| 2. Priority-Based News Fetching | ❌ Not Started | 🔴 HIGH | 4-6h | EntityMonitoring |
| 3. Dominant Issue Extraction | ❌ Not Started | 🟡 MEDIUM | 3-4h | Articles, Keywords |
| 4. Multi-GeoUnit News Fetching | ⚠️ Partial | 🟡 MEDIUM | 2-3h | Priority Scheduler |
| 5. DailyGeoStats Service | ❌ Not Started | 🟡 MEDIUM | 3-4h | SentimentSignal |
| 6. SentimentSignal Schema Optimization | ❌ Not Started | 🟠 LOW | 2-3h | Refactor Pulse queries |

---

## 🎯 FEATURE 1: RELEVANCE WEIGHTS IMPLEMENTATION

### Current Status
✅ **PARTIALLY DONE:**
- Weights calculated in `RelevanceCalculatorService` ✅
- Used in `CandidatePulseService` ✅
- Applied to pulse calculation ✅

❌ **MISSING:**
- Not stored in database (calculated in-memory)
- Not exposed in API responses
- Not visible in UI/dashboards
- Not persisted for historical analysis

### What Needs to Be Done

#### 1A. Store Relevance Weights in Database

**Schema Change (Add to SentimentSignal):**
```prisma
model SentimentSignal {
  id              Int    @id @default(autoincrement())
  geoUnitId       Int
  sourceType      DataSourceType
  sourceRefId     Int

  sentiment       SentimentLabel
  sentimentScore  Float  // -1.0 to 1.0
  confidence      Float  // 0.0 to 1.0
  
  // 🆕 NEW FIELDS - Add these
  relevanceWeight Float?  // Store calculated weight (0.4 - 1.0)
  sourceEntityType EntityType?  // CANDIDATE | PARTY | GEO_UNIT
  sourceEntityId   Int?    // ID of the entity mentioned
  
  modelVersion    String?
  createdAt       DateTime @default(now())

  geoUnit         GeoUnit @relation(fields: [geoUnitId], references: [id])
  newsArticle     NewsArticle? @relation(fields: [sourceRefId], references: [id])
  
  @@index([geoUnitId, createdAt])
  @@index([sourceType])
  @@index([relevanceWeight]) // 🆕 NEW INDEX for filtering
}
```

**Migration Steps:**
1. Create migration: `add_relevance_weight_fields_to_sentiment_signal`
2. Add the three new fields (relevanceWeight, sourceEntityType, sourceEntityId)
3. Backfill existing SentimentSignal records by querying NewsEntityMention
4. Add indexes for performance

**Where to implement (Code):**
- File: `backend/prisma/schema.prisma`
- Create migration in `backend/prisma/migrations/`
- Update `SentimentAnalysisService` to populate these fields

#### 1B. Update SentimentAnalysisService to Calculate and Store Weights

**File:** `backend/src/modules/news/services/sentiment-analysis.service.ts`

**Current Code (lines ~70):**
```typescript
// When creating SentimentSignal, only stores: geoUnitId, sentiment, score, confidence
await this.prisma.sentimentSignal.create({
  data: {
    geoUnitId: gid,
    sourceType: DataSourceType.NEWS,
    sourceRefId: articleId,
    sentiment: data.label,
    sentimentScore: data.score,
    confidence: data.confidence,
  },
});
```

**What to Change:**
```typescript
// BEFORE: Loop through geoUnits only
for (const gid of targetGeoUnitIds) {
  await this.prisma.sentimentSignal.create({...})
}

// AFTER: Loop through BOTH geoUnits AND entity mentions
const article = await this.prisma.newsArticle.findUnique({
  where: { id: articleId },
  include: { entityMentions: true }
});

// For each entity mention in the article
for (const mention of article.entityMentions) {
  // Get primary geoUnit for this entity
  const geoUnitIds = await this.geoAttributionResolver.resolveToGeoUnits(mention);
  
  // For each resolved geoUnit
  for (const gid of geoUnitIds) {
    // Calculate relevance weight (optional: pass entity mention info)
    const weight = this.relevanceCalculator.calculateRelevanceWeight(
      article.entityMentions,
      mention.entityType,
      mention.entityId
    );
    
    // Create signal WITH weight and entity info
    await this.prisma.sentimentSignal.create({
      data: {
        geoUnitId: gid,
        sourceType: DataSourceType.NEWS,
        sourceRefId: articleId,
        sentiment: data.label,
        sentimentScore: data.score,
        confidence: data.confidence,
        
        // 🆕 NEW FIELDS
        relevanceWeight: weight,
        sourceEntityType: mention.entityType,
        sourceEntityId: mention.entityId,
      },
    });
  }
}
```

#### 1C. Create API Endpoint to Return Weights

**File:** `backend/src/modules/analytics/controllers/analytics.controller.ts`

**New Endpoint:**
```typescript
@Get('pulse/:candidateId/detailed')
async getPulseWithWeights(
  @Param('candidateId') candidateId: number,
  @Query('days') days: number = 7
) {
  return this.analyticsService.calculatePulseDetailed(candidateId, days);
}
```

**Response Format:**
```json
{
  "candidateId": 123,
  "pulseScore": 0.621,
  "trend": "RISING",
  "articlesAnalyzed": 24,
  "weightedContributions": [
    {
      "articleId": 5001,
      "title": "Candidate wins election",
      "sentiment": "POSITIVE",
      "sentimentScore": 0.85,
      "confidence": 0.92,
      "relevanceWeight": 1.0,
      "effectiveScore": 0.782,
      "sourceEntity": {
        "type": "CANDIDATE",
        "id": 123,
        "name": "Siddaramaiah"
      }
    },
    // ... more articles
  ]
}
```

#### 1D. Update Dashboard/UI

Files:
- `frontend/src/components/CandidatePulse.tsx` (or similar)
- `frontend/src/components/WeightsVisualization.tsx` (new file)

Features to add:
- Show relevance weight for each article
- Visualize weight distribution (pie chart)
- Filter articles by weight range
- Color-code by entity type (CANDIDATE=red, GEO=blue, PARTY=green)

### Testing

```typescript
// Unit Test: RelevanceCalculatorService weights
const weights = {
  directCandidate: 1.0,
  geoUnit: 0.8,
  party: 0.6,
  fallback: 0.4
};

// Integration Test: Weight stored in database
const signal = await prisma.sentimentSignal.findFirst();
expect(signal.relevanceWeight).toBeDefined();
expect(signal.sourceEntityType).toBeDefined();

// E2E Test: API returns weights
const response = await api.get('/analytics/pulse/123/detailed');
expect(response.weightedContributions[0].relevanceWeight).toBeDefined();
```

---

## 🎯 FEATURE 2: PRIORITY-BASED NEWS FETCHING

### Current Status
❌ **NOT IMPLEMENTED:**
- All entities fetched with same frequency (every hour)
- No priority tiers implemented
- No scheduler differentiation
- No EntityMonitoring.priority field

### What Needs to Be Done

#### 2A. Update EntityMonitoring Schema

**File:** `backend/prisma/schema.prisma`

**Add Priority Field:**
```prisma
model EntityMonitoring {
  id          Int         @id @default(autoincrement())
  entityType  EntityType  // CANDIDATE | PARTY | GEO_UNIT
  entityId    Int
  reason      MonitoringReason  // SUBSCRIBED | GEO_CONTEXT | PARTY_CONTEXT | OPPONENT
  isActive    Boolean     @default(true)
  
  // 🆕 NEW FIELD
  priority    Int         @default(5)  // 1-10 scale, 10=highest
  
  createdAt   DateTime    @default(now())
  
  @@unique([entityType, entityId])
}
```

**Priority Tiers Reference:**
```
TIER 1 (Fetch every 1 hour):     priority >= 8
  • Subscribed candidate           priority: 10
  • Primary constituency            priority: 9
  • Opposition in same constituency priority: 9
  • Candidate's party               priority: 8

TIER 2 (Fetch every 2 hours):    priority 5-7
  • Parent district                 priority: 6
  • Adjacent constituencies         priority: 5
  • Regional political news         priority: 5

TIER 3 (Fetch every 6 hours):    priority <= 4
  • Parent state                    priority: 3
  • Other states                    priority: 2
  • National news                   priority: 1
```

**Migration:**
```bash
# Create migration
npx prisma migrate dev --name add_priority_to_entity_monitoring

# Then backfill:
UPDATE EntityMonitoring SET priority = 10 WHERE reason = 'SUBSCRIBED' AND entityType = 'CANDIDATE';
UPDATE EntityMonitoring SET priority = 9 WHERE entityType = 'GEO_UNIT' AND reason IN ('GEO_CONTEXT', 'OPPONENT');
UPDATE EntityMonitoring SET priority = 8 WHERE entityType = 'PARTY' AND reason = 'PARTY_CONTEXT';
UPDATE EntityMonitoring SET priority = 6 WHERE entityType = 'GEO_UNIT' AND reason = 'DISTRICT_CONTEXT';
UPDATE EntityMonitoring SET priority = 3 WHERE entityType = 'GEO_UNIT' AND reason = 'STATE_CONTEXT';
```

#### 2B. Create Priority-Based News Ingestion Scheduler

**File:** `backend/src/modules/news/services/news-ingestion-scheduler.service.ts` (NEW FILE)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { NewsIngestionService } from './news-ingestion.service';

@Injectable()
export class NewsIngestionSchedulerService {
  private readonly logger = new Logger(NewsIngestionSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly newsIngestion: NewsIngestionService,
  ) {}

  /**
   * TIER 1: High Priority - Every 1 hour
   * Subscribed candidates, primary constituencies, parties
   */
  @Cron('0 * * * * *') // Every hour
  async scheduleTier1() {
    this.logger.debug('Starting TIER 1 (High Priority) news fetch');
    
    const entities = await this.prisma.entityMonitoring.findMany({
      where: {
        isActive: true,
        priority: { gte: 8 }, // Priority 8, 9, 10
      },
    });

    this.logger.log(`Tier 1: Fetching news for ${entities.length} high-priority entities`);
    
    for (const entity of entities) {
      try {
        await this.newsIngestion.fetchNewsForEntity(
          entity.entityType,
          entity.entityId,
        );
      } catch (error) {
        this.logger.error(`Tier 1 fetch failed for entity ${entity.id}:`, error);
      }
    }
  }

  /**
   * TIER 2: Medium Priority - Every 2 hours
   * Districts, adjacent constituencies, regional news
   */
  @Cron('0 */2 * * * *') // Every 2 hours
  async scheduleTier2() {
    this.logger.debug('Starting TIER 2 (Medium Priority) news fetch');
    
    const entities = await this.prisma.entityMonitoring.findMany({
      where: {
        isActive: true,
        priority: { gte: 5, lt: 8 }, // Priority 5, 6, 7
      },
    });

    this.logger.log(`Tier 2: Fetching news for ${entities.length} medium-priority entities`);
    
    for (const entity of entities) {
      try {
        await this.newsIngestion.fetchNewsForEntity(
          entity.entityType,
          entity.entityId,
        );
      } catch (error) {
        this.logger.error(`Tier 2 fetch failed for entity ${entity.id}:`, error);
      }
    }
  }

  /**
   * TIER 3: Low Priority - Every 6 hours
   * States, national news
   */
  @Cron('0 */6 * * * *') // Every 6 hours
  async scheduleTier3() {
    this.logger.debug('Starting TIER 3 (Low Priority) news fetch');
    
    const entities = await this.prisma.entityMonitoring.findMany({
      where: {
        isActive: true,
        priority: { lt: 5 }, // Priority 1, 2, 3, 4
      },
    });

    this.logger.log(`Tier 3: Fetching news for ${entities.length} low-priority entities`);
    
    for (const entity of entities) {
      try {
        await this.newsIngestion.fetchNewsForEntity(
          entity.entityType,
          entity.entityId,
        );
      } catch (error) {
        this.logger.error(`Tier 3 fetch failed for entity ${entity.id}:`, error);
      }
    }
  }

  /**
   * Get scheduling metrics (for monitoring/debugging)
   */
  async getSchedulingMetrics() {
    const byTier = await this.prisma.entityMonitoring.groupBy({
      by: ['priority'],
      where: { isActive: true },
      _count: true,
    });

    return {
      tier1: byTier.find(t => t.priority >= 8)?._count || 0,
      tier2: byTier.find(t => t.priority >= 5 && t.priority < 8)?._count || 0,
      tier3: byTier.find(t => t.priority < 5)?._count || 0,
      lastRun: new Date(),
    };
  }
}
```

#### 2C. Update News Ingestion Service to Handle Entity-Specific Fetching

**File:** `backend/src/modules/news/services/news-ingestion.service.ts`

**Current Method (generic):**
```typescript
async fetchAllNews() {
  // Fetches ALL entities every hour
}
```

**New Method (entity-specific):**
```typescript
async fetchNewsForEntity(entityType: EntityType, entityId: number) {
  // Fetch news for SINGLE entity
  // Called by scheduler with specific entity
  
  const entity = await this.getEntityDetails(entityType, entityId);
  const keywords = await this.keywordManager.getKeywords(entityType, entityId);
  
  // Query Google News with these keywords
  const articles = await this.fetchGoogleNews(keywords);
  
  // Deduplicate & create/update articles
  for (const article of articles) {
    await this.createOrUpdateArticle(article, entityType, entityId);
  }
}
```

#### 2D. Keep Old Method for Backward Compatibility

```typescript
async fetchAllNews() {
  // DEPRECATED: Use scheduler instead
  // Kept for manual triggers
  const allEntities = await this.prisma.entityMonitoring.findMany({
    where: { isActive: true },
  });
  
  for (const entity of allEntities) {
    await this.fetchNewsForEntity(entity.entityType, entity.entityId);
  }
}
```

#### 2E. Add Health/Monitoring Endpoint

**File:** `backend/src/modules/health/health.controller.ts`

```typescript
@Get('news-scheduler')
async getNewsSchedulerStatus() {
  const metrics = await this.newsScheduler.getSchedulingMetrics();
  return {
    status: 'operational',
    nextTier1Run: this.calculateNextRun('*/1'),
    nextTier2Run: this.calculateNextRun('*/2'),
    nextTier3Run: this.calculateNextRun('*/6'),
    entityMetrics: metrics,
  };
}
```

### Testing

```typescript
// Unit Test: Priority assignment
const candidates = await prisma.entityMonitoring.findMany({
  where: { entityType: 'CANDIDATE', reason: 'SUBSCRIBED' },
});
candidates.forEach(c => expect(c.priority).toBe(10));

// Integration Test: Scheduler runs at correct intervals
// (Use jest.useFakeTimers() to test cron)

// E2E Test: High-priority entities fetched more frequently
// Check logs to verify Tier 1 runs every hour, Tier 2 every 2 hours, etc.
```

---

## 🎯 FEATURE 3: DOMINANT ISSUE EXTRACTION

### Current Status
❌ **NOT IMPLEMENTED:**
- `DailyGeoStats.dominantIssue` field exists (schema only)
- No service to calculate dominant issue
- No keyword mappings
- Not triggered by any job

### What Needs to Be Done

#### 3A. Create Issue Category Keywords

**File:** `backend/src/modules/analytics/data/issue-keywords.ts` (NEW FILE)

```typescript
export const ISSUE_KEYWORDS = {
  INFRASTRUCTURE: {
    weight: 1.0,
    keywords: [
      'roads', 'highways', 'bridge', 'metro', 'transport', 'development',
      'construction', 'project', 'infrastructure', 'industrial',
      'railway', 'airport', 'port', 'highway', 'expressway',
      'construction', 'repair', 'maintenance', 'upgrade', 'expansion',
    ],
  },
  WELFARE: {
    weight: 1.0,
    keywords: [
      'welfare', 'scheme', 'benefit', 'assistance', 'social', 'healthcare',
      'insurance', 'pension', 'grant', 'subsidy', 'free',
      'health', 'education', 'food', 'ration', 'employment',
      'ynrega', 'scheme', 'cash', 'program', 'benefit',
    ],
  },
  ELECTIONS: {
    weight: 1.0,
    keywords: [
      'election', 'voting', 'vote', 'candidate', 'campaign', 'polls',
      'ballot', 'constituency', 'commission', 'voter',
      'election', 'poll', 'candidate', 'results', 'vote',
      'voting', 'campaign', 'rally', 'manifesto', 'victory',
    ],
  },
  POLITICAL: {
    weight: 0.8,
    keywords: [
      'congress', 'bjp', 'party', 'political', 'government', 'minister',
      'policy', 'law', 'legislation', 'amendment',
      'government', 'law', 'policy', 'decision', 'ruling',
      'cabinet', 'parliament', 'assembly', 'bill', 'act',
    ],
  },
  CONTROVERSY: {
    weight: 1.0,
    keywords: [
      'scandal', 'corruption', 'charges', 'investigation', 'alleged',
      'arrest', 'controversy', 'dispute', 'conflict', 'issue',
      'scam', 'fraud', 'illegal', 'violation', 'crime',
      'attack', 'protest', 'violence', 'riot', 'clash',
    ],
  },
  AGRICULTURE: {
    weight: 1.0,
    keywords: [
      'agriculture', 'farmer', 'farm', 'crop', 'harvest', 'field',
      'irrigation', 'water', 'monsoon', 'rainfall', 'drought',
      'farming', 'grain', 'wheat', 'rice', 'sugarcane',
      'fertilizer', 'pesticide', 'loan', 'subsidy', 'support',
    ],
  },
  EDUCATION: {
    weight: 1.0,
    keywords: [
      'education', 'school', 'college', 'university', 'student',
      'teacher', 'exam', 'board', 'curriculum', 'scholarship',
      'school', 'teaching', 'learning', 'course', 'training',
      'admission', 'entrance', 'result', 'board', 'exam',
    ],
  },
};

export type IssueName = keyof typeof ISSUE_KEYWORDS;
```

#### 3B. Create DailyGeoStatsService

**File:** `backend/src/modules/analytics/services/daily-geo-stats.service.ts` (NEW FILE)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { ISSUE_KEYWORDS, IssueName } from '../data/issue-keywords';

@Injectable()
export class DailyGeoStatsService {
  private readonly logger = new Logger(DailyGeoStatsService.name);
  private readonly STOP_WORDS = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
    'in', 'to', 'for', 'of', 'with', 'as', 'by', 'from', 'be', 'been',
    'are', 'was', 'were', 'have', 'has', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'can', 'that', 'this',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute daily stats for all geoUnits (Run every night at 11:59 PM)
   */
  @Cron('59 23 * * *') // 11:59 PM every day
  async computeDailyStats() {
    this.logger.log('Starting daily geo stats computation');
    
    try {
      const geoUnits = await this.prisma.geoUnit.findMany();
      
      for (const geoUnit of geoUnits) {
        await this.computeStatsForGeoUnit(geoUnit.id);
      }
      
      this.logger.log(`Completed daily stats for ${geoUnits.length} geo units`);
    } catch (error) {
      this.logger.error('Error computing daily stats:', error);
    }
  }

  /**
   * Compute stats for a specific geoUnit on a specific date
   */
  async computeStatsForGeoUnit(geoUnitId: number, date: Date = new Date()) {
    // Get signals for this date
    const signals = await this.prisma.sentimentSignal.findMany({
      where: {
        geoUnitId,
        createdAt: {
          gte: this.startOfDay(date),
          lt: this.endOfDay(date),
        },
      },
      include: {
        newsArticle: true,
      },
    });

    if (signals.length === 0) {
      this.logger.debug(`No signals for geounit ${geoUnitId} on ${date.toDateString()}`);
      return;
    }

    // Calculate metrics
    const avgSentiment = this.calculateAverageSentiment(signals);
    const pulseScore = this.calculateWeightedPulse(signals);
    const dominantIssue = this.extractDominantIssue(signals);

    // Create or update DailyGeoStats
    await this.prisma.dailyGeoStats.upsert({
      where: {
        geoUnitId_date: {
          geoUnitId,
          date: this.dateOnly(date),
        },
      },
      create: {
        geoUnitId,
        date: this.dateOnly(date),
        avgSentiment,
        pulseScore,
        dominantIssue,
      },
      update: {
        avgSentiment,
        pulseScore,
        dominantIssue,
      },
    });

    this.logger.debug(
      `Updated DailyGeoStats for geounit ${geoUnitId}: ` +
      `avgSentiment=${avgSentiment.toFixed(2)}, ` +
      `pulse=${pulseScore.toFixed(2)}, ` +
      `issue=${dominantIssue}`,
    );
  }

  /**
   * APPROACH 1: Simple Keyword Frequency
   * Extract dominant issue based on keyword frequency in articles
   */
  private extractDominantIssue(signals: any[]): string | null {
    // Collect all article texts
    const allText = signals
      .map(s => (s.newsArticle?.title || '') + ' ' + (s.newsArticle?.summary || ''))
      .join(' ')
      .toLowerCase();

    // Split into words and remove stop words
    const words = allText
      .split(/\s+/)
      .filter(w => w.length > 3 && !this.STOP_WORDS.has(w));

    if (words.length === 0) {
      return null;
    }

    // Count frequency of issue keywords
    const issueScores: Record<IssueName, number> = {} as any;

    for (const [issueName, config] of Object.entries(ISSUE_KEYWORDS)) {
      issueScores[issueName as IssueName] = 0;

      for (const keyword of config.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = allText.match(regex) || [];
        issueScores[issueName as IssueName] += matches.length * config.weight;
      }
    }

    // Find issue with highest score
    const dominantIssue = Object.entries(issueScores)
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)[0];

    return dominantIssue ? dominantIssue[0] : null;
  }

  /**
   * Alternative Approach: Sentiment-Weighted Topics
   * Return issue with highest positive sentiment impact
   */
  private extractDominantIssueSentimentWeighted(signals: any[]): string | null {
    const allText = signals
      .map(s => (s.newsArticle?.title || '') + ' ' + (s.newsArticle?.summary || ''))
      .join(' ')
      .toLowerCase();

    const issueImpact: Record<IssueName, { count: number; avgSentiment: number }> = {} as any;

    for (const [issueName, config] of Object.entries(ISSUE_KEYWORDS)) {
      const relevantSignals = signals.filter(s => {
        const text = (s.newsArticle?.title || '') + ' ' + (s.newsArticle?.summary || '');
        return config.keywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(text));
      });

      if (relevantSignals.length > 0) {
        const avgSent = relevantSignals.reduce((sum, s) => sum + s.sentimentScore, 0) / relevantSignals.length;
        issueImpact[issueName as IssueName] = {
          count: relevantSignals.length,
          avgSentiment: avgSent,
        };
      }
    }

    // Return issue with highest positive impact (count × sentiment)
    const dominantIssue = Object.entries(issueImpact)
      .map(([issueName, data]) => ({
        issueName,
        impact: data.count * data.avgSentiment,
      }))
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))[0];

    return dominantIssue ? dominantIssue.issueName : null;
  }

  private calculateAverageSentiment(signals: any[]): number {
    if (signals.length === 0) return 0;
    return signals.reduce((sum, s) => sum + s.sentimentScore, 0) / signals.length;
  }

  private calculateWeightedPulse(signals: any[]): number {
    if (signals.length === 0) return 0;
    const totalWeighted = signals.reduce(
      (sum, s) => sum + (s.sentimentScore * s.confidence * (s.relevanceWeight || 1.0)),
      0,
    );
    return totalWeighted / signals.length;
  }

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private dateOnly(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
```

#### 3C. Register Service in Module

**File:** `backend/src/modules/analytics/analytics.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { DailyGeoStatsService } from './services/daily-geo-stats.service';
import { CandidatePulseService } from './services/candidate-pulse.service';
import { RelevanceCalculatorService } from './services/relevance-calculator.service';

@Module({
  providers: [
    CandidatePulseService,
    RelevanceCalculatorService,
    DailyGeoStatsService, // 🆕 Add this
  ],
})
export class AnalyticsModule {}
```

#### 3D. Create API Endpoint to Get Daily Stats

**File:** `backend/src/modules/analytics/controllers/analytics.controller.ts`

```typescript
@Get('daily-stats/:geoUnitId')
async getDailyStats(
  @Param('geoUnitId') geoUnitId: number,
  @Query('date') date?: string,
) {
  const targetDate = date ? new Date(date) : new Date();
  return this.analyticsService.getDailyStats(geoUnitId, targetDate);
}

@Get('daily-stats/:geoUnitId/month')
async getMonthlyStats(
  @Param('geoUnitId') geoUnitId: number,
  @Query('month') month: string, // YYYY-MM
) {
  return this.analyticsService.getMonthlyStats(geoUnitId, month);
}
```

### Testing

```typescript
// Unit Test: Keyword extraction
const keywords = ISSUE_KEYWORDS['INFRASTRUCTURE'].keywords;
expect(keywords).toContain('roads');
expect(keywords).toContain('metro');

// Integration Test: Dominant issue calculation
const signals = [
  { sentimentScore: 0.8, newsArticle: { title: 'New metro project approved' } },
  { sentimentScore: 0.6, newsArticle: { title: 'Road construction delayed' } },
];
const issue = service.extractDominantIssue(signals);
expect(issue).toBe('INFRASTRUCTURE');

// E2E Test: Daily stats updated
// Run computeStatsForGeoUnit and verify DailyGeoStats created
```

---

## 🎯 FEATURE 4: MULTI-GEOUNIT NEWS FETCHING

### Current Status
⚠️ **PARTIALLY DONE:**
- ✅ News linked to GeoUnits via GeoAttributionResolverService
- ✅ SentimentSignal created per resolved GeoUnit
- ❌ Not fetching for ALL geounits (only those with active entities)
- ❌ Cannot fetch "unlinked" news (e.g., "Karnataka news" not about any specific candidate)

### What Needs to Be Done

#### 4A. Add GeoUnit to EntityMonitoring

**Current Limitation:**
- Only monitors Candidates & Parties
- GeoUnits created reactively (when mentioned in articles)

**Solution:**
- Explicitly monitor GeoUnits (user can subscribe to "Karnataka", "Bangalore", etc.)
- Fetch news for all geographic levels

#### 4B. Implement Multi-Level GeoUnit Keywords

**File:** `backend/src/modules/news/services/news-keyword-builder.service.ts`

```typescript
async getKeywordsForGeoUnit(geoUnitId: number): Promise<string[]> {
  const geoUnit = await this.prisma.geoUnit.findUnique({
    where: { id: geoUnitId },
    include: { parent: true },
  });

  const keywords = [
    geoUnit.name,
    geoUnit.code,
    geoUnit.localName,
    // Add parent level keywords
    ...(geoUnit.parent?.name ? [geoUnit.parent.name] : []),
  ].filter(Boolean);

  return keywords;
}
```

#### 4C. Combine with Priority Scheduling

- Use EntityMonitoring priority field
- Fetch high-priority geos every hour
- Fetch low-priority geos every 6 hours
- Same as Feature 2 (Priority-Based News Fetching)

---

## 🎯 FEATURE 5: DAIL YGEO STATS BATCH SERVICE

### Current Status
⚠️ **PARTIALLY DONE:**
- DailyGeoStats table exists
- One method exists to compute manually
- Not triggered by any scheduler

### What Needs to Be Done

Already covered in **Feature 3** - DailyGeoStatsService includes:
- ✅ Nightly job to compute stats for all geos
- ✅ API endpoints to retrieve stats
- ✅ Dominant issue extraction
- ✅ Average sentiment calculation
- ✅ Weighted pulse calculation

---

## 🎯 FEATURE 6: SENTIMENT SIGNAL SCHEMA OPTIMIZATION

### Current Status
⚠️ **PARTIALLY DONE:**
- SentimentSignal stores per GeoUnit ✅
- When pulse calculated, must reverse-lookup through NewsArticle ❌ (inefficient)
- No direct link to entity mentions

### What Needs to Be Done

Already covered in **Feature 1** - Add fields to SentimentSignal:
- `relevanceWeight` - Pre-calculated weight
- `sourceEntityType` - What type of entity (CANDIDATE, PARTY, GEO_UNIT)
- `sourceEntityId` - ID of that entity

This enables:
- Direct querying by entity type
- No need to join through NewsArticle
- Faster pulse calculations
- Better indexing

---

## 🚀 IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1)
1. **Feature 1:** Relevance Weights
   - Update schema with relevanceWeight fields
   - Update SentimentAnalysisService to calculate and store
   - Add API endpoint
   - **Time:** 2-3 hours

### Phase 2: Scheduling (Week 2)
2. **Feature 2:** Priority-Based Fetching
   - Add priority field to EntityMonitoring
   - Create NewsIngestionSchedulerService with 3 tiers
   - Update existing NewsIngestionService
   - **Time:** 4-6 hours

### Phase 3: Analytics (Week 3)
3. **Feature 3:** Dominant Issue Extraction
   - Create issue keywords data file
   - Create DailyGeoStatsService with nightly job
   - Add API endpoints for daily/monthly stats
   - **Time:** 3-4 hours

### Phase 4: Integration (Week 4)
4. **Features 4-6:** Polish & Optimization
   - Add GeoUnit subscription support (Feature 4)
   - Verify DailyGeoStats batch job runs correctly (Feature 5)
   - Consider schema changes for optimization (Feature 6)
   - **Time:** 2-3 hours

---

## 📊 Summary Table

| Step | Feature | Files to Create | Files to Modify | Tests Needed | Est. Time |
|------|---------|-----------------|-----------------|--------------|-----------|
| 1 | Weights | - | schema.prisma, sentiment-analysis.service.ts | 8 unit/integration | 2-3h |
| 2 | Priority | news-ingestion-scheduler.service.ts | entity-monitoring, news-ingestion.service.ts | 6 cron/integration | 4-6h |
| 3 | Issues | issue-keywords.ts, daily-geo-stats.service.ts | analytics.module.ts | 8 unit/integration | 3-4h |
| 4 | GeoUnits | - | EntityMonitoring schema, keyword-builder | 4 integration | 2-3h |
| 5 | DailyStats | (included in #3) | (included in #3) | (included in #3) | - |
| 6 | Optimize | - | schema.prisma, pulse service queries | 6 performance | 2-3h |

---

## 🔧 Quick Start Command

Once implementation starts:

```bash
# 1. Create migration for relevance weights
cd backend
npx prisma migrate dev --name add_relevance_weights

# 2. Create service files
touch src/modules/analytics/services/daily-geo-stats.service.ts
touch src/modules/news/services/news-ingestion-scheduler.service.ts
touch src/modules/analytics/data/issue-keywords.ts

# 3. Run tests
npm run test

# 4. Verify services registered in modules
npm run build

# 5. Start and observe cron jobs
npm run start:dev
```

---

## 📞 Questions?

For each feature implementation:
- **Feature 1 & 6:** Focus on data model changes first
- **Feature 2:** Understand cron expressions and scheduler lifecycle
- **Feature 3:** Keyword matching and NLP approach choice
- **Feature 4:** EntityMonitoring patterns and GeoUnit hierarchy
- **Feature 5:** Batch job scheduling and error handling

All code examples use NestJS patterns already in your codebase.
