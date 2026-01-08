# PoliticAI - Implementation Visual Guide

> Complete data flows and diagrams for pending features

---

## 🎯 FEATURE 1: RELEVANCE WEIGHTS - DATA FLOW

### Current Flow (Before Feature 1)
```
Article Created
     │
     ├─→ NewsEntityMention { articleId, entityType, entityId }
     │
     └─→ SentimentAnalysisService
         ├─→ BERT Analysis
         │   └─→ sentimentScore, confidence
         │
         └─→ GeoAttributionResolver
             ├─→ Resolve to GeoUnits
             │
             └─→ SentimentSignal created
                 {
                   geoUnitId,
                   sourceRefId (articleId),
                   sentimentScore,
                   confidence,
                   // ❌ NO relevanceWeight stored
                   // ❌ NO entity link
                 }

Later: PulseCalculation
       │
       └─→ CandidatePulseService
           ├─→ Query SentimentSignals
           ├─→ Must JOIN NewsArticle → NewsEntityMention
           │   (To find entity types and calculate weight)
           └─→ Apply weight in memory
               (Calculated fresh, not persisted)
```

### New Flow (After Feature 1)
```
Article Created
     │
     ├─→ NewsEntityMention { articleId, entityType, entityId }
     │
     └─→ SentimentAnalysisService
         ├─→ BERT Analysis
         │   └─→ sentimentScore, confidence
         │
         ├─→ RelevanceCalculatorService
         │   └─→ Calculate weight based on entity mention
         │
         └─→ GeoAttributionResolver
             ├─→ Resolve to GeoUnits
             │
             └─→ FOR EACH resolved GeoUnit:
                 SentimentSignal created
                 {
                   geoUnitId,
                   sourceRefId (articleId),
                   sentimentScore,
                   confidence,
                   // ✅ NEW: relevanceWeight stored!
                   relevanceWeight: 1.0 (or 0.8, 0.6, etc.)
                   // ✅ NEW: entity info for fast lookup
                   sourceEntityType: 'CANDIDATE',
                   sourceEntityId: 123
                 }

Later: PulseCalculation
       │
       └─→ CandidatePulseService
           ├─→ Query SentimentSignals
           │   └─→ ✅ Direct query, NO NewsArticle join needed!
           │
           ├─→ effectiveScore = score × confidence × weight
           │   └─→ ✅ Weight already stored!
           │
           └─→ pulseScore = AVG(effectiveScores)
```

### Schema Changes
```
BEFORE:
┌─────────────────────────────────────┐
│ SentimentSignal                     │
├─────────────────────────────────────┤
│ id: Int @id                         │
│ geoUnitId: Int                      │
│ sourceType: DataSourceType          │
│ sourceRefId: Int                    │
│ sentiment: SentimentLabel           │
│ sentimentScore: Float               │
│ confidence: Float                   │
│ modelVersion: String?               │
│ createdAt: DateTime                 │
└─────────────────────────────────────┘

AFTER (Add 3 fields):
┌──────────────────────────────────────┐
│ SentimentSignal                      │
├──────────────────────────────────────┤
│ id: Int @id                          │
│ geoUnitId: Int                       │
│ sourceType: DataSourceType           │
│ sourceRefId: Int                     │
│ sentiment: SentimentLabel            │
│ sentimentScore: Float                │
│ confidence: Float                    │
│ modelVersion: String?                │
│ ✅ relevanceWeight: Float?           │ NEW
│ ✅ sourceEntityType: EntityType?     │ NEW
│ ✅ sourceEntityId: Int?              │ NEW
│ createdAt: DateTime                  │
│ @@index([relevanceWeight])           │ NEW INDEX
└──────────────────────────────────────┘
```

### Query Performance Comparison

