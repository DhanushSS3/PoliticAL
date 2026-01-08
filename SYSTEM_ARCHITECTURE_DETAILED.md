# PoliticAI System Architecture - Complete Technical Explanation

## Executive Overview

PoliticAI is a **sentiment analysis and intelligence platform** designed to track political news, analyze sentiment, compute real-time scores, and deliver actionable insights. The system processes news from multiple sources, enriches them with sentiment/confidence metrics, and aggregates data into daily statistics and pulse scores for geographic units, candidates, and parties.

---

## 🏗️ System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│          (Dashboard, Admin Panel, Analysis Tools)                │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼───┐  ┌─────▼────┐  ┌────▼──────┐
    │ NextJS │  │ NestJS   │  │  FastAPI  │
    │ Backend│  │ Backend  │  │  Analysis │
    └────┬───┘  └─────┬────┘  │ Service   │
         │             │       └────┬──────┘
         └─────────────┼─────────────┘
                       │
         ┌─────────────┼──────────────────┐
         │             │                  │
    ┌────▼──────┐  ┌───▼────┐  ┌────────▼─┐
    │PostgreSQL │  │ Prisma │  │  Python  │
    │ Database  │  │ Client │  │  Models  │
    └────┬──────┘  └─────────┘  └──────────┘
         │
    ┌────▼──────────────────────────────────┐
    │   ElectionData | News | Sentiment     │
    │   GeoStats | Candidates | Alerts      │
    └───────────────────────────────────────┘
```

---

## 📰 1. NEWS INGESTION SYSTEM

### 1.1 How News Gets Into The System

The news ingestion system fetches news articles from multiple sources and automatically links them to political entities.

#### Flow Diagram
```
┌──────────────────────────────────────────────────────────────────┐
│                  NEWS INGESTION FLOW                              │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│  Fetch Sources      │
│  • Google News RSS  │
│  • Manual Upload    │
│  • API Partner      │
└──────────┬──────────┘
           │
      ┌────▼─────────────────────────────────────────────────┐
      │ KEYWORD-BASED MATCHING (Hybrid Keyword System)       │
      │                                                       │
      │ For each Entity (Candidate/Party/GeoUnit):           │
      │ • Generate: ("Name" OR "Shortname") AND             │
      │            (election OR vote OR campaign OR ...)     │
      │ • Query: Google News RSS Feed                        │
      └────┬─────────────────────────────────────────────────┘
           │
      ┌────▼──────────────────────────────────────────────────────┐
      │ DEDUPLICATION & NORMALIZATION                             │
      │                                                            │
      │ For each RSS item:                                        │
      │ • Extract: title, summary, source, publishedAt, link     │
      │ • Check if URL already exists (dedup check)              │
      │ • If new: create NewsArticle in DB                       │
      │ • Link article to entity that triggered the fetch        │
      └────┬───────────────────────────────────────────────────────┘
           │
      ┌────▼──────────────────────────────────────────────────────┐
      │ CREATE ENTITY MENTION LINKS                               │
      │                                                            │
      │ For each article, create NewsEntityMention:               │
      │ • Candidate → Article triggered by Candidate name         │
      │ • Party → Article triggered by Party name                │
      │ • GeoUnit → Article triggered by State name              │
      └────┬───────────────────────────────────────────────────────┘
           │
      ┌────▼──────────────────────────────────────────────────────┐
      │ TRIGGER SENTIMENT ANALYSIS (Async)                        │
      │                                                            │
      │ Non-blocking call to sentiment service:                   │
      │ • Pass: article_id, title + summary text                 │
      │ • Service analyzes & stores SentimentSignal              │
      │ • Errors don't stop ingestion                            │
      └────────────────────────────────────────────────────────────┘
```

### 1.2 Key Components

#### A. **KeywordManagerService**
- **Responsibility**: Build search queries for news fetching
- **How it works**:
  ```
  Entity: "Siddaramaiah" (Candidate)
          ↓
  Base Keywords: "Siddaramaiah", "Siddaramaiah Karnataka"
          ↓
  Context Terms: "election", "vote", "campaign", "policy", "scandal"
          ↓
  Final Query: ("Siddaramaiah" OR "Siddaramaiah Karnataka") 
              AND (election OR vote OR campaign OR policy OR scandal)
          ↓
  Google News RSS URL: 
  https://news.google.com/rss/search?q=...&ceid=IN:en&hl=en-IN
  ```

#### B. **NewsIngestionService**
- **Scheduled Job**: Runs EVERY HOUR via `@Cron(CronExpression.EVERY_HOUR)`
- **Algorithm**:
  ```
  1. Fetch all Candidates from DB
  2. For each Candidate:
     a. Build search query via KeywordManagerService
     b. Query Google News RSS
     c. Process each RSS item
  3. Repeat for GeoUnits (State level) and Parties
  4. Log completion time
  ```

#### C. **ProcessFeedItem** (RSS Processing)
```
Input: RSS Item {title, link, pubDate, content, source}
       ↓
Step 1: Extract & Normalize
        • title, summary, sourceUrl, publishedAt
        ↓
Step 2: Deduplication Check
        • Query DB: EXISTS sourceUrl?
        • If yes: Link entity if not linked, then EXIT
        ↓
Step 3: Create NewsArticle
        • status: APPROVED (auto-approved from trusted RSS)
        • ingestType: API
        ↓
Step 4: Create Entity Link
        • NewsEntityMention {articleId, entityType, entityId}
        ↓
Step 5: Trigger Sentiment Analysis (Non-blocking)
        • sentimentService.analyzeAndStoreSentiment()
        ↓