```
BEFORE Feature 1:
─────────────────
SELECT ss.* FROM SentimentSignal ss
  JOIN NewsArticle na ON ss.sourceRefId = na.id
  JOIN NewsEntityMention nem ON na.id = nem.articleId
WHERE ss.geoUnitId = 456
  AND nem.entityType = 'CANDIDATE'
  AND nem.entityId = 123
  
Performance: ~200ms (3 joins)
Network: Multiple round trips

AFTER Feature 1:
────────────────
SELECT * FROM SentimentSignal
WHERE geoUnitId = 456
  AND sourceEntityType = 'CANDIDATE'
  AND sourceEntityId = 123
  AND relevanceWeight IS NOT NULL
  
Performance: ~50ms (index lookup)
Network: Single query
4x FASTER!
```

### API Response Example

```json
{
  "candidateId": 123,
  "candidateName": "Siddaramaiah",
  "partyName": "Congress",
  "pulseScore": 0.621,
  "trend": "RISING",
  "articlesAnalyzed": 24,
  "timeWindow": "7 days",
  "lastUpdated": "2026-01-09T15:30:00Z",
  "weightedContributions": [
    {
      "articleId": 5001,
      "title": "Congress welfare scheme approved",
      "publishedAt": "2026-01-09T10:00:00Z",
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
    {
      "articleId": 5002,
      "title": "Election commission announces dates",
      "publishedAt": "2026-01-08T14:20:00Z",
      "sentiment": "NEUTRAL",
      "sentimentScore": 0.12,
      "confidence": 0.78,
      "relevanceWeight": 0.85,
      "effectiveScore": 0.079,
      "sourceEntity": {
        "type": "GEO_UNIT",
        "id": 456,
        "name": "Bangalore South"
      }
    },
    {
      "articleId": 5003,
      "title": "Congress launches campaign",
      "publishedAt": "2026-01-07T16:45:00Z",
      "sentiment": "POSITIVE",
      "sentimentScore": 0.65,
      "confidence": 0.88,
      "relevanceWeight": 0.60,
      "effectiveScore": 0.343,
      "sourceEntity": {
        "type": "PARTY",
        "id": 789,
        "name": "Congress"
      }
    }
  ]
}
```

---

## 🎯 FEATURE 2: PRIORITY-BASED SCHEDULING - DATA FLOW

### Current State (All Equal)
```
┌─────────────────────────────────────────────────┐
│     NewsIngestionService.fetchAllNews()         │
│              (Every 1 hour)                      │
└────────┬────────────────────────────────────────┘
         │
    ┌────▼──────────────────────────────────────────────────┐
    │ Query ALL entities                                     │
    ├────────────────────────────────────────────────────────┤
    │ SELECT * FROM EntityMonitoring WHERE isActive = true   │
    │                                                         │
    │ Result: 150+ entities                                  │
    │  - 10 subscribed candidates (HIGH priority)            │
    │  - 20 districts (MEDIUM priority)                      │
    │  - 120 states/national news (LOW priority)             │
    └────┬───────────────────────────────────────────────────┘
         │
         └──→ ALL 150 fetched at SAME time, SAME frequency
             (All every 1 hour) ❌ INEFFICIENT
```

### After Feature 2 (Tiered Scheduling)
```
┌────────────────────────────────────────────────────────────────┐
│               PRIORITY-BASED SCHEDULER                          │
│              (NewsIngestionSchedulerService)                    │
└────────────────────┬───────────────────────────────────────────┘
         
         ┌─────────────────────────────────────────┐
         │ EVERY 1 HOUR (0 minutes past hour)      │
         └─────────────────┬───────────────────────┘
                           │
            ┌──────────────▼──────────────┐
            │ scheduleTier1()              │
            ├──────────────────────────────┤
            │ SELECT * WHERE priority >= 8 │
            │                              │
            │ 10 entities ✅               │
            │ Subscribed candidates        │
            │ Primary constituencies       │
            │ Party context                │
            └──────────────┬───────────────┘
                           │
                 FOR EACH entity:
                 fetchNewsForEntity()

         ┌─────────────────────────────────────────┐
         │ EVERY 2 HOURS (0 minutes, even hours)   │
         └─────────────────┬───────────────────────┘
                           │
            ┌──────────────▼──────────────┐
            │ scheduleTier2()              │
            ├──────────────────────────────┤
            │ SELECT * WHERE                │
            │   priority >= 5 AND < 8      │
            │                              │
            │ 35 entities ✅               │
            │ Districts                    │
            │ Adjacent constituencies      │
            │ Regional news                │
            └──────────────┬───────────────┘
                           │
                 FOR EACH entity:
                 fetchNewsForEntity()

         ┌─────────────────────────────────────────┐
         │ EVERY 6 HOURS (0 minutes, 6,12,18h)     │
         └─────────────────┬───────────────────────┘
                           │
            ┌──────────────▼──────────────┐
            │ scheduleTier3()              │
            ├──────────────────────────────┤
            │ SELECT * WHERE priority < 5  │
            │                              │
            │ 105 entities ✅              │
            │ Parent state                 │
            │ Other states                 │
            │ National news                │
            └──────────────┬───────────────┘
                           │
                 FOR EACH entity:
                 fetchNewsForEntity()
```

### Execution Timeline Example
```
Hours 0-24 in a single day:
═══════════════════════════════════════════════════════════════

00:00 ─→ Tier1 (10 entities) + Tier2 (35 entities) + Tier3 (105 entities)
         └─ Total: 150 entities fetched
         
01:00 ─→ Tier1 (10 entities)
         └─ Total: 10 entities fetched ✅ (114 SKIPPED this hour)
         
02:00 ─→ Tier1 (10 entities) + Tier2 (35 entities)
         └─ Total: 45 entities fetched
         
03:00 ─→ Tier1 (10 entities)
         └─ Total: 10 entities fetched
         
04:00 ─→ Tier1 (10 entities) + Tier2 (35 entities)
         └─ Total: 45 entities fetched
         
05:00 ─→ Tier1 (10 entities)
         └─ Total: 10 entities fetched
         
06:00 ─→ Tier1 (10 entities) + Tier2 (35 entities) + Tier3 (105 entities)
         └─ Total: 150 entities fetched

...continues pattern...

RESULTS IN 24 HOURS:
────────────────────
Tier1 (every 1h):   10 entities × 24 = 240 fetches
Tier2 (every 2h):   35 entities × 12 = 420 fetches
Tier3 (every 6h):  105 entities × 4 = 420 fetches
                              ─────────────────
                              TOTAL: 1,080 fetches

BEFORE (all every 1h):
150 entities × 24 = 3,600 fetches ❌ 3.3x MORE FETCHES!
```

### EntityMonitoring Priority Assignment
```
User subscribes to: Siddaramaiah
│
├─ Candidate: Siddaramaiah
│  └─ reason: SUBSCRIBED
│     priority: 10
│     tier: TIER 1 (every 1 hour)
│
├─ Party: Congress
│  └─ reason: PARTY_CONTEXT
│     priority: 8
│     tier: TIER 1 (every 1 hour)
│
├─ GeoUnit: Bangalore South (primary)
│  └─ reason: GEO_CONTEXT
│     priority: 9
│     tier: TIER 1 (every 1 hour)
│
├─ GeoUnit: Bangalore District (parent)
│  └─ reason: DISTRICT_CONTEXT
│     priority: 6
│     tier: TIER 2 (every 2 hours)
│
├─ GeoUnit: Karnataka State (grandparent)
│  └─ reason: STATE_CONTEXT
│     priority: 3
│     tier: TIER 3 (every 6 hours)
│
├─ Candidate: Opponent 1
│  └─ reason: OPPONENT
│     priority: 9
│     tier: TIER 1 (every 1 hour)
│
└─ Candidate: Opponent 2
   └─ reason: OPPONENT
      priority: 9
      tier: TIER 1 (every 1 hour)
```

### Priority Distribution
```
Tier 1 (Every 1 hour):     priority >= 8
  ├─ Subscribed candidates:      priority 10
  ├─ Primary constituencies:      priority 9
  ├─ Opposition candidates:       priority 9
  └─ Candidate's party:           priority 8
  TOTAL: ~10-15% of entities (HIGH FREQUENCY)

Tier 2 (Every 2 hours):    priority 5-7
  ├─ Parent districts:            priority 6
  ├─ Adjacent constituencies:     priority 5
  └─ Regional political news:     priority 5
  TOTAL: ~20-25% of entities (MEDIUM FREQUENCY)

Tier 3 (Every 6 hours):    priority < 5
  ├─ Parent state:                priority 3
  ├─ Other states:                priority 2
  └─ National political news:     priority 1
  TOTAL: ~60-70% of entities (LOW FREQUENCY)
```