Output: Article saved & sentiment job queued
```

### 1.3 Database Schema - News Tables

```sql
-- NewsArticle table
CREATE TABLE NewsArticle {
  id: Int @id                    -- Unique ID
  title: String                  -- "Election results: Karnataka..."
  summary: String @db.Text       -- Article excerpt
  sourceName: String             -- "The Hindu", "Google News", etc.
  sourceUrl: String              -- Full URL (unique)
  publishedAt: DateTime          -- Original publication time
  
  status: ModerationStatus       -- PENDING | APPROVED | REJECTED
  ingestType: NewsIngestType     -- API | SCRAPER | MANUAL | PARTNER
  
  sentimentSignals: [SentimentSignal]    -- Reverse relation
  entityMentions: [NewsEntityMention]    -- Which entities mentioned
  
  createdAt: DateTime            -- When ingested into PoliticAI
  updatedAt: DateTime
  
  @@index([status])              -- For moderation workflow
  @@index([publishedAt])         -- For sorting news
}

-- EntityMention: Maps articles to political entities
CREATE TABLE NewsEntityMention {
  id: Int @id
  articleId: Int                 -- Foreign key
  entityType: EntityType         -- CANDIDATE | PARTY | GEO_UNIT
  entityId: Int                  -- ID of the entity
  
  article: NewsArticle           -- Relation
  @@index([articleId])           -- Fast article lookup
  @@index([entityType, entityId])-- Fast entity lookup
}
```

### 1.4 News Ingestion Flow Sequence

```
TIME EXAMPLE: 10:00 AM IST (Scheduled Cron)
══════════════════════════════════════════════

10:00 AM → NewsIngestionService.fetchAllNews()
   │
   ├─→ Select all Candidates
   │     └─→ FOR "Siddaramaiah" (id=123)
   │         └─→ buildSearchQuery("Siddaramaiah")
   │             → Returns: ("Siddaramaiah" OR "Siddu") AND (election OR...)
   │         └─→ Query Google News RSS
   │             → 5 new articles found
   │         └─→ FOR each article:
   │             ├─→ Check if URL exists → NO
   │             ├─→ Create NewsArticle (status=APPROVED)
   │             ├─→ Create NewsEntityMention {
   │             │   articleId: 5001,
   │             │   entityType: "CANDIDATE",
   │             │   entityId: 123
   │             │ }
   │             └─→ ASYNC: sentimentService.analyze(5001, text)
   │
   ├─→ Select all State-level GeoUnits
   │     └─→ FOR "Karnataka" (id=456)
   │         └─→ Repeat process
   │
   └─→ Select all Parties
         └─→ FOR "Congress" (id=789)
             └─→ Repeat process

10:05 AM → All articles ingested
         → Sentiment analysis jobs running in parallel
```

---

## 🧠 2. SENTIMENT ANALYSIS SYSTEM

### 2.1 How Sentiment Scoring Works

The system uses a **BERT-based sentiment model** that rates text on a 5-star scale, then converts to a normalized score.

#### Sentiment Model Pipeline
```
┌──────────────────────────────────────────────────────────────────┐
│                   SENTIMENT ANALYSIS PIPELINE                     │
└──────────────────────────────────────────────────────────────────┘

INPUT: News Article Text
  Example: "Siddaramaiah announces new development policy for Bangalore constituency"
  │
  ├─► STEP 1: Language Detection (LangDetect)
  │   └─→ Detects: "en" (English)
  │
  ├─► STEP 2: Run BERT Model Inference
  │   ├─→ Model: Hugging Face transformer (multilingual-capable)
  │   ├─→ Input: Full article text
  │   └─→ Output: [prob_1star, prob_2star, prob_3star, prob_4star, prob_5star]
  │       Example: [0.02, 0.05, 0.10, 0.45, 0.38]
  │       (38% chance it's 5-star positive, 45% chance it's 4-star positive)
  │
  ├─► STEP 3: Calculate Weighted Score (-1.0 to +1.0)
  │   Formula: score = Σ(prob[i] × weight[i])
  │   
  │   Where weights are:
  │   • 1 star  → -1.0  (NEGATIVE)
  │   • 2 stars → -0.5  (NEGATIVE)
  │   • 3 stars →  0.0  (NEUTRAL)
  │   • 4 stars → +0.5  (POSITIVE)
  │   • 5 stars → +1.0  (POSITIVE)
  │
  │   Example Calculation:
  │   score = (0.02 × -1.0) + (0.05 × -0.5) + (0.10 × 0.0) + (0.45 × 0.5) + (0.38 × 1.0)
  │        = -0.02 + (-0.025) + 0 + 0.225 + 0.38
  │        = 0.558 → POSITIVE
  │
  ├─► STEP 4: Determine Primary Label
  │   • Find max probability across 5 classes
  │   • Map to label:
  │     - prob[0] or prob[1] > max → "NEGATIVE"
  │     - prob[2] > max             → "NEUTRAL"
  │     - prob[3] or prob[4] > max  → "POSITIVE"
  │
  │   Example: max(probs) = 0.45 at index 3 → "POSITIVE"
  │
  ├─► STEP 5: Calculate Confidence
  │   confidence = max(probs) = 0.45
  │   (Higher = more certain about the prediction)
  │
  └─► OUTPUT: SentimentResponse {
      label: "POSITIVE",
      score: 0.5580,
      confidence: 0.4500,
      model_version: "kn-en-v1",
      language: "en"
    }
```

### 2.2 Sentiment Service Flow

```typescript
// Pseudo-code Flow
async analyzeAndStoreSentiment(articleId, content, geoUnitId?) {
  // 1. Call Python microservice
  response = await httpService.post(
    "http://localhost:8000/analyze/sentiment",
    { content, language: "auto", context: "political_news" }
  )
  // Returns: {label, score, confidence, model_version, language}

  // 2. Determine target GeoUnit(s)
  // Three strategies:
  //   a) Explicit override (if provided): geoUnitId = provided value
  //   b) Waterfall resolver: resolveGeoUnits(articleId)
  //   c) Fallback: Karnataka state
  
  targetGeoUnitIds = await geoResolver.resolveGeoUnits(articleId)
  
  // 3. Store SentimentSignal for each GeoUnit
  for (gid of targetGeoUnitIds) {
    await prisma.sentimentSignal.create({
      geoUnitId: gid,
      sourceType: "NEWS",
      sourceRefId: articleId,
      sentiment: response.label,        // "POSITIVE"
      sentimentScore: response.score,   // 0.558
      confidence: response.confidence,  // 0.45
      modelVersion: response.model_version
    })
  }
}
```

### 2.3 Understanding Confidence Score

**Confidence** measures how certain the BERT model is about its prediction.

```
Example Prediction Probabilities:
Text: "Development work progressing well"
Model Output: [0.01, 0.02, 0.05, 0.50, 0.42]