---

## 🎯 FEATURE 3: DOMINANT ISSUE EXTRACTION - DATA FLOW

### Daily Computation Flow
```
┌──────────────────────────────────────────┐
│ 11:59 PM Every Night                     │
│ DailyGeoStatsService.computeDailyStats() │
└──────────────┬───────────────────────────┘
               │
               ├─→ Get all GeoUnits
               │
               └─→ FOR EACH GeoUnit:
                   │
                   ├─→ Query SentimentSignals for TODAY
                   │   WHERE geoUnitId = X AND createdAt = TODAY
                   │   Include: newsArticle
                   │
                   ├─→ Extract dominant issue
                   │   ├─→ Get all article texts
                   │   ├─→ Count keyword frequencies
                   │   └─→ Return highest scoring issue
                   │
                   ├─→ Calculate avgSentiment
                   │   = AVG(sentimentScore)
                   │
                   ├─→ Calculate pulseScore
                   │   = AVG(sentimentScore × confidence × weight)
                   │
                   └─→ UPS ERT DailyGeoStats
                       {
                         geoUnitId: X,
                         date: TODAY,
                         dominantIssue: "Infrastructure",
                         avgSentiment: 0.62,
                         pulseScore: 0.58
                       }
```

### Example: Today's Data for Bangalore
```
TODAY (2026-01-09): 15 new articles about Bangalore

Article 1: "Metro expansion project gets approval" 
  → Keywords: metro, expansion, construction, project
  
Article 2: "Education board announces new curriculum"
  → Keywords: education, curriculum, board, students
  
Article 3: "Road construction delays traffic"
  → Keywords: road, construction, traffic, delay
  
Article 4: "Welfare scheme launched in Bangalore"
  → Keywords: welfare, scheme, assistance, benefit
  
Article 5: "Infrastructure development plan announced"
  → Keywords: infrastructure, development, roads, bridge
  
Article 6: "Election commission postpones vote"
  → Keywords: election, vote, commission, ballot
  
Article 7: "Congress launches campaign in Bangalore"
  → Keywords: congress, campaign, election, party
  
Article 8: "Road construction delays traffic"
  → Keywords: road, construction, traffic, delay
  
... more articles ...

KEYWORD COUNTING:
─────────────────
INFRASTRUCTURE:
  metro (1) + expansion (1) + construction (3) + project (1) 
  + infrastructure (1) + development (1) + roads (1) + bridge (1)
  = 10 points ✅ HIGHEST

EDUCATION:
  education (1) + curriculum (1) + board (1) + students (1)
  = 4 points

WELFARE:
  welfare (1) + scheme (1) + assistance (1) + benefit (1)
  = 4 points

ELECTIONS:
  election (2) + vote (1) + commission (1) + ballot (1)
  + campaign (1) + congress (1)
  = 7 points

DOMINANT ISSUE: "INFRASTRUCTURE" (10 points)

STORED IN DailyGeoStats:
┌────────────────────────────────┐
│ geoUnitId: 456 (Bangalore)     │
│ date: 2026-01-09               │
│ dominantIssue: "INFRASTRUCTURE"│
│ avgSentiment: 0.62             │
│ pulseScore: 0.58               │
└────────────────────────────────┘
```

### Historical Trend Analysis
```
DailyGeoStats for Bangalore (Last 30 days):

Date        │ dominantIssue      │ avgSentiment │ pulseScore
────────────┼────────────────────┼──────────────┼──────────
2025-12-10  │ ELECTIONS          │    -0.15     │   -0.12
2025-12-11  │ ELECTIONS          │    -0.08     │   -0.05
2025-12-12  │ ELECTIONS          │     0.22     │    0.18
2025-12-13  │ INFRASTRUCTURE     │     0.35     │    0.42
2025-12-14  │ INFRASTRUCTURE     │     0.48     │    0.55
2025-12-15  │ WELFARE            │     0.32     │    0.28
2025-12-16  │ INFRASTRUCTURE     │     0.61     │    0.67
...
2026-01-08  │ CONTROVERSY        │    -0.42     │   -0.38
2026-01-09  │ INFRASTRUCTURE     │     0.62     │    0.58
                ▲
                └─ Today's dominant issue

PATTERN: Infrastructure discussions increasing in sentiment!
```

### API Response: Historical Trends
```json
{
  "geoUnitId": 456,
  "geoUnitName": "Bangalore South",
  "period": {
    "from": "2025-12-10",
    "to": "2026-01-09",
    "days": 31
  },
  "summary": {
    "mostFrequentIssue": "INFRASTRUCTURE",
    "frequencyCount": 12,
    "averageSentimentTrend": "RISING",
    "lastDayFocus": "INFRASTRUCTURE"
  },
  "dailyStats": [
    {
      "date": "2026-01-09",
      "dominantIssue": "INFRASTRUCTURE",
      "avgSentiment": 0.62,
      "pulseScore": 0.58,
      "articleCount": 15,
      "sentiment": {
        "positive": 10,
        "neutral": 3,
        "negative": 2
      }
    },
    {
      "date": "2026-01-08",
      "dominantIssue": "CONTROVERSY",
      "avgSentiment": -0.42,
      "pulseScore": -0.38,
      "articleCount": 8,
      "sentiment": {
        "positive": 1,
        "neutral": 2,
        "negative": 5
      }
    },
    // ... more days ...
  ]
}
```

---

## 🎯 FEATURE 4: MULTI-GEOUNIT FETCHING - HIERARCHY

### Geographic Hierarchy
```
NATIONAL (priority: 1)
    │
    ├─ INDIA
    │  └─ Articles about national elections, national policies
    │
    ├─ STATE (priority: 3)
    │  │
    │  ├─ KARNATAKA
    │  │  └─ Articles about Karnataka govt, Karnataka elections
    │  │
    │  ├─ TAMIL_NADU
    │  │  └─ Articles about Tamil Nadu govt
    │  │
    │  └─ ...other states...
    │
    ├─ DISTRICT (priority: 6)
    │  │
    │  ├─ BANGALORE_DISTRICT
    │  │  └─ Articles about Bangalore district news
    │  │
    │  ├─ BELGAUM_DISTRICT
    │  │  └─ Articles about Belgaum district
    │  │
    │  └─ ...other districts...
    │
    ├─ CONSTITUENCY (priority: 9)
    │  │
    │  ├─ BANGALORE_SOUTH
    │  │  └─ Articles about Bangalore South constituency
    │  │
    │  ├─ BANGALORE_CENTRAL
    │  │  └─ Articles about Bangalore Central
    │  │
    │  ├─ BELGAUM_CITY
    │  │  └─ Articles about Belgaum constituency
    │  │
    │  └─ ...other constituencies...
    │
    └─ WARD (priority: 9)
        │
        ├─ WARD_1 (Bangalore South)
        ├─ WARD_2 (Bangalore South)
        ├─ ...other wards...
```

### Candidate → GeoUnit Hierarchy
```
CANDIDATE: Siddaramaiah (id: 123)
    │
    ├─ Primary GeoUnit: Bangalore South (id: 456)
    │  │
    │  ├─ Parent: Bangalore District (id: 789)
    │  │  │
    │  │  └─ Parent: Karnataka State (id: 1)
    │  │
    │  └─ Related: Adjacent constituencies
    │     ├─ Bangalore Central
    │     ├─ Bangalore North
    │     └─ Bangalore North East
    │
    └─ Party: Congress (id: 999)
       │
       └─ Party State: Karnataka
          └─ Fetch for all districts in Karnataka
```

### News Subscription Scenarios