Interpretation:
- 1% chance it's 1-star (very negative)
- 2% chance it's 2-star (negative)
- 5% chance it's 3-star (neutral)
- 50% chance it's 4-star (positive) ← MAX
- 42% chance it's 5-star (very positive)

Label: "POSITIVE" (index 3 has max prob)
Confidence: 0.50 (highest probability value)

Meaning: The model is 50% confident it's 4-star positive.
         (Not super high, but respectable)

High Confidence Example (0.85+):
[0.01, 0.02, 0.02, 0.05, 0.90]
→ Model is 90% sure it's 5-star positive (very strong signal)

Low Confidence Example (0.35):
[0.20, 0.20, 0.25, 0.25, 0.10]
→ Model is confused, gives uncertain prediction (should be discounted in analysis)
```

### 2.4 SentimentSignal Table

```sql
CREATE TABLE SentimentSignal {
  id: Int @id
  geoUnitId: Int                    -- Which geographic region
  sourceType: DataSourceType        -- NEWS or ANALYST
  sourceRefId: Int                  -- NewsArticle.id or AnalystReport.id
  
  sentiment: SentimentLabel         -- POSITIVE | NEUTRAL | NEGATIVE
  sentimentScore: Float             -- -1.0 to +1.0 (normalized)
  confidence: Float                 -- 0.0 to 1.0 (certainty)
  modelVersion: String              -- "kn-en-v1" for traceability
  
  createdAt: DateTime               -- When signal was generated
  
  geoUnit: GeoUnit                  -- Reverse relation
  newsArticle: NewsArticle          -- Article that created this signal
  
  @@index([geoUnitId, createdAt])   -- Time-series queries
  @@index([sourceType])             -- Filter by source
}
```

---

## 🌍 3. GEO-ATTRIBUTION SYSTEM

### 3.1 The Waterfall Resolver

When a news article is ingested, the system needs to know which geographic region(s) it's relevant to. The **GeoAttributionResolverService** implements a 4-step waterfall strategy.

#### Waterfall Logic
```
┌──────────────────────────────────────────────────────────────────┐
│         GEO-ATTRIBUTION WATERFALL RESOLVER                        │
└──────────────────────────────────────────────────────────────────┘

ARTICLE: "Siddaramaiah launches scheme in Bangalore constituency"
ENTITY MENTIONS in NewsEntityMention:
  ├─ {entityType: "CANDIDATE", entityId: 123}  ← Siddaramaiah
  ├─ {entityType: "GEO_UNIT", entityId: 456}   ← Bangalore constituency
  └─ (no PARTY mentions)

RESOLVER STEPS:
═════════════════

STEP 1: Check for EXPLICIT GEO_UNIT mentions
  ├─ Find all mentions where entityType = "GEO_UNIT"
  ├─ Found: [{entityId: 456}]
  └─ RETURN [456] ✓ (STOP HERE - explicit trumps everything)

(If no GEO_UNIT mentions, continue...)

STEP 2: Check for CANDIDATE mentions
  ├─ Find all mentions where entityType = "CANDIDATE"
  ├─ For each candidate:
  │   └─ Look up CandidateProfile.primaryGeoUnitId
  │       • Candidate 123 → Profile.primaryGeoUnitId = 456
  ├─ Collect all resolved GeoUnitIds: [456]
  └─ If found ANY: RETURN [456] ✓ (STOP HERE)

(If no CANDIDATE→GeoUnit resolution, continue...)

STEP 3: Check for PARTY mentions
  ├─ Find all mentions where entityType = "PARTY"
  ├─ For each party:
  │   └─ Default to state-level GeoUnit
  │       • Example: Congress → Karnataka state (id: 1)
  ├─ Collect: [1]
  └─ If found: RETURN [1] ✓ (STOP HERE)

(If ALL else fails, use fallback...)

STEP 4: FALLBACK
  ├─ Use hardcoded fallback state
  └─ RETURN [1] (Karnataka state GeoUnit)

RESULT for this article: GeoUnitId = 456 (Bangalore constituency)
═══════════════════════════════════════════════════════════════════
```

### 3.2 Example Waterfall Scenarios

#### Scenario 1: Explicit Geo-Unit Mention
```
Article: "Election commission announces poll dates for Bangalore"
Entity Mentions:
  - GEO_UNIT: id=456 (Bangalore)

Resolution:
  Step 1: Found GEO_UNIT mention → Return [456]
  
Result: Sentiment → Bangalore (geo level)
```

#### Scenario 2: Candidate Mention (No Explicit Geo)
```
Article: "Siddaramaiah announces 2% DA hike for government employees"
Entity Mentions:
  - CANDIDATE: id=123 (Siddaramaiah)
  
Resolution:
  Step 1: No GEO_UNIT mentions
  Step 2: Found CANDIDATE mention
          → Look up CandidateProfile {candidateId: 123}
          → Find primaryGeoUnitId = 456 (Bangalore)
          → Return [456]
          