**Scenario 1: Subscribe to Candidate**
```
User subscribes: "Siddaramaiah"
│
EntityMonitoring records created:
├─ CANDIDATE: Siddaramaiah (priority: 10) → Tier 1 ✅
├─ PARTY: Congress (priority: 8) → Tier 1 ✅
├─ GEO_UNIT: Bangalore South (priority: 9) → Tier 1 ✅
├─ GEO_UNIT: Bangalore District (priority: 6) → Tier 2 ✅
├─ GEO_UNIT: Karnataka State (priority: 3) → Tier 3 ✅
└─ CANDIDATE: Opposition candidates (priority: 9) → Tier 1 ✅

News fetching:
Hour 1: Fetch for all Tier 1 entities
Hour 2: Fetch for Tier 2 only
Hour 6: Fetch for all Tier 3 entities
```

**Scenario 2: Subscribe to Geographic Unit**
```
User subscribes: "Karnataka"
│
EntityMonitoring records created:
├─ GEO_UNIT: Karnataka State (priority: 9) → Tier 1 ✅
│  └─ Fetch ALL news about Karnataka
│
└─ (Optionally) Also fetch for all children:
   ├─ Bangalore District (priority: 6) → Tier 2 ✅
   ├─ Belgaum District (priority: 6) → Tier 2 ✅
   ├─ Bangalore South Constituency (priority: 5) → Tier 2 ✅
   └─ ...all other districts & constituencies...
```

### GeoUnit News Keyword Building
```
Bangalore South Constituency:
│
├─ Direct names:
│  ├─ "Bangalore South"
│  ├─ "Bangalore (South)"
│  ├─ "Bangalore-South"
│  └─ "BLR-South"
│
├─ Local names:
│  ├─ "ಬೆಂಗಳೂರು ದಕ್ಷಿಣ" (Kannada)
│  └─ "South Bangalore"
│
├─ Parent hierarchy names:
│  ├─ "Bangalore District"
│  ├─ "Bangalore" (parent)
│  └─ "Karnataka" (grandparent)
│
└─ Final search query:
   ("Bangalore South" OR "Bangalore (South)" OR "BLR-South"
    OR "ಬೆಂಗಳೂರು ದಕ್ಷಿಣ" OR "South Bangalore"
    OR "Bangalore District")
   AND (election OR vote OR campaign OR policy)
```

---

## 📊 Complete Feature Dependency Graph

```
Feature 1: Relevance Weights
│
├─ Dependencies: NONE ✅
│
└─ Blocks: Feature 5, Feature 6
   
Feature 2: Priority-Based Scheduling
│
├─ Dependencies: NONE ✅
│
└─ Enables: Feature 4 (multi-geounit scheduling)

Feature 3: Dominant Issue Extraction
│
├─ Dependencies: NONE ✅
│
└─ Uses: SentimentSignal, NewsArticle

Feature 4: Multi-GeoUnit Fetching
│
├─ Dependencies: Feature 2 (priority scheduling)
│
└─ Recommends: Feature 1 (relevance weights)

Feature 5: DailyGeoStats Batch
│
├─ Dependencies: Feature 3 (issue extraction)
│
└─ Recommends: Feature 1 (pulse calculation)

Feature 6: Query Optimization
│
├─ Dependencies: Feature 1 (adds needed fields)
│
└─ Improves: Feature 5 performance

IMPLEMENTATION ORDER:
1 → 2 → 3 → 4 → 5 → 6
```

---

## 🔄 Complete System Data Flow (All Features)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FULL SYSTEM WITH ALL FEATURES                │
└─────────────────────────────────────────────────────────────────┘

SETUP PHASE:
─────────────
User subscribes to Candidate
    │
    ├─→ Create EntityMonitoring records with priorities
    │   ├─ CANDIDATE (priority 10) → Tier 1
    │   ├─ PARTY (priority 8) → Tier 1
    │   └─ GEO_UNIT (priority 9) → Tier 1
    │
    └─→ Generate NewsKeywords for each entity


HOURLY EXECUTION:
──────────────────

TIER 1 Scheduler (Every hour)
    │
    ├─→ Fetch news for high-priority entities (candidate, party, geo)
    │   ├─→ Build search queries from NewsKeywords
    │   ├─→ Query Google News API
    │   └─→ Create NewsArticle + NewsEntityMention
    │
    └─→ ASYNC: SentimentAnalysisService
        ├─→ BERT sentiment analysis
        ├─→ Calculate relevanceWeight (Feature 1)
        ├─→ Resolve to GeoUnits (Feature 4)
        └─→ Create SentimentSignal with all fields including weight
            {
              geoUnitId,
              sentimentScore,
              confidence,
              ✅ relevanceWeight,
              ✅ sourceEntityType,
              ✅ sourceEntityId
            }

TIER 2 Scheduler (Every 2 hours)
    │
    └─→ Fetch for medium-priority entities (districts, adjacent geos)

TIER 3 Scheduler (Every 6 hours)
    │
    └─→ Fetch for low-priority entities (states, national news)


EVENING COMPUTATION (11:59 PM):
────────────────────────────────

DailyGeoStatsService
    │
    ├─→ FOR EACH GeoUnit:
    │   │
    │   ├─→ Query SentimentSignals created today
    │   │   └─→ ✅ Fast query (Feature 1 indexes)
    │   │
    │   ├─→ Extract dominant issue (Feature 3)
    │   │   ├─→ Count keywords in article texts
    │   │   └─→ Find most frequent issue category
    │   │
    │   ├─→ Calculate avgSentiment
    │   │
    │   ├─→ Calculate pulseScore (Feature 5)
    │   │   └─→ ✅ Uses stored relevanceWeight (Feature 1)
    │   │
    │   └─→ UPSERT DailyGeoStats
    │       {
    │         geoUnitId,
    │         date,
    │         dominantIssue,    ← Feature 3
    │         avgSentiment,     ← Feature 5
    │         pulseScore        ← Feature 5 + Feature 1
    │       }
    │
    └─→ Alerts triggered based on thresholds


USER DASHBOARD QUERY:
──────────────────────

GET /analytics/pulse/:candidateId/detailed
    │
    ├─→ Query SentimentSignals for last 7 days
    │   └─→ ✅ Fast query using Feature 1 indexes
    │
    ├─→ Retrieve with weights
    │   └─→ ✅ relevanceWeight already stored
    │
    ├─→ Calculate top drivers
    │   └─→ ✅ Sort by effectiveScore (score × conf × weight)
    │
    └─→ Return detailed pulse response
        {
          pulseScore,
          trend,
          dominantIssue,         ← From Feature 3
          weightedContributions: [
            {
              article,
              effectiveScore,
              relevanceWeight,   ← Feature 1
              sourceEntity
            }
          ]
        }
```

---

## 💾 Database State Progression

### Day 1 (Before Features Implemented)
```
NewsArticle:        5,000 records
NewsEntityMention:  8,000 records
SentimentSignal:    6,000 records (NO weights, NO entity links)
DailyGeoStats:      0 records (empty)
EntityMonitoring:   150 records (NO priorities)
```

### Day 2 (After Feature 1: Weights)
```
NewsArticle:        5,000 records (unchanged)
NewsEntityMention:  8,000 records (unchanged)
SentimentSignal:    6,000 records (NOW with weights, entity links)
DailyGeoStats:      0 records (still empty)
EntityMonitoring:   150 records (still NO priorities)
```

### Day 3 (After Feature 2: Priorities)
```
NewsArticle:        5,100 records (10 new)
NewsEntityMention:  8,160 records (160 new)
SentimentSignal:    6,200 records (200 new, WITH weights)
DailyGeoStats:      0 records (still empty)
EntityMonitoring:   150 records (NOW WITH priorities)
                    ↓
                    Tier 1: 15 entities (priority >= 8)
                    Tier 2: 35 entities (priority 5-7)
                    Tier 3: 100 entities (priority < 5)
```

### Day 4 (After Feature 3: Dominant Issues)
```
NewsArticle:        5,200 records
NewsEntityMention:  8,360 records
SentimentSignal:    6,500 records
DailyGeoStats:      450 records ✅ (1 per geounit per day × 3 days)
EntityMonitoring:   150 records (with priorities)
```

---

**This guide provides complete visualization of all data flows and system interactions.**