Result: Sentiment → Bangalore (via candidate's constituency)
```

#### Scenario 3: Party Mention Only
```
Article: "Congress criticizes GST on agriculture"
Entity Mentions:
  - PARTY: id=789 (Congress)
  
Resolution:
  Step 1: No GEO_UNIT mentions
  Step 2: No CANDIDATE mentions
  Step 3: Found PARTY mention
          → Resolve to state level
          → Return [1] (Karnataka)
          
Result: Sentiment → Karnataka state level
```

#### Scenario 4: No Entity Mentions (Fallback)
```
Article: "Indian election analysis for 2024"
Entity Mentions: [] (empty)

Resolution:
  Step 1-3: No mentions found
  Step 4: Use fallback
          → Return [1] (Karnataka)
          
Result: Sentiment → Karnataka (fallback state)
```

### 3.3 Geographic Hierarchy

```
India
 ├─ Karnataka (State, level=STATE)
 │   ├─ Bangalore District (level=DISTRICT)
 │   │   ├─ Bangalore South Constituency (level=CONSTITUENCY)
 │   │   │   ├─ Ward 45 (level=WARD)
 │   │   │   └─ Ward 46
 │   │   ├─ Bangalore North Constituency
 │   │   └─ Bangalore Central Constituency
 │   ├─ Mysore District
 │   │   └─ Mysore City Constituency
 │   └─ Belagavi District
 │
 └─ (other states)
```

Each GeoUnit has:
```typescript
{
  id: 456,
  name: "Bangalore South",
  level: GeoLevel.CONSTITUENCY,
  parentId: 789,  // parent district
  // Self-referential hierarchy for traversal
}
```

---

## 📊 4. DAILY GEO STATS & PULSE ANALYSIS

### 4.1 DailyGeoStats Table

```sql
CREATE TABLE DailyGeoStats {
  id: Int @id
  geoUnitId: Int              -- Which region
  date: DateTime @db.Date     -- ISO date (YYYY-MM-DD)
  
  avgSentiment: Float         -- Average sentiment score for the day
  pulseScore: Float           -- Composite health score (0.0-1.0)
  dominantIssue: String       -- Most discussed topic
  
  @@unique([geoUnitId, date]) -- One record per region per day
  @@index([date])             -- Fast time-range queries
}
```

### 4.2 Pulse Score Calculation

The **Pulse Score** is a composite metric that measures the overall "health" or "momentum" of a candidate/region.

#### Pulse Score Formula
```
┌──────────────────────────────────────────────────────────────────┐
│              PULSE SCORE CALCULATION                              │
└──────────────────────────────────────────────────────────────────┘

INPUT DATA (7-day window):
  Article 1: title="Development success", 
             sentiment=POSITIVE, sentimentScore=0.75, confidence=0.85
  Article 2: title="Policy controversy", 
             sentiment=NEGATIVE, sentimentScore=-0.60, confidence=0.90
  Article 3: title="Election announcement", 
             sentiment=NEUTRAL, sentimentScore=0.10, confidence=0.55

STEP 1: Calculate Relevance Weight
  ├─ For CANDIDATE pulse:
  │   └─ Direct mention: weight = 1.0
  │   └─ Party mention: weight = 0.7
  │   └─ Constituency mention: weight = 0.8
  │
  └─ Formula: relevanceWeight = context weight × decay factor
     (decay factor decreases with age)

STEP 2: Calculate Effective Score
  ├─ effectiveScore = sentimentScore × confidence × relevanceWeight
  │
  │ Example for Article 1:
  │ effectiveScore = 0.75 × 0.85 × 1.0 = 0.6375 (direct mention)
  │
  │ Example for Article 2:
  │ effectiveScore = -0.60 × 0.90 × 0.8 = -0.432 (party mention)
  │
  │ Example for Article 3:
  │ effectiveScore = 0.10 × 0.55 × 0.75 = 0.04125 (constituency mention)

STEP 3: Calculate Pulse (Weighted Average)
  ├─ pulseScore = AVG(effectiveScores)
  ├─ = (0.6375 + (-0.432) + 0.04125) / 3
  ├─ = 0.24675 / 3
  └─ = 0.08225

STEP 4: Normalize to 0.0-1.0 Range
  ├─ Raw pulse can be -1.0 to +1.0
  ├─ Normalize: normalizedPulse = (rawPulse + 1.0) / 2.0
  ├─ = (0.08225 + 1.0) / 2.0
  └─ = 0.541 (54.1% positive sentiment)

OUTPUT:
  ├─ Pulse Score: 0.541 (on 0.0-1.0 scale)
  ├─ Label: "RISING" or "STABLE" or "DECLINING"
  │  (determined by comparison to baseline)
  └─ Top Drivers: [Article 1 (0.6375), Article 2 (-0.432), ...]

INTERPRETATION:
═════════════════
pulseScore = 0.0  → Very negative sentiment (toxic coverage)
pulseScore = 0.5  → Neutral sentiment (balanced coverage)
pulseScore = 1.0  → Very positive sentiment (excellent coverage)
```

### 4.3 CandidatePulseService Implementation

```typescript
// Pseudo-code for calculatePulse()
async calculatePulse(candidateId: number, days: number = 7) {
  // 1. Get candidate + party info
  candidate = await db.candidate.findUnique(candidateId)
  party = candidate.party
  profile = candidate.profile  // contains primaryGeoUnitId
  
  // 2. Get sentiment signals from last N days
  signals = await db.sentimentSignal.findMany({
    where: {
      createdAt: {gte: dateRange.start, lte: dateRange.end},
      newsArticle: {
        entityMentions: {
          some: {
            OR: [
              {entityType: "CANDIDATE", entityId: candidateId},
              {entityType: "PARTY", entityId: party.id},
              {entityType: "GEO_UNIT", entityId: profile.primaryGeoUnitId}
            ]
          }
        }
      }
    }
  })
  
  // 3. Calculate effective scores
  scoredSignals = signals.map(signal => {
    relevanceWeight = calculateRelevanceWeight(signal, candidateId, ...)
    effectiveScore = signal.sentimentScore 
                   × signal.confidence 
                   × relevanceWeight
    return {signal, relevanceWeight, effectiveScore}
  })
  
  // 4. Calculate pulse
  pulseScore = AVG(scoredSignals.map(s => s.effectiveScore))
  
  // 5. Determine trend
  trend = "RISING" | "STABLE" | "DECLINING"
         (by comparing last 2 days vs 7-day baseline)
  
  // 6. Get top drivers (highest impact articles)
  topDrivers = scoredSignals.sort((a,b) => abs(b.effectiveScore) - abs(a.effectiveScore))
                             .slice(0, 5)
  
  return {
    candidateId, candidateName, partyName,
    pulseScore, trend, topDrivers,
    articlesAnalyzed: signals.length,
    lastUpdated: now()
  }
}
```

### 4.4 Pulse Response Example

```json
{
  "candidateId": 123,
  "candidateName": "Siddaramaiah",
  "partyName": "Indian National Congress",
  "pulseScore": 0.621,
  "trend": "RISING",
  "articlesAnalyzed": 8,
  "timeWindow": "7 days",
  "lastUpdated": "2025-01-08T14:32:00Z",
  "topDrivers": [
    {
      "articleId": 5001,
      "headline": "Development projects launched across Karnataka",
      "sentiment": "POSITIVE",
      "sentimentScore": 0.75,
      "confidence": 0.88,
      "relevanceWeight": 1.0,
      "effectiveScore": 0.66,
      "publishedAt": "2025-01-08T10:00:00Z"
    },
    {
      "articleId": 5002,
      "headline": "Congress announces welfare scheme",
      "sentiment": "POSITIVE",
      "sentimentScore": 0.68,
      "confidence": 0.82,
      "relevanceWeight": 0.7,
      "effectiveScore": 0.392,
      "publishedAt": "2025-01-08T09:30:00Z"
    }
  ]
}
```

### 4.5 Pulse Trend Calculation

```typescript
async calculateTrend(candidateId: number, days: number): Promise<Trend> {
  SPIKE_THRESHOLD = 0.15  // 15% change minimum to be a trend
  
  // Get recent pulse (last 1-2 days)
  recentPulse = await calculatePulse(candidateId, 1)
  // recentPulse.pulseScore = 0.72
  
  // Get baseline pulse (last N days)
  baselinePulse = await calculatePulse(candidateId, days)
  // baselinePulse.pulseScore = 0.58
  
  // Calculate delta
  delta = abs(recentPulse.pulseScore - baselinePulse.pulseScore)
       = abs(0.72 - 0.58)
       = 0.14
  
  // Determine trend
  if (delta > SPIKE_THRESHOLD) {
    direction = recentPulse.pulseScore > baselinePulse.pulseScore ? "RISING" : "DECLINING"
  } else {
    direction = "STABLE"
  }
  
  return direction  // "RISING" | "STABLE" | "DECLINING"
}
```

---

## 🚨 5. ALERT SYSTEM

### 5.1 Alert Types

The system automatically detects three types of anomalies and triggers alerts:

#### Type 1: Sentiment Spike
```
DETECTION LOGIC:
═════════════════

Threshold: Δ (change) ≥ 0.35
Minimum signals: ≥ 3 articles in 24h

Example 1: SPIKE DETECTED
  ├─ Yesterday's pulse: 0.45
  ├─ Today's pulse: 0.82
  ├─ Delta: |0.82 - 0.45| = 0.37 ≥ 0.35 ✓
  └─ Alert: "Positive sentiment spike detected!"

Example 2: NO SPIKE
  ├─ Baseline pulse: 0.50
  ├─ Recent pulse: 0.58
  ├─ Delta: |0.58 - 0.50| = 0.08 < 0.35 ✗
  └─ No alert

Alert Message:
  "🚨 Sentiment positive spike detected! Change: +0.37 (3+ articles in last 24h)"
```

#### Type 2: Negative Surge
```
DETECTION LOGIC:
═════════════════

Requirement: ≥ 3 negative articles with confidence ≥ 0.80 in 24h

Example: SURGE DETECTED
  ├─ Found articles in last 24h:
  │   ├─ Article 1: NEGATIVE, confidence=0.85 ✓
  │   ├─ Article 2: NEGATIVE, confidence=0.82 ✓
  │   ├─ Article 3: NEGATIVE, confidence=0.88 ✓
  │   └─ Article 4: NEUTRAL, confidence=0.60 ✗
  ├─ Count: 3 ≥ 3 ✓
  └─ Alert: "Negative coverage surge detected!"

Alert Message:
  "⚠️ Negative coverage surge: 3 high-confidence negative articles detected in last 24 hours"
```

#### Type 3: High-Confidence Hit
```
DETECTION LOGIC:
═════════════════

Requirement: Single article with:
  • Sentiment: NEGATIVE
  • sentimentScore ≤ -0.70
  • confidence ≥ 0.90

Example: HIT DETECTED
  Article: "Corruption charges filed against candidate"
  ├─ sentiment: NEGATIVE
  ├─ sentimentScore: -0.85 ≤ -0.70 ✓
  ├─ confidence: 0.92 ≥ 0.90 ✓
  └─ Alert: "High-impact negative article detected!"

Alert Message:
  "🔴 Breaking news alert: High-confidence negative article - 
   'Corruption charges filed against candidate' (confidence: 0.92)"
```

### 5.2 Alert Service Architecture

```typescript
@Injectable()
export class AlertService {
  @Cron(CronExpression.EVERY_HOUR)  // Runs every hour
  async detectAlerts() {
    // 1. Get all candidates with profiles
    candidates = await db.candidateProfile.findMany()
    
    // 2. For each candidate with a subscribed user
    for (profile of candidates) {
      if (profile.userId) {  // Only if user exists
        await checkCandidateAlerts(profile.candidateId, profile.userId)
      }
    }
  }
  
  private async checkCandidateAlerts(candidateId, userId) {
    // Run all three alert checks in parallel
    await Promise.all([
      checkSentimentSpike(candidateId, userId),
      checkNegativeSurge(candidateId, userId),
      checkHighConfidenceHits(candidateId, userId)
    ])
  }
}
```

### 5.3 Alert Storage

```sql
CREATE TABLE Alert {
  id: Int @id
  userId: Int                    -- Who receives the alert
  geoUnitId: Int                 -- Which region/candidate
  type: AlertType                -- SENTIMENT_SPIKE | CONTROVERSY | NEWS_MENTION
  message: String @db.Text       -- "🚨 Sentiment spike detected..."
  isRead: Boolean @default(false)-- User can mark as read
  
  createdAt: DateTime            -- When alert was generated
  
  user: User                     -- Relation
  @@index([userId, createdAt])   -- User's recent alerts
}
```

---

## 🔄 6. DATA FLOW DIAGRAMS

### 6.1 Complete End-to-End Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│               COMPLETE NEWS-TO-INSIGHT PIPELINE                          │
└──────────────────────────────────────────────────────────────────────────┘

HOURLY SCHEDULE (10:00 AM IST)
│
├─→ NEWS INGESTION (NewsIngestionService.fetchAllNews)
│   └─→ For each Candidate/Party/GeoUnit:
│       └─→ Build keyword query
│           └─→ Query Google News RSS
│               └─→ Save articles + create entity links
│                   └─→ ASYNC: Trigger sentiment analysis
│                       └─→ SentimentAnalysisService.analyze()
│
├─→ SENTIMENT ANALYSIS (SentimentAnalysisService)
│   └─→ For each article:
│       ├─→ Call Python BERT model
│       │   └─→ Returns: {label, score, confidence}
│       │
│       ├─→ Resolve GeoUnit(s) via waterfall resolver
│       │   └─→ Priority: Explicit GEO → CANDIDATE → PARTY → FALLBACK
│       │
│       └─→ Create SentimentSignal(s)
│           └─→ Store in DB with geoUnitId + sentiment score
│
├─→ DAILY STATS COMPUTATION (Scheduled nightly 11:59 PM)
│   └─→ For each GeoUnit:
│       └─→ Aggregate all sentiment signals from the day
│           └─→ Calculate: avgSentiment, pulseScore, dominantIssue
│               └─→ Create/update DailyGeoStats record
│
├─→ PULSE CALCULATION (On-demand or cached)
│   └─→ For requested candidate:
│       ├─→ Fetch all relevant sentiment signals (7-day window)
│       ├─→ Calculate effective scores
│       │   └─→ effectiveScore = sentimentScore × confidence × relevanceWeight
│       ├─→ Compute pulse = AVG(effectiveScores)
│       ├─→ Determine trend (RISING/STABLE/DECLINING)
│       └─→ Identify top drivers (highest impact articles)
│
├─→ ALERT DETECTION (Hourly background job)
│   └─→ For each candidate with subscribed user:
│       ├─→ Check Sentiment Spike (Δ ≥ 0.35)
│       ├─→ Check Negative Surge (≥3 articles, confidence ≥0.80)
│       └─→ Check High-Confidence Hit (score ≤-0.70, confidence ≥0.90)
│           └─→ Create Alert record if triggered
│
└─→ API RESPONSE TO DASHBOARD
    └─→ User requests candidate pulse
        ├─→ Return: pulseScore, trend, topDrivers, sentiment timeline
        └─→ Dashboard displays with graphs and notifications
```

### 6.2 Request-Response Cycle

```
USER REQUEST: GET /api/analytics/pulse/candidate/123?days=7
│
├─→ BACKEND (NestJS) receives request
│   └─→ AnalyticsController.getPulseTrend(candidateId=123, days=7)
│       └─→ CandidatePulseService.calculatePulse(123, 7)
│           │
│           ├─→ Step 1: Fetch candidate + profile
│           │   └─→ Get candidate.partyId, profile.primaryGeoUnitId
│           │
│           ├─→ Step 2: Query SentimentSignal entities
│           │   └─→ WHERE createdAt BETWEEN [now-7days, now]
│           │           AND newsArticle.entityMentions has candidate/party/geo
│           │
│           ├─→ Step 3: Calculate scores
│           │   └─→ FOR each signal:
│           │       └─→ effectiveScore = score × confidence × relevance
│           │
│           ├─→ Step 4: Compute metrics
│           │   ├─→ pulseScore = AVG(effectiveScores)
│           │   ├─→ trend = compare recent vs baseline
│           │   └─→ topDrivers = top 5 articles by impact
│           │
│           └─→ RETURN PulseData object
│
└─→ FRONTEND (React) receives response
    └─→ Display:
        ├─→ Large pulse score card (0.621)
        ├─→ Trend indicator (↑ RISING)
        ├─→ Articles count (8 analyzed)
        ├─→ Top driver articles with sentiment badges
        └─→ Time-series graph of pulse over 7 days
```

---

## 📈 7. REAL-WORLD EXAMPLE

### Complete Example: Tracking Siddaramaiah

**Scenario:** Candidate "Siddaramaiah" (Congress) in Bangalore South constituency

#### Day 1: News Ingestion (10:00 AM)
```
SCHEDULE: Hourly news fetch job runs
│
├─→ Find all active candidates
│   └─→ Include Candidate: Siddaramaiah (id=123, party_id=789)
│
├─→ Build search query for Siddaramaiah
│   └─→ Query: ("Siddaramaiah" OR "Siddu") AND (election OR vote OR campaign...)
│
├─→ Query Google News RSS
│   └─→ Found 3 articles:
│
│       Article 1: "Siddaramaiah announces infrastructure project for Bangalore"
│       • URL: news.google.com/...
│       • Published: 2025-01-08 08:00 AM
│       • Source: The Hindu
│
│       Article 2: "Congress launches welfare scheme - Siddaramaiah leads"
│       • URL: news.google.com/...
│       • Published: 2025-01-08 09:15 AM
│       • Source: Deccan Herald
│
│       Article 3: "Election analysis: Siddaramaiah's chances in Bangalore"
│       • URL: news.google.com/...
│       • Published: 2025-01-08 09:45 AM
│       • Source: The News Minute
│
├─→ For each article:
│   ├─→ Check dedup: URL not in DB → CREATE NewsArticle
│   ├─→ Create NewsEntityMention {articleId, entityType: CANDIDATE, entityId: 123}
│   └─→ TRIGGER async sentiment analysis
│
└─→ Articles saved, sentiment jobs queued
```

#### Parallel: Sentiment Analysis
```
PYTHON SERVICE processes 3 articles asynchronously

Article 1: "Siddaramaiah announces infrastructure project..."
  ├─→ BERT Model processes full text
  ├─→ Output probabilities: [0.02, 0.05, 0.15, 0.43, 0.35]
  ├─→ Label: POSITIVE (index 3 has 0.43)
  ├─→ Score: 0.02×(-1) + 0.05×(-0.5) + 0.15×0 + 0.43×0.5 + 0.35×1 = 0.515
  └─→ Confidence: 0.43
  
  Store SentimentSignal:
  • geoUnitId: 456 (Bangalore South, resolved via CandidateProfile.primaryGeoUnitId)
  • sentiment: POSITIVE
  • sentimentScore: 0.515
  • confidence: 0.43
  • modelVersion: "kn-en-v1"

Article 2: "Congress launches welfare scheme..."
  ├─→ BERT: [0.01, 0.04, 0.12, 0.50, 0.33]
  ├─→ Label: POSITIVE
  ├─→ Score: 0.535
  └─→ Confidence: 0.50
  
  Store SentimentSignal (with partyId=789 in entity mentions)
  • geoUnitId: 1 (Karnataka state, resolved via Party → state fallback)
  • sentiment: POSITIVE
  • sentimentScore: 0.535
  • confidence: 0.50

Article 3: "Election analysis: Siddaramaiah's chances..."
  ├─→ BERT: [0.05, 0.10, 0.35, 0.30, 0.20]
  ├─→ Label: NEUTRAL
  ├─→ Score: 0.075
  └─→ Confidence: 0.35
  
  Store SentimentSignal
  • geoUnitId: 456 (Bangalore South)
  • sentiment: NEUTRAL
  • sentimentScore: 0.075
  • confidence: 0.35
```

#### Day 2: Pulse Calculation (User requests dashboard)
```
USER: GET /api/analytics/pulse/candidate/123?days=7

BACKEND CALCULATES:
  ├─→ Fetch signals for Siddaramaiah in last 7 days
  │   └─→ Found 3 signals (from above)
  │
  ├─→ Calculate effective scores
  │   ├─→ Signal 1: 0.515 × 0.43 × 1.0 (direct mention) = 0.221
  │   ├─→ Signal 2: 0.535 × 0.50 × 0.7 (party mention) = 0.187
  │   └─→ Signal 3: 0.075 × 0.35 × 0.8 (geo mention) = 0.021
  │
  ├─→ Calculate pulse
  │   └─→ pulseScore = (0.221 + 0.187 + 0.021) / 3 = 0.476
  │
  ├─→ Determine trend
  │   └─→ Today: 0.476, Baseline (7d): 0.420
  │   └─→ Delta: 0.056 < 0.15 → STABLE
  │
  └─→ Get top drivers
      └─→ [Article 1 (0.221), Article 2 (0.187), Article 3 (0.021)]

RESPONSE:
{
  "candidateId": 123,
  "candidateName": "Siddaramaiah",
  "partyName": "Indian National Congress",
  "pulseScore": 0.476,
  "trend": "STABLE",
  "articlesAnalyzed": 3,
  "topDrivers": [
    {
      "headline": "Siddaramaiah announces infrastructure project...",
      "sentiment": "POSITIVE",
      "sentimentScore": 0.515,
      "confidence": 0.43,
      "effectiveScore": 0.221
    },
    ...
  ]
}

FRONTEND DISPLAYS:
  ├─→ Large card: "0.476" (47.6% positive sentiment)
  ├─→ Trend badge: "STABLE" (no major change)
  ├─→ Articles analyzed: "3 in 7 days"
  ├─→ Top driver: Article 1 with positive badge
  └─→ Timeline graph showing pulse trend
```

#### Hourly Alert Check (11:00 AM - 1 hour after ingestion)
```
ALERT SERVICE runs hourly check for all candidates with users

For Siddaramaiah (candidateId=123):
  ├─→ Check Sentiment Spike
  │   ├─→ Today's pulse: 0.476 (from 3 articles)
  │   ├─→ 7-day baseline: 0.420
  │   ├─→ Delta: 0.056 < 0.35 ✗
  │   └─→ NO ALERT
  │
  ├─→ Check Negative Surge
  │   ├─→ Negative articles in 24h: 0
  │   ├─→ Minimum required: 3
  │   └─→ NO ALERT
  │
  └─→ Check High-Confidence Hit
      ├─→ Single negative articles with score ≤ -0.70 and confidence ≥ 0.90: 0
      └─→ NO ALERT

RESULT: No alerts triggered (positive news day)
```

---

## 💾 8. DATA STORAGE & INDEXING

### 8.1 Key Database Tables

| Table | Purpose | Key Fields | Indexes |
|-------|---------|-----------|---------|
| NewsArticle | Store articles | title, sourceUrl, publishedAt, status | status, publishedAt |
| NewsEntityMention | Link articles to entities | articleId, entityType, entityId | articleId, entityType |
| SentimentSignal | Sentiment data per GeoUnit | geoUnitId, sentiment, sentimentScore, confidence | geoUnitId + createdAt |
| DailyGeoStats | Daily aggregated stats | geoUnitId, date, avgSentiment, pulseScore | date, geoUnitId |
| Alert | User alerts | userId, type, message, isRead | userId, createdAt |
| CandidateProfile | Candidate → GeoUnit mapping | candidateId, primaryGeoUnitId, partyId | candidateId |

### 8.2 Query Performance

```sql
-- Fast: Get recent signals for a candidate's constituency
SELECT * FROM SentimentSignal
WHERE geoUnitId = 456
  AND createdAt >= NOW() - INTERVAL '7 days'
ORDER BY createdAt DESC;

-- Fast: Get daily stats across time period
SELECT * FROM DailyGeoStats
WHERE date BETWEEN '2025-01-01' AND '2025-01-08'
  AND geoUnitId IN (456, 789, 1)
ORDER BY date DESC;

-- Fast: Get recent articles for moderation
SELECT * FROM NewsArticle
WHERE status = 'PENDING'
ORDER BY createdAt DESC
LIMIT 50;
```

---

## 🔐 9. Error Handling & Resilience

### 9.1 Sentiment Analysis Failure
```typescript
// If Python service is down:
try {
  response = await httpService.post(ANALYSIS_SERVICE_URL, ...)
} catch (error) {
  // Non-blocking failure - article is saved, sentiment is skipped
  logger.error(`Sentiment analysis failed: ${error.message}`)
  // Continue ingestion process
}

// Result: Article saved but no sentiment signal created
// Admin can manually review or reprocess later
```

### 9.2 News Fetch Failure
```typescript
// If Google News is down:
try {
  feed = await parser.parseURL(feedUrl)
} catch (error) {
  logger.error(`Failed to fetch news for entity ${entityId}`)
}

// Result: Job skips this entity, continues with others
// Next hourly run will retry
```

### 9.3 Deduplication Handling
```typescript
// If article URL already exists:
existing = await prisma.newsArticle.findFirst({
  where: { sourceUrl: link }
})

if (existing) {
  // Check if entity is already linked
  existingLink = await prisma.newsEntityMention.findFirst({
    where: {articleId: existing.id, entityType, entityId}
  })
  
  if (!existingLink) {
    // New entity mention for existing article - link it
    await prisma.newsEntityMention.create(...)
  }
  return; // Exit - don't create duplicate
}
```

---

## 🎯 10. Summary of Key Metrics

### Sentiment Score
- **Range**: -1.0 (extremely negative) to +1.0 (extremely positive)
- **Meaning**: Overall tone of an article
- **Calculation**: Weighted average of BERT model's 5-star prediction probabilities

### Confidence Score
- **Range**: 0.0 to 1.0
- **Meaning**: How certain the BERT model is about its sentiment prediction
- **Usage**: Multiplied into effective score to weight uncertain predictions lower

### Pulse Score
- **Range**: 0.0 to 1.0 (normalized from -1.0 to +1.0)
- **Meaning**: Overall health/momentum of a candidate/region
- **Calculation**: Weighted average of sentiment signals, considering:
  - Sentiment score
  - Confidence level
  - Relevance weight (direct vs indirect mentions)
  - Time decay (recent news weighted more)

### Trend
- **RISING**: Recent pulse > baseline by ≥15%
- **STABLE**: Change < 15%
- **DECLINING**: Recent pulse < baseline by ≥15%

### Alert Types
1. **Sentiment Spike**: Δ ≥ 0.35 with ≥3 signals in 24h
2. **Negative Surge**: ≥3 negative articles with confidence ≥0.80
3. **High-Confidence Hit**: Single article with score ≤-0.70 and confidence ≥0.90

---

## 🚀 11. Technology Stack

- **Frontend**: React with TypeScript
- **Backend API**: NestJS (Node.js)
- **NLP Service**: FastAPI (Python) with Hugging Face BERT
- **Database**: PostgreSQL with Prisma ORM
- **Scheduling**: NestJS Schedule (@Cron)
- **News Source**: Google News RSS API
- **Language Detection**: Python langdetect library
- **ML Model**: Pretrained BERT (multilingual-capable)

---

## 📊 12. Example Data Flow Timeline

```
08:00 AM - News published: "Siddaramaiah announces infrastructure project"
   ↓
08:30 AM - Google News indexes the article
   ↓
10:00 AM - Hourly news ingestion job runs
   ├─→ Fetches Google News RSS for "Siddaramaiah"
   ├─→ Finds article
   ├─→ Creates NewsArticle (id=5001)
   ├─→ Creates NewsEntityMention (articleId=5001, entityType=CANDIDATE, entityId=123)
   └─→ Triggers sentiment analysis
      ↓
10:02 AM - Python service analyzes sentiment
   ├─→ BERT predicts: POSITIVE, score=0.515, confidence=0.43
   ├─→ Geo resolver → primaryGeoUnitId = 456 (Bangalore South)
   └─→ Creates SentimentSignal (geoUnitId=456, sentiment=POSITIVE, score=0.515)
      ↓
10:05 AM - Dashboard user requests pulse for Siddaramaiah
   ├─→ Backend queries SentimentSignal for last 7 days
   ├─→ Finds 3 signals (this article + previous articles)
   ├─→ Calculates pulseScore = 0.476
   └─→ Returns PulseData to frontend
      ↓
10:06 AM - Frontend displays
   ├─→ Pulse score: 0.476
   ├─→ Trend: STABLE
   ├─→ Top driver: Article (0.515 score)
   └─→ Timeline graph updated
      ↓
11:00 AM - Hourly alert check job runs
   ├─→ Compares today (0.476) vs 7-day baseline (0.420)
   ├─→ Delta: 0.056 < 0.35 threshold
   └─→ No alert triggered
      ↓
11:59 PM - Daily stats computation job runs
   ├─→ Aggregates all signals for the day across all regions
   ├─→ Creates/updates DailyGeoStats entries
   └─→ Available for next day's trend analysis
```

---

## ✅ Key Takeaways

1. **News Ingestion** is automated hourly, using entity keywords to fetch relevant articles
2. **Sentiment Analysis** uses BERT deep learning to score articles from -1.0 to +1.0
3. **Confidence** indicates how certain the model is (0.0-1.0)
4. **Geo-Attribution** uses a waterfall strategy to assign articles to geographic regions
5. **Pulse Score** is a weighted composite of sentiment, confidence, and relevance
6. **Alerts** detect anomalies like sentiment spikes, negative surges, and high-impact articles
7. **Daily Stats** aggregate sentiment into time-series data for trend analysis
8. **Resilience** ensures failures don't block the pipeline - all operations are non-blocking

This system enables real-time political intelligence tracking with automatic sentiment monitoring and anomaly detection!
