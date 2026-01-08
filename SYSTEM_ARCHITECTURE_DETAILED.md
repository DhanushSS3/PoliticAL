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

The news ingestion system fetches news articles from Google News RSS and automatically links them to active political entities. It's driven by `EntityMonitoring` (which tracks what entities to monitor) and `NewsKeyword` (which stores keywords for each entity).

#### Political Entities Definition
**Political Entities** are the 3 actor types in the system:
- **CANDIDATE** - Individual politicians (e.g., Siddaramaiah, Krishna)
- **PARTY** - Political organizations (e.g., Congress, BJP, JDS)
- **GEO_UNIT** - Geographic regions at various levels (State, District, Constituency, Ward, Booth)

#### Flow Diagram
```
┌──────────────────────────────────────────────────────────────────┐
│                  NEWS INGESTION FLOW (UPDATED)                    │
└──────────────────────────────────────────────────────────────────┘

STEP 0: ENTITY ACTIVATION (Setup)
├─ User subscribes to: Siddaramaiah (Candidate)
│  └─ CandidateProfile {candidateId: 123, isSubscribed: true}
│
├─ System auto-creates EntityMonitoring records:
│  ├─ {entityType: CANDIDATE, entityId: 123, reason: "SUBSCRIBED"}
│  ├─ {entityType: PARTY, entityId: 789, reason: "PARTY_CONTEXT"}
│  ├─ {entityType: GEO_UNIT, entityId: 456, reason: "GEO_CONTEXT"}
│  └─ {entityType: CANDIDATE, entityId: 124, reason: "OPPONENT"}
│
└─ For each entity, NewsKeyword entries are auto-generated:
   ├─ Candidate 123: ["Siddaramaiah", "Siddu", "Karnataka CM"]
   ├─ Party 789: ["Congress", "INC"]
   └─ GeoUnit 456: ["Bangalore", "Bangalore Constituency"]

STEP 1: HOURLY INGESTION JOB (Every hour)
┌─────────────────────────────────────────────────────┐
│ SELECT * FROM EntityMonitoring WHERE isActive=true  │
│ (Find all candidates, parties, geounits to fetch)   │
└─────────────────────────────────────────────────────┘
           │
      ┌────▼─────────────────────────────────────────────────┐
      │ FOR EACH ACTIVE ENTITY:                              │
      │ • Look up keywords in NewsKeyword table              │
      │ • Build Google News RSS query:                       │
      │   ("Keyword1" OR "Keyword2") AND                     │
      │   (election OR vote OR campaign OR policy...)        │
      │ • Query Google News API                             │
      └────┬─────────────────────────────────────────────────┘
           │
      ┌────▼──────────────────────────────────────────────────┐
      │ DEDUPLICATION & ARTICLE CREATION                      │
      │                                                        │
      │ For each RSS item:                                    │
      │ • Extract: title, summary, source, publishedAt, link │
      │ • Check if sourceUrl already in NewsArticle table     │
      │ • If EXISTS:                                          │
      │   └─ Skip (already processed)                         │
      │ • If NEW:                                             │
      │   ├─ Create NewsArticle {status: APPROVED}            │
      │   └─ Create NewsEntityMention entries                │
      └────┬───────────────────────────────────────────────────┘
           │
      ┌────▼──────────────────────────────────────────────────┐
      │ CREATE ENTITY MENTION LINKS (Multiple per article)    │
      │                                                        │
      │ For article: "Siddaramaiah announces scheme in         │
      │              Bangalore"                                │
      │                                                        │
      │ Create NewsEntityMention records:                      │
      │ ├─ {articleId: 5001, entityType: CANDIDATE,            │
      │ │   entityId: 123, relevanceWeight: 1.0}              │
      │ ├─ {articleId: 5001, entityType: GEO_UNIT,            │
      │ │   entityId: 456, relevanceWeight: 0.85}             │
      │ └─ {articleId: 5001, entityType: PARTY,               │
      │     entityId: 789, relevanceWeight: 0.70}             │
      └────┬───────────────────────────────────────────────────┘
           │
      ┌────▼──────────────────────────────────────────────────┐
      │ TRIGGER SENTIMENT ANALYSIS (Async, Non-blocking)      │
      │                                                        │
      │ For each new article:                                 │
      │ • Pass to Python BERT service (async queue)           │
      │ • Service analyzes text sentiment                      │
      │ • Creates SentimentSignal record(s)                    │
      │ • Errors don't block ingestion                        │
      └────────────────────────────────────────────────────────┘
```

### 1.2 News Fetching Strategy

#### Questions Answered:
**Q: Does it fetch only from NewsKeyword table?**
**A:** No. NewsKeyword is the lookup table. The system fetches for all entities in EntityMonitoring (isActive=true).

**Q: Does it fetch for subscribed candidates only?**
**A:** No. It fetches for:
- ✅ Subscribed candidates (reason="SUBSCRIBED")
- ✅ Their opposition candidates (reason="OPPONENT")
- ✅ Candidate's party (reason="PARTY_CONTEXT")
- ✅ Candidate's constituency/state (reason="GEO_CONTEXT")

**Q: Should we fetch for all geounits?**
**A:** Yes, but with priority tiers (Currently: All entities fetched equally every hour. Priority-based scheduling not yet implemented).

```
PRIORITY LEVELS (To Be Implemented):
════════════════════════════════════

TIER 1 (HIGH PRIORITY - Fetch every 1 hour):
├─ Subscribed candidate (priority: 10)
├─ Candidate's primary constituency (priority: 9)
├─ Opposition candidates in same constituency (priority: 9)
└─ Candidate's party (priority: 8)

TIER 2 (MEDIUM PRIORITY - Fetch every 2 hours):
├─ Parent district (priority: 6)
├─ Adjacent constituencies (priority: 5)
└─ Regional political news (priority: 5)

TIER 3 (LOW PRIORITY - Fetch every 6 hours):
├─ Parent state (priority: 3)
├─ Other states news (priority: 2)
└─ National political news (priority: 1)

Implementation Strategy (Not Yet Implemented):
──────────────────────────────────────────────
NewsKeyword table:
├─ {entityType: CANDIDATE, entityId: 123, priority: 10}  ← Tier 1
├─ {entityType: PARTY, entityId: 789, priority: 8}       ← Tier 1
├─ {entityType: GEO_UNIT, entityId: 456, priority: 9}    ← Tier 1 (constituency)
├─ {entityType: GEO_UNIT, entityId: 789, priority: 6}    ← Tier 2 (district)
└─ {entityType: GEO_UNIT, entityId: 1, priority: 3}      ← Tier 3 (state)

Scheduler (To Implement):
├─ NewsIngestionScheduler_Tier1 @Cron('0 * * * * *')
│  └─ Run EVERY HOUR: Fetch all keywords with priority >= 9
│
├─ NewsIngestionScheduler_Tier2 @Cron('0 */2 * * * *')
│  └─ Run EVERY 2 HOURS: Fetch keywords with priority 5-8
│
└─ NewsIngestionScheduler_Tier3 @Cron('0 */6 * * * *')
   └─ Run EVERY 6 HOURS: Fetch keywords with priority < 5

CURRENT STATUS: All entities fetched with same priority (every hour)
RECOMMENDATION: Implement tiered scheduling for efficiency
```

#### B. **EntityMonitoring-Driven Approach**
- **What drives fetching**: `EntityMonitoring` table (not CandidateProfile alone)
- **Why**: Allows tracking competitors, party context, and geographic context separately
- **Example**:
  ```
  User subscribes to: Siddaramaiah
  ├─ Creates EntityMonitoring {entityType: CANDIDATE, entityId: 123, reason: SUBSCRIBED}
  ├─ Creates EntityMonitoring {entityType: PARTY, entityId: 789, reason: PARTY_CONTEXT}
  ├─ Creates EntityMonitoring {entityType: GEO_UNIT, entityId: 456, reason: GEO_CONTEXT}
  ├─ Creates EntityMonitoring {entityType: CANDIDATE, entityId: 124, reason: OPPONENT}
  └─ Creates EntityMonitoring {entityType: CANDIDATE, entityId: 125, reason: OPPONENT}
  
  News Fetching:
  └─ Queries ALL these entities, not just Siddaramaiah
  ```

#### C. **KeywordManagerService**
- **Responsibility**: Build search queries for news fetching
- **How it works**:
  ```
  Entity: "Siddaramaiah" (Candidate)
          ↓
  Step 1: Look up NewsKeyword records
          ├─ keyword: "Siddaramaiah"
          ├─ keyword: "Siddu"
          └─ keyword: "Karnataka CM"
          ↓
  Step 2: Add context terms
          └─ (election OR vote OR campaign OR policy OR scandal)
          ↓
  Step 3: Build query
          Final: ("Siddaramaiah" OR "Siddu" OR "Karnataka CM") 
                 AND (election OR vote OR campaign OR policy OR scandal)
          ↓
  Step 4: Query Google News RSS
          └─ Get latest articles (deduped by sourceUrl)
  ```

#### D. **NewsIngestionService** (The Scheduler)
- **Trigger**: `@Cron(CronExpression.EVERY_HOUR)`
- **What it does each hour**:
  ```
  1. Query EntityMonitoring WHERE isActive=true
     └─ Get all candidates, parties, geounits to monitor
  
  2. FOR EACH active entity:
     ├─ Get keywords from NewsKeyword table
     ├─ Build Google News RSS query
     ├─ Query Google News API
     ├─ Parse RSS items
     │
     └─ FOR EACH RSS item:
        ├─ Extract: title, summary, source, publishedAt, link
        ├─ Check dedup: Does sourceUrl exist in NewsArticle?
        │
        ├─ IF NEW article:
        │  ├─ Create NewsArticle {status: APPROVED, ingestType: API}
        │  ├─ Create NewsEntityMention entries for EACH entity type
        │  │  (CANDIDATE, PARTY, GEO_UNIT - all that were mentioned)
        │  └─ ASYNC TRIGGER: sentimentService.analyzeAndStoreSentiment()
        │
        └─ IF DUPLICATE:
           └─ Skip (already in system)
  
  3. Log metrics:
     {entities_processed: 142, articles_fetched: 47, new_articles: 12, duration: "3.2s"}
  ```

#### E. **Execution Order: Ingestion → Sentiment**
```
Timeline:
─────────
10:00 AM ─┬─→ NewsIngestionService.fetchAllNews() [SYNCHRONOUS, BLOCKING]
          │    └─ Runs to completion (~5 seconds)
          │       Result: Articles saved in DB
          │
          ├─→ Meanwhile: Triggers sentiment jobs (ASYNC)
          │    └─ sentimentService.analyzeAndStoreSentiment(articleId)
          │       Result: Queued for background processing (~30-60 seconds)
          │
          └─ User sees articles immediately (before sentiment completes)
             (sentimentScore is NULL until sentiment job finishes)

This design ensures:
├─ News ingestion is fast (doesn't wait for ML processing)
├─ Sentiment analysis doesn't block news fetching
└─ Users see latest articles immediately
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

The system uses a **BERT-based sentiment model** that analyzes text and outputs 5 probability scores (for 1-star through 5-star sentiment). These are converted into a normalized score and confidence metric.

#### The BERT Model Pipeline
```
┌──────────────────────────────────────────────────────────────────┐
│                   SENTIMENT ANALYSIS PIPELINE                     │
└──────────────────────────────────────────────────────────────────┘

INPUT: News Article Text
  Example: "Siddaramaiah announces new development policy for Bangalore"
  
  │
  ├─► STEP 1: Language Detection
  │   └─→ Detects: "en" (English)
  │
  ├─► STEP 2: BERT Model Inference
  │   ├─→ Model: Hugging Face transformer (pre-trained on sentiment)
  │   │   (NOT hand-crafted rules - learned from millions of examples)
  │   ├─→ Input: Full article text → tokenized
  │   │   "Siddaramaiah" → ["S", "iddara", "mai", "ah"] (subword tokens)
  │   ├─→ Processing: 12-layer transformer with self-attention
  │   │   (learns context: what words mean together)
  │   └─→ Output: 5 probability values
  │
  │   Output: [prob_1star, prob_2star, prob_3star, prob_4star, prob_5star]
  │   Example: [0.02,      0.05,      0.10,      0.45,      0.38]
  │            (2%)        (5%)       (10%)       (45%)      (38%)
  │
  │            Interpretation:
  │            ├─ 2% chance this is 1-star (very negative)
  │            ├─ 5% chance this is 2-star (negative)
  │            ├─ 10% chance this is 3-star (neutral)
  │            ├─ 45% chance this is 4-star (positive) ← Most likely
  │            └─ 38% chance this is 5-star (very positive)
  │
  ├─► STEP 3: Calculate Normalized Score (-1.0 to +1.0)
  │   │
  │   ├─→ Why normalize? 
  │   │   • Makes scores comparable across articles
  │   │   • Easier to average multiple articles
  │   │   • Captures both positive AND negative sentiment
  │   │
  │   ├─→ Formula: sentimentScore = Σ(probability[i] × weight[i])
  │   │
  │   ├─→ Weights (represent intensity of sentiment):
  │   │   • 1 star  → weight = -1.0  (extreme negative)
  │   │   • 2 stars → weight = -0.5  (negative)
  │   │   • 3 stars → weight = 0.0   (neutral/balanced)
  │   │   • 4 stars → weight = +0.5  (positive)
  │   │   • 5 stars → weight = +1.0  (extreme positive)
  │   │
  │   └─→ Calculation Example:
  │       score = (0.02 × -1.0) + (0.05 × -0.5) + (0.10 × 0.0) 
  │              + (0.45 × 0.5) + (0.38 × 1.0)
  │            = -0.02 + (-0.025) + 0 + 0.225 + 0.38
  │            = 0.558 (55.8% positive)
  │
  ├─► STEP 4: Determine Primary Sentiment Label
  │   │
  │   ├─→ Step 4a: Find the maximum probability
  │   │   [0.02, 0.05, 0.10, 0.45, 0.38]
  │   │    ↑     ↑     ↑     ↑     ↑
  │   │   1★    2★    3★    4★    5★
  │   │                      ↑
  │   │                    MAX = 0.45 at index [3]
  │   │
  │   ├─→ Step 4b: Map index to sentiment class
  │   │   • Index [0] or [1] → "NEGATIVE" (1-2 stars)
  │   │   • Index [2] → "NEUTRAL" (3 stars)
  │   │   • Index [3] or [4] → "POSITIVE" (4-5 stars)
  │   │
  │   └─→ Result: Label = "POSITIVE" (because max is at index 3 = 4-star)
  │
  ├─► STEP 5: Calculate Confidence Score
  │   │
  │   ├─→ What is confidence?
  │   │   = The highest probability value (model's certainty)
  │   │   = How sure the model is about its prediction
  │   │
  │   └─→ Calculation: confidence = max([0.02, 0.05, 0.10, 0.45, 0.38])
  │                              = 0.45 (45%)
  │
  │       Interpretation:
  │       ├─ 0.45 = Model is 45% confident it's 4-star positive
  │       ├─ High confidence (0.85+) = Very reliable prediction
  │       ├─ Medium confidence (0.50-0.84) = Somewhat reliable
  │       └─ Low confidence (<0.50) = Model is confused/uncertain
  │
  └─► OUTPUT: SentimentResponse
      {
        label: "POSITIVE",           ← Primary sentiment (POSITIVE/NEUTRAL/NEGATIVE)
        score: 0.558,                ← Normalized score (-1.0 to +1.0)
        confidence: 0.45,            ← Model certainty (0.0 to 1.0)
        model_version: "kn-en-v1",   ← For audit trail
        language: "en"               ← Detected language
      }
```

### 2.2 Understanding Confidence - Examples

```
EXAMPLE 1: HIGH CONFIDENCE (Very Reliable)
═════════════════════════════════════════════
Article: "Candidate wins major election by landslide!"
BERT Output: [0.01, 0.02, 0.02, 0.05, 0.90]
                                         ↑
Confidence: 0.90 (90%)
Label: POSITIVE (5-star has max probability)

Interpretation:
├─ "Model is 90% sure this is 5-star positive"
├─ "Very strong signal - highly reliable"
└─ Use FULL weight in pulse calculations

EXAMPLE 2: MEDIUM CONFIDENCE (Moderately Reliable)
═════════════════════════════════════════════════════
Article: "Candidate announces new policy"
BERT Output: [0.02, 0.05, 0.10, 0.45, 0.38]
                                ↑
Confidence: 0.45 (45%)
Label: POSITIVE (4-star has max probability)

Interpretation:
├─ "Model thinks it's 4-star (45% likely)"
├─ "But there's significant uncertainty (38% chance it's 5-star)"
├─ "Somewhat reliable but not certain"
└─ Use REDUCED weight (multiply by 0.45) in calculations

EXAMPLE 3: LOW CONFIDENCE (Unreliable - Confused)
═══════════════════════════════════════════════════
Article: "Political analysis report"
BERT Output: [0.20, 0.20, 0.25, 0.20, 0.15]
             ↑     ↑     ↑     ↑     ↑
Confidence: 0.25 (25%)
Label: NEUTRAL (3-star has max probability)

Interpretation:
├─ "Model is confused - almost equal probabilities"
├─ "Almost same chance of any sentiment"
├─ "Very unreliable prediction"
├─ Use MINIMAL weight or exclude entirely
└─ Flag for manual review

WHY CONFIDENCE MATTERS:
═══════════════════════
Don't multiply by confidence? 
  Problem: Can't distinguish between:
    ├─ Confident +0.8: Should count as 0.8
    └─ Unconfident +0.8: Should count as less (maybe 0.25)
    
By multiplying:
  Confident +0.8:   0.8 × 0.90 = 0.72 ✓ (use most of it)
  Unconfident +0.8: 0.8 × 0.25 = 0.20 ✓ (reduce drastically)
```

### 2.3 Why We Normalize Scores to -1.0 to +1.0

```
PROBLEM WITH RAW PROBABILITIES [0.0, 1.0]:
═════════════════════════════════════════════

Example: Articles about Siddaramaiah

Article 1: [0.02, 0.05, 0.10, 0.45, 0.38] → "Positive"
Article 2: [0.20, 0.20, 0.25, 0.20, 0.15] → "Neutral"
Article 3: [0.85, 0.10, 0.02, 0.02, 0.01] → "Negative"

If we just take max probability:
├─ Article 1: 0.45
├─ Article 2: 0.25
└─ Article 3: 0.85

Average: (0.45 + 0.25 + 0.85) / 3 = 0.517 (seems positive)

BUT: Article 3 is VERY NEGATIVE, not positive!
     Raw average doesn't capture this correctly.

SOLUTION: -1.0 TO +1.0 NORMALIZATION:
════════════════════════════════════════

Article 1: 0.558  (from formula: calculated earlier)
Article 2: 0.0    (neutral)
Article 3: -0.9   (very negative)

Average: (0.558 + 0.0 + (-0.9)) / 3 = -0.114 (correctly shows negative bias!)

BENEFITS:
─────────
1. Captures negative sentiment explicitly
   ├─ Positive scores: +0.5 to +1.0
   ├─ Neutral: -0.2 to +0.2
   └─ Negative: -1.0 to -0.5

2. Easy to average across articles
   ├─ (0.8 + (-0.6) + 0.2) / 3 = 0.13 (correctly weighted)

3. Easy to visualize
   ├─ Dashboard: -1 (left/red) ——→ 0 (center/gray) ——→ +1 (right/green)

4. Intuitive interpretation
   ├─ +0.6 = Good (candidate in positive spotlight)
   ├─ -0.7 = Bad (candidate in negative spotlight)
   └─ 0.0 = Neutral (balanced coverage)

5. Mathematical consistency
   ├─ Can easily normalize to 0.0-1.0 for dashboards:
   │  displayScore = (sentimentScore + 1.0) / 2.0
   │  = (+0.6 + 1.0) / 2.0 = 0.8 (80% positive)
   └─ Can easily compare entities
```

### 2.4 Why Multiply Confidence in Effective Score?

```
CORE CONCEPT:
═════════════
effectiveScore = sentimentScore × confidence × relevanceWeight

This means: How much should we trust this signal?
  ├─ If confidence = 0.0 → Don't trust at all (ignore it)
  ├─ If confidence = 0.5 → Trust it half (reduce impact)
  └─ If confidence = 1.0 → Trust it fully (use full value)

EXAMPLE 1: HIGH CONFIDENCE - CORRUPTION CHARGES
════════════════════════════════════════════════
Article: "Corruption charges filed against candidate"
├─ sentimentScore: -0.85 (very negative)
├─ confidence: 0.92 (model is 92% sure)
├─ relevanceWeight: 1.0 (direct candidate mention)
│
├─ WITHOUT multiplying confidence:
│  └─ effectiveScore = -0.85 (full negative impact)
│     Problem: Doesn't account for model uncertainty
│
└─ WITH multiplying confidence:
   └─ effectiveScore = -0.85 × 0.92 × 1.0 = -0.782
      (slightly less than -0.85 because 92% < 100%)
      Result: Use most of the negative signal (reliable)

EXAMPLE 2: MEDIUM CONFIDENCE - ROUTINE NEWS
═════════════════════════════════════════════
Article: "Candidate announces new policy"
├─ sentimentScore: +0.60 (moderately positive)
├─ confidence: 0.45 (model is only 45% sure)
├─ relevanceWeight: 1.0 (direct mention)
│
└─ WITH multiplying confidence:
   └─ effectiveScore = +0.60 × 0.45 × 1.0 = +0.27
      (drastically reduced because model is unsure)
      Result: Weight this signal lightly (unreliable)

EXAMPLE 3: LOW CONFIDENCE - CONFUSING TEXT
════════════════════════════════════════════
Article: "Political analysis report with mixed signals"
├─ sentimentScore: +0.10 (slightly positive)
├─ confidence: 0.28 (model is very confused)
├─ relevanceWeight: 0.7 (party mention, not direct)
│
└─ WITH multiplying confidence:
   └─ effectiveScore = +0.10 × 0.28 × 0.7 = +0.0196
      (almost completely ignored)
      Result: This signal has minimal impact

WHY NOT ADD INSTEAD OF MULTIPLY?
═════════════════════════════════
If we added (sentimentScore + confidence):
  Example: 0.75 + 0.45 = 1.20
  Problem 1: Exceeds our -1.0 to +1.0 scale!
  Problem 2: High confidence increases the score artificially
    └─ If model is 90% sure of +0.5, we get +0.5 + 0.9 = +1.4 (wrong!)
  Problem 3: Not mathematically correct for combining probabilities

By multiplying (correct approach):
  Example: 0.75 × 0.45 = 0.3375
  Benefit 1: Stays within -1.0 to +1.0 scale
  Benefit 2: Confidence acts as a "reliability multiplier"
    └─ 0.75 × 0.45 = 0.34 (treat as less reliable)
    └─ 0.75 × 0.90 = 0.68 (treat as more reliable)
  Benefit 3: Mathematically correct (how probability works)

FORMULA INTUITION:
════════════════════
effectiveScore = sentimentScore × confidence × relevanceWeight

Think of it as:
├─ sentimentScore = "What is the sentiment?"
├─ confidence = "How sure are we?" (0% → 100%)
└─ relevanceWeight = "How relevant is this to the entity?"

Result: Only count sentiment values that are BOTH high AND confident AND relevant
```

### 2.5 Relevance Weights - Different for Each Entity Type

```
RELEVANCE WEIGHT STRATEGY:
═══════════════════════════

When an article mentions MULTIPLE entities, each mention has 
a different weight based on the type of mention:

Direct Mention (Most Relevant):
├─ CANDIDATE (subscribed): weight = 1.0
│  └─ Example: "Siddaramaiah announces new policy"
├─ CANDIDATE (opponent): weight = 0.95
│  └─ Example: "Opposition candidate visits constituency"
└─ CANDIDATE (party leader): weight = 0.85
   └─ Example: "Congress President speaks about election"

Contextual Mention (Medium Relevant):
├─ GEO_UNIT (primary constituency): weight = 0.85
│  └─ Example: "Bangalore South constituency election announced"
├─ GEO_UNIT (containing district): weight = 0.70
│  └─ Example: "Bangalore District results are in"
├─ GEO_UNIT (parent state): weight = 0.50
│  └─ Example: "Karnataka election commission decision"
└─ GEO_UNIT (other state): weight = 0.15
   └─ Example: "Tamil Nadu election news" (irrelevant to Karnataka candidate)

Party Mention (Least Relevant):
├─ Own party: weight = 0.70
│  └─ Example: "Congress launches welfare scheme"
└─ Other party: weight = 0.40
   └─ Example: "BJP criticizes Congress policies"

EXAMPLE ARTICLE WITH MULTIPLE ENTITIES:
═════════════════════════════════════════
Title: "Congress launches welfare scheme in Bangalore"

Entity Mentions:
├─ CANDIDATE: Siddaramaiah (direct mention in article)
├─ GEO_UNIT: Bangalore (primary constituency)
└─ PARTY: Congress (Siddaramaiah's party)

Sentiment: POSITIVE, score = 0.75, confidence = 0.85

Effective Scores FOR THIS SINGLE ARTICLE:
├─ For Siddaramaiah pulse:
│  └─ 0.75 × 0.85 × 1.0 = 0.6375 (CANDIDATE weight)
│
├─ For Bangalore pulse:
│  └─ 0.75 × 0.85 × 0.85 = 0.541875 (GEO_UNIT weight)
│
└─ For Congress pulse:
   └─ 0.75 × 0.85 × 0.70 = 0.44625 (PARTY weight)

CURRENT SYSTEM STATUS:
═══════════════════════
You're currently storing:
├─ NewsEntityMention {articleId, entityType, entityId, relevanceWeight}
└─ SentimentSignal {geoUnitId, sentimentScore, confidence}

RECOMMENDATION:
───────────────
Keep storing all entity mentions with weights.
When calculating pulse, query ALL mentions for the article,
not just the geounit mention, so you can apply correct weights.
```

### 2.6 How SentimentSignal is Used - Core Intelligence Layer

```
SentimentSignal Table Schema:
╔════════════════════════════════════════════════════════════╗
║ id: Int @id                                                ║
║ geoUnitId: Int         ← Which geographic region           ║
║ sourceType: DataSourceType (NEWS | ANALYST)               ║
║ sourceRefId: Int       ← NewsArticle.id                    ║
║ sentiment: SentimentLabel (POSITIVE|NEUTRAL|NEGATIVE)     ║
║ sentimentScore: Float  ← -1.0 to +1.0 (normalized)        ║
║ confidence: Float      ← 0.0 to 1.0 (model certainty)     ║
║ modelVersion: String   ← "kn-en-v1" for audit             ║
║ createdAt: DateTime                                        ║
╚════════════════════════════════════════════════════════════╝

USAGE 1: ALERT DETECTION
═════════════════════════
AlertService runs every hour:

Check for Sentiment Spike:
SELECT COUNT(*) FROM SentimentSignal
WHERE geoUnitId IN (subscribed_geos)
  AND createdAt > now() - interval '24 hours'
  AND sentiment = 'NEGATIVE'
  AND confidence >= 0.80

IF count >= 3:
  CREATE Alert {message: "⚠️ Negative coverage surge detected!"}

Check for High-Impact Hit:
SELECT * FROM SentimentSignal
WHERE geoUnitId IN (subscribed_geos)
  AND createdAt > now() - interval '24 hours'
  AND sentiment = 'NEGATIVE'
  AND sentimentScore <= -0.70
  AND confidence >= 0.90
ORDER BY sentimentScore DESC LIMIT 1

IF found:
  CREATE Alert {message: "🔴 Breaking: High-confidence negative article"}

USAGE 2: DAILY STATS AGGREGATION
════════════════════════════════════
Every night at 11:59 PM:

FOR each GeoUnit:
  SELECT * FROM SentimentSignal
  WHERE geoUnitId = X
    AND DATE(createdAt) = TODAY
  
  Calculate:
  ├─ avgSentiment = AVG(sentimentScore)
  ├─ pulseScore = WEIGHTED_AVG(sentimentScore × confidence)
  └─ dominantIssue = MODE(topic_from_articles)
  
  CREATE/UPDATE DailyGeoStats {
    geoUnitId: X,
    date: TODAY,
    avgSentiment: 0.42,
    pulseScore: 0.58,
    dominantIssue: "Development Projects"
  }

USAGE 3: PULSE CALCULATION (7-day trend)
═════════════════════════════════════════
User requests: GET /analytics/pulse/candidate/123?days=7

SELECT * FROM SentimentSignal
WHERE geoUnitId IN (candidate_constituencies)
  AND createdAt BETWEEN [now-7days, now]

FOR each signal:
  effectiveScore = signal.sentimentScore 
                 × signal.confidence 
                 × getRelevanceWeight(signal.sourceRefId, candidateId)

pulseScore = AVG(effectiveScores)
trend = COMPARE(recentAvg vs baselineAvg)

Return {pulseScore: 0.621, trend: "RISING", topDrivers: [...]}

USAGE 4: DASHBOARD TIME-SERIES
═════════════════════════════════
User views: Sentiment trend for Bangalore (30 days)

SELECT * FROM SentimentSignal
WHERE geoUnitId = bangalore_id
  AND createdAt > now() - interval '30 days'
ORDER BY createdAt

Response: Array of {date, sentiment, score, confidence}

Frontend plots line chart showing daily trend
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

### 4.1 What is Pulse Score?

**Pulse Score** = Weighted average sentiment over a time period (usually 7 days) representing the overall "health" or "momentum" of a candidate/region.

```
Range: 0.0 to 1.0 (normalized from -1.0 to +1.0)

Score Interpretation:
├─ 0.0 to 0.25  → Negative phase (bad coverage, under scrutiny)
├─ 0.25 to 0.5  → Cautious/Mixed (balanced coverage with concerns)
├─ 0.5          → Neutral (no clear trend, balanced)
├─ 0.5 to 0.75  → Positive phase (good coverage, momentum)
└─ 0.75 to 1.0  → Strong positive (excellent coverage, leading)

Example Interpretations:
├─ Pulse = 0.20 → "Bad press, candidate in trouble"
├─ Pulse = 0.50 → "Balanced coverage, stable position"
└─ Pulse = 0.85 → "Excellent momentum, leading the narrative"
```

### 4.2 Pulse Score Calculation - Complete Example

```
SCENARIO: Calculate 7-day pulse for Siddaramaiah (Candidate ID: 123)
═════════════════════════════════════════════════════════════════════

STEP 1: Gather Sentiment Data
────────────────────────────────
SELECT * FROM SentimentSignal
WHERE geoUnitId IN (
        SELECT primaryGeoUnitId FROM CandidateProfile WHERE candidateId=123
        UNION
        SELECT id FROM GeoUnit WHERE parent=(candidate's state) 
      )
  AND createdAt BETWEEN [now-7days, now]

Found 8 articles:

Date    │ Article Title                              │ Sentiment │ Score │ Conf
────────┼────────────────────────────────────────────┼───────────┼───────┼─────
Jan 8   │ "Siddaramaiah launches dev projects"       │ POSITIVE  │ 0.75  │ 0.85
Jan 8   │ "Congress announces welfare scheme"        │ POSITIVE  │ 0.68  │ 0.82
Jan 7   │ "Report: Policy controversy in state"      │ NEGATIVE  │ -0.60 │ 0.90
Jan 7   │ "Election analysis: Karnataka trends"      │ NEUTRAL   │ 0.10  │ 0.55
Jan 6   │ "CM visits constituency for campaign"      │ POSITIVE  │ 0.72  │ 0.88
Jan 5   │ "Infrastructure projects progressing"      │ POSITIVE  │ 0.80  │ 0.91
Jan 5   │ "Opposition files petition against policy" │ NEGATIVE  │ -0.40 │ 0.75
Jan 4   │ "State election news roundup"              │ NEUTRAL   │ 0.05  │ 0.52

STEP 2: Calculate Effective Scores
────────────────────────────────────
effectiveScore = sentimentScore × confidence × relevanceWeight

Article 1 (Direct candidate mention):
  Relevance Weight = 1.0 (direct mention)
  effectiveScore = 0.75 × 0.85 × 1.0 = 0.6375

Article 2 (Party mention):
  Relevance Weight = 0.70 (candidate's party, not direct)
  effectiveScore = 0.68 × 0.82 × 0.70 = 0.3903

Article 3 (State-level, affects all):
  Relevance Weight = 0.50 (state-level news)
  effectiveScore = -0.60 × 0.90 × 0.50 = -0.27

Article 4 (General state analysis):
  Relevance Weight = 0.50 (state-level)
  effectiveScore = 0.10 × 0.55 × 0.50 = 0.0275

Article 5 (Direct candidate mention):
  Relevance Weight = 1.0
  effectiveScore = 0.72 × 0.88 × 1.0 = 0.6336

Article 6 (Candidate's work, high confidence):
  Relevance Weight = 1.0
  effectiveScore = 0.80 × 0.91 × 1.0 = 0.728

Article 7 (Opposition to policies, but relevant):
  Relevance Weight = 0.85 (geo mention, candidate affected)
  effectiveScore = -0.40 × 0.75 × 0.85 = -0.255

Article 8 (General state news):
  Relevance Weight = 0.50
  effectiveScore = 0.05 × 0.52 × 0.50 = 0.013

STEP 3: Calculate Raw Pulse Score (Average)
──────────────────────────────────────────────
pulseRaw = (0.6375 + 0.3903 + (-0.27) + 0.0275 + 0.6336 + 0.728 
            + (-0.255) + 0.013) / 8
         = 2.1448 / 8
         = 0.2681

STEP 4: Normalize to 0.0-1.0 Range
───────────────────────────────────
Why normalize? Raw score is -1.0 to +1.0
              Normalized is 0.0 to 1.0 (easier for dashboards)

Formula: pulseNormalized = (pulseRaw + 1.0) / 2.0

pulseScore = (0.2681 + 1.0) / 2.0
           = 1.2681 / 2.0
           = 0.6341 (63.41%)

STEP 5: Determine Trend (RISING/STABLE/DECLINING)
───────────────────────────────────────────────────
Recent pulse (last 2 days):   0.68 (Articles 1,2 from Jan 8)
Baseline pulse (7 days):      0.63 (Overall average)

Delta = |0.68 - 0.63| = 0.05

SPIKE_THRESHOLD = 0.15 (15% change minimum)
0.05 < 0.15 → Trend = "STABLE"

(If delta > 0.15 and recent > baseline → "RISING")
(If delta > 0.15 and recent < baseline → "DECLINING")

STEP 6: Identify Top Drivers
──────────────────────────────
Sort articles by absolute effectiveScore and take top 5:

1. Article 6: effectiveScore = +0.728 (Infrastructure projects, high confidence)
2. Article 1: effectiveScore = +0.6375 (Dev projects launch)
3. Article 5: effectiveScore = +0.6336 (CM visit for campaign)
4. Article 2: effectiveScore = +0.3903 (Welfare scheme)
5. Article 3: effectiveScore = -0.27 (Policy controversy)

FINAL PULSE RESPONSE:
═════════════════════
{
  candidateId: 123,
  candidateName: "Siddaramaiah",
  partyName: "Indian National Congress",
  
  pulseScore: 0.6341,        ← 63.41% positive
  trend: "STABLE",            ← Not significantly changing
  
  articlesAnalyzed: 8,        ← Data points used
  timeWindow: "7 days",       ← Analysis period
  lastUpdated: "2025-01-08T14:32:00Z",
  
  topDrivers: [              ← Most impactful articles
    {
      articleId: 5001,
      headline: "Infrastructure projects progressing well",
      sentiment: "POSITIVE",
      sentimentScore: 0.80,
      confidence: 0.91,
      relevanceWeight: 1.0,
      effectiveScore: 0.728,
      publishedAt: "2025-01-05T10:00:00Z",
      impact: "HIGH"
    },
    {
      articleId: 5000,
      headline: "Siddaramaiah launches development projects",
      sentiment: "POSITIVE",
      sentimentScore: 0.75,
      confidence: 0.85,
      relevanceWeight: 1.0,
      effectiveScore: 0.6375,
      publishedAt: "2025-01-08T08:00:00Z",
      impact: "HIGH"
    },
    // ... more drivers
  ]
}
```

### 4.3 What Makes a Score "High" vs "Low"?

```
BASELINE COMPARISONS:
═════════════════════

ABSOLUTE SCALE (0.0 to 1.0):
├─ 0.0-0.25  = Very poor (critical coverage)
├─ 0.25-0.5  = Poor (negative overall)
├─ 0.5       = Neutral (balanced)
├─ 0.5-0.75  = Good (positive overall)
└─ 0.75-1.0  = Excellent (very positive)

RELATIVE SCALE (Against Peers):
├─ Your pulse vs other candidates in same constituency
├─ Your pulse vs party average
└─ Your pulse vs previous period

CONTEXTUAL SCALE (Time-based):
├─ Pulse during campaign: 0.55-0.75 is normal
├─ Pulse before elections: 0.60-0.80 shows momentum
├─ Pulse after scandal: 0.20-0.40 is expected
└─ Pulse during routine: 0.45-0.55 is stable

EXAMPLE BENCHMARK:
──────────────────
Siddaramaiah pulse = 0.634

Is this HIGH or LOW?
├─ Compared to average (0.5):   HIGH (+0.134)
├─ Compared to top candidates:  MODERATE (top is 0.78)
├─ For election season:         GOOD (expecting 0.60+)
└─ Interpretation: "Candidate is in positive territory with 
                    good momentum but not dominating the narrative"
```

### 4.4 DailyGeoStats Table

```sql
CREATE TABLE DailyGeoStats {
  id: Int @id
  geoUnitId: Int              -- Which geographic region
  date: DateTime @db.Date     -- ISO date (YYYY-MM-DD)
  
  avgSentiment: Float         -- Average sentiment score for the day
  pulseScore: Float           -- 7-day rolling pulse (0.0-1.0)
  dominantIssue: String       -- Most discussed topic ("Infrastructure", "Welfare", etc.)
  
  // Relations
  geoUnit: GeoUnit @relation(fields: [geoUnitId], references: [id])
  
  @@unique([geoUnitId, date]) -- One record per region per day
  @@index([date])             -- Time-range queries across regions
  @@index([geoUnitId])        -- All stats for a region
}
```

### 4.5 Dominant Issue Extraction

```
WHAT IS DOMINANT ISSUE?
════════════════════════
The most frequently discussed topic/theme for a geography on a given day.

Example:
Date: 2025-01-08, GeoUnit: Bangalore

Articles today:
├─ "CM launches infrastructure projects" 
├─ "Development work speeds up in city"
├─ "New roads announced for Bangalore"
├─ "Congress welfare scheme launched"
├─ "Election voting date announced"

Dominant Issue: "Infrastructure" (appeared 3 times)

HOW TO EXTRACT:
════════════════

APPROACH 1: SIMPLE KEYWORD FREQUENCY (v0 - Current/Recommended)
───────────────────────────────────────────────────────────────

Algorithm:
  1. Get all articles for geounit + date
  2. Extract title + summary text
  3. Split into words, remove stop words ("the", "and", "is", etc.)
  4. Count word frequency
  5. Map words to issue categories
  6. Return most frequent issue

Pseudo-code:
```
async computeDominantIssue(geoUnitId, date) {
  // Get articles
  articles = await getArticles(geoUnitId, date)
  
  // Extract + clean text
  allText = articles
    .map(a => a.title + " " + a.summary)
    .join(" ")
    .toLowerCase()
    .split(/\s+/)
  
  // Remove stop words (the, is, and, etc.)
  filtered = allText.filter(w => !STOP_WORDS.has(w))
  
  // Count frequency
  frequency = {}
  for (word of filtered):
    frequency[word] = (frequency[word] || 0) + 1
  
  // Map to issue categories
  issueScores = {}
  for (word, count of frequency):
    if (word in INFRASTRUCTURE_KEYWORDS):
      issueScores["Infrastructure"] += count
    else if (word in WELFARE_KEYWORDS):
      issueScores["Welfare"] += count
    else if (word in ELECTION_KEYWORDS):
      issueScores["Elections"] += count
    // ... more categories
  
  // Return highest scoring issue
  return issueScores.maxKey()  // e.g., "Infrastructure"
}
```

Issue Category Keywords:
```
INFRASTRUCTURE_KEYWORDS:
  roads, highways, bridge, metro, transport, development,
  construction, project, infrastructure, industrial

WELFARE_KEYWORDS:
  welfare, scheme, benefit, assistance, social, healthcare,
  insurance, pension, grant, subsidy

ELECTION_KEYWORDS:
  election, voting, vote, candidate, campaign, polls,
  ballot, constituency, commission, voter

POLITICAL_KEYWORDS:
  congress, bjp, party, political, government, minister,
  policy, law, legislation, amendment

CONTROVERSY_KEYWORDS:
  scandal, corruption, charges, investigation, alleged,
  arrest, controversy, dispute, conflict, issue
```

APPROACH 2: ML-BASED TOPIC EXTRACTION (v1 - Future)
─────────────────────────────────────────────────────
Use NLP library (Gensim, spaCy, Hugging Face):
├─ Automatically extract topics without manual keywords
├─ More accurate for emerging issues
├─ Can handle nuanced language
└─ Requires ML model training

APPROACH 3: SENTIMENT-WEIGHTED TOPICS (v2 - Advanced)
──────────────────────────────────────────────────────
Find topic + weight by sentiment impact:

Example:
Topics:
├─ Infrastructure: 4 articles, avg sentiment +0.65 → Impact = 2.6 ✓ High
├─ Welfare: 2 articles, avg sentiment +0.58 → Impact = 1.16
├─ Voting: 2 articles, avg sentiment -0.2 → Impact = -0.4 (negative)

dominantIssue = "Infrastructure" (highest positive impact)

This shows not just what's most discussed, but what's most impactful.

CURRENT RECOMMENDATION:
═══════════════════════
Implement APPROACH 1 (Keyword Frequency) for v0:
├─ Simple to implement
├─ Sufficient accuracy
├─ Fast computation
└─ Can upgrade to ML later
```

### 4.6 Why Use Weighted Scores Instead of Stars?

```
COMPARISON: STARS vs WEIGHTED SCORES
═════════════════════════════════════

SCENARIO: 3 articles about candidate
─────────────────────────────────────

Article 1: "Amazing development projects launched" → 5 stars (positive)
Article 2: "Corruption charges against candidate" → 1 star (negative)
Article 3: "Mixed analysis of policies" → 3 stars (neutral)

APPROACH A: Using Raw Star Ratings (1-5)
─────────────────────────────────────────
Average = (5 + 1 + 3) / 3 = 3 stars (NEUTRAL)

Problem: This is MISLEADING!
├─ Reality: One very positive + one very negative + one neutral
├─ Shows as: "Neutral" (balanced)
├─ But actually: There's significant conflict
└─ Can't distinguish between:
   ├─ All 3s (genuinely neutral)
   ├─ Mix of 1,3,5 (conflicted)
   └─ Mix of 2,3,4 (mostly neutral)

Aggregation issue:
├─ If all articles are 3-star → average = 3
├─ If mix of 1,3,5 → average = 3
├─ Result: Same score for very different situations!

APPROACH B: Using Weighted Scores (-1.0 to +1.0)
──────────────────────────────────────────────────
Convert stars to weights:
├─ 5 stars → +1.0 (most positive)
├─ 4 stars → +0.5
├─ 3 stars → 0.0 (neutral)
├─ 2 stars → -0.5
├─ 1 star → -1.0 (most negative)

Example calculation:
└─ Assume confidence adjustments too:
   Article 1: +1.0 × 0.88 = +0.88 (very positive, high confidence)
   Article 2: -1.0 × 0.92 = -0.92 (very negative, high confidence)
   Article 3: +0.0 × 0.55 = 0.0 (neutral)
   
   Average = (+0.88 + (-0.92) + 0.0) / 3 = -0.04/3 = -0.013

Result: "Slightly negative" (ACCURATE!)
├─ Correctly shows the conflict
├─ Shows negative slightly outweighs positive
└─ Much more useful for decision-making

ADVANTAGE 1: Captures Sentiment Direction
──────────────────────────────────────────
Weighted: Can express negative sentiment (-1 to 0)
Stars: Only express positive (all are 1-5)

Example:
├─ Weighted -0.5 = "Bad coverage" ✓
├─ Stars 2 = "2 stars" (what does this mean exactly?) ✗

ADVANTAGE 2: Enables Mathematical Operations
──────────────────────────────────────────────
With weighted scores:
├─ Can multiply by confidence: 0.75 × 0.85 = 0.6375 ✓
├─ Can apply relevance weights: 0.6375 × 0.8 = 0.51 ✓
├─ Can calculate trends: today - yesterday ✓
└─ Can aggregate hierarchically: district = avg(constituencies) ✓

With stars:
├─ Averaging makes sense: (4 + 5) / 2 = 4.5
├─ But what does 4.5 stars mean? (vague)
└─ Can't multiply by confidence meaningfully

ADVANTAGE 3: Better for Visualization
──────────────────────────────────────
Weighted (-1 to +1) maps naturally to:
├─ Left (negative, red)
├─ Center (neutral, gray)
└─ Right (positive, green)

Can normalize to 0-1 for percentage display:
└─ pulseScore = 0.75 = "75% positive" (intuitive!)

ADVANTAGE 4: More Nuanced Comparability
─────────────────────────────────────────
Compare two candidates:

Candidate A: 
├─ Articles: 5 stars, 1 star, 3 stars
├─ Using stars: average = 3 (neutral)
└─ Using weighted: average = 0.0 (neutral but conflicted)

Candidate B:
├─ Articles: 3 stars, 3 stars, 3 stars
├─ Using stars: average = 3 (neutral)
└─ Using weighted: average = 0.0 (neutral and stable)

Same score but different situations!
├─ Weighted shows: A is contested, B is boring
├─ Can make different strategic decisions

MATHEMATICAL FOUNDATION:
═════════════════════════

Weighted scoring uses:
├─ Probability Theory: BERT's 5 probabilities
├─ Expected Value Calculation: E(X) = Σ(p_i × x_i)
├─ Weighted Averaging: Account for confidence
└─ Linear Normalization: Map to human-readable scale

These are standard statistical concepts used in:
├─ Machine Learning
├─ Risk Analysis
├─ Financial Modeling
├─ Quality Assurance
└─ Sentiment Analysis (our use case)

WHEN WOULD YOU USE STARS INSTEAD?
═════════════════════════════════

Use stars if:
├─ Displaying to non-technical users (intuitive)
├─ Don't need to aggregate/compare mathematically
└─ Simple categorical classification needed

But internally:
├─ Always use weighted scores for calculations
├─ Convert to stars only for user display
└─ Keep the mathematical precision

RECOMMENDATION:
═════════════════
✓ Use weighted scores (-1 to +1) for all calculations
✓ Use stars (1-5) only for user display
✓ Never use stars for aggregation/trending
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

## ❓ 5. FREQUENTLY ASKED QUESTIONS & CLARIFICATIONS

### FAQ 1: Why multiply by confidence? What does "exclude" mean?

```
CONFIDENCE WEIGHTING EXPLAINED:
════════════════════════════════

When calculating effectiveScore, we multiply:
  effectiveScore = sentimentScore × confidence × relevanceWeight

WHY MULTIPLY BY CONFIDENCE?
────────────────────────────
Confidence = "How sure is the BERT model about this prediction?"

Example Scenario:
─────────────────
Two articles, both show +0.75 sentiment:

Article A: "Development success in Bangalore"
├─ BERT Output: [0.01, 0.02, 0.02, 0.10, 0.85]
├─ Confidence: 0.85 (85% sure it's very positive)
├─ Model is VERY CERTAIN
└─ Should count FULLY: 0.75 × 0.85 = 0.6375

Article B: "Political analysis of mixed policies"
├─ BERT Output: [0.20, 0.20, 0.25, 0.20, 0.15]
├─ Confidence: 0.25 (25% sure it's 3-star neutral)
├─ Model is VERY UNCERTAIN (probabilities all similar)
└─ Should count LESS: 0.75 × 0.25 = 0.1875

Result: Both show +0.75 sentiment score, but Article B has only 29% 
        of the impact of Article A (0.1875 vs 0.6375)
        
This correctly handles uncertainty!

WHAT DOES "EXCLUDE" MEAN?
────────────────────────

You have two exclusion strategies:

SOFT EXCLUDE (Weighted Down):
├─ Keep the signal, but reduce its weight
├─ How: Multiply by confidence (already doing this!)
├─ Example: confidence 0.35 → multiply by 0.35
│           0.75 × 0.35 = 0.2625 (heavily reduced)
└─ When: Use for all signals, no exceptions

HARD EXCLUDE (Remove Completely):
├─ Don't include signal in calculations at all
├─ How: IF confidence < THRESHOLD THEN skip
├─ Threshold: Could be 0.25, 0.30, or 0.40
└─ When: Only for extremely unreliable predictions

RECOMMENDATION:
───────────────
Current approach (soft exclude via multiplication) is CORRECT:
├─ Keep all signals
├─ Let confidence naturally weight them down
├─ Only hard exclude if confidence < 0.20 (extremely unreliable)
└─ Result: No data loss, but noisy signals have minimal impact

CONFIDENCE THRESHOLD GUIDE:
═══════════════════════════
0.90+   → Use full weight (0.90 × score = 0.9 × score)
0.70-0.89 → Use full weight (still high confidence)
0.50-0.69 → Reduced weight (0.5-0.69 × score, somewhat uncertain)
0.30-0.49 → Minimal weight (0.3-0.49 × score, quite uncertain)
<0.30   → Consider excluding (OR use 0.20 × score, very uncertain)
```

### FAQ 2: Confusion about Probability & Weights Calculation

```
WHY USE PROBABILITY × WEIGHTS FOR SENTIMENT?
═════════════════════════════════════════════

The BERT model gives us: [prob_1star, prob_2star, prob_3star, prob_4star, prob_5star]

Example: [0.02, 0.05, 0.10, 0.45, 0.38]

Question: How do we turn these 5 numbers into ONE sentiment score?

NAIVE APPROACHES (Wrong):
──────────────────────────

Approach A: Just pick the highest?
└─ argmax([0.02, 0.05, 0.10, 0.45, 0.38]) = 0.45 (4-star)
└─ Problem: Loses the 38% chance of 5-star, loses the 10% neutral chance
└─ Too simplistic, loses information

Approach B: Simple average?
└─ (0.02 + 0.05 + 0.10 + 0.45 + 0.38) / 5 = 0.20
└─ Problem: Not tied to what the stars represent
└─ Meaningless number

CORRECT APPROACH: Weighted Average
────────────────────────────────────

Insight: Each star represents a different sentiment intensity
├─ 1-star = -1.0 (most negative)
├─ 2-star = -0.5 (negative)
├─ 3-star = 0.0 (neutral)
├─ 4-star = +0.5 (positive)
└─ 5-star = +1.0 (most positive)

The probabilities tell us: "How likely is each intensity?"

Use expected value formula: E(X) = Σ(probability × value)

sentimentScore = (0.02 × -1.0) + (0.05 × -0.5) + (0.10 × 0.0)
               + (0.45 × +0.5) + (0.38 × +1.0)
               = -0.02 + (-0.025) + 0 + 0.225 + 0.38
               = 0.558

INTERPRETATION:
───────────────
0.558 on -1.0 to +1.0 scale = "Strongly leaning positive"

This correctly says:
├─ "The model thinks mostly 4-5 star (positive)"
├─ "But there's some chance of neutral (10%)"
├─ "And small chance of negative (7%)"
└─ "Overall: 55.8% positive"

WHY IS THIS CALCULATION IMPORTANT?
───────────────────────────────────

Allows us to:
1. Get ONE number representing overall sentiment
2. Incorporate model's full distribution of belief
3. Weight by confidence (multiply by max probability)
4. Compare across articles (all on same scale)
5. Calculate trends (0.55 today vs 0.42 yesterday)
6. Aggregate hierarchically (candidate = avg(articles))

Without this:
├─ Can't compare articles meaningfully
├─ Can't detect trends
├─ Can't aggregate into pulse scores
└─ Stuck with just "positive/negative/neutral" labels (too coarse)
```

### FAQ 3: Pulse Score Normalization - Why (+1.0) / 2.0?

```
UNDERSTANDING PULSE NORMALIZATION:
═════════════════════════════════════

This is NOT time-based. It's a mathematical range transformation.

PROBLEM: Raw Scores are Hard to Interpret
───────────────────────────────────────────
Raw pulse (before normalization): -1.0 to +1.0

Example scores:
├─ -0.5 = Is this -50%? Or is it 50% negative? Confusing!
├─ 0.0 = Is this 0%? Or 50%? Ambiguous!
└─ +0.3 = Is this 30%? Or what? Unclear!

Users think in percentages (0-100%), not in bidirectional scales (-100% to +100%).

SOLUTION: Normalize to 0.0-1.0 (0% to 100%)
─────────────────────────────────────────────

Formula: normalizedScore = (rawScore + 1.0) / 2.0

This is a LINEAR TRANSFORMATION (standard in math/statistics):
  ├─ Add 1.0: Shift range from [-1, +1] to [0, +2]
  ├─ Divide by 2.0: Compress range [0, +2] to [0, +1]
  └─ Result: Maps [-1, +1] → [0, 1] (0% to 100%)

NOT TIME-BASED - It's just range mapping!

CONCRETE EXAMPLES:
════════════════════

Example 1: Extremely Negative
└─ Raw pulse: -1.0
   Normalized: (-1.0 + 1.0) / 2.0 = 0.0 / 2.0 = 0.0
   Display: "0% positive" or "Completely negative"

Example 2: Perfectly Balanced
└─ Raw pulse: 0.0
   Normalized: (0.0 + 1.0) / 2.0 = 1.0 / 2.0 = 0.5
   Display: "50% positive" or "Perfectly balanced"

Example 3: Moderately Positive (from your calculation)
└─ Raw pulse: 0.2681
   Normalized: (0.2681 + 1.0) / 2.0 = 1.2681 / 2.0 = 0.6341
   Display: "63.41% positive" (good sentiment)

Example 4: Very Positive
└─ Raw pulse: 0.8
   Normalized: (0.8 + 1.0) / 2.0 = 1.8 / 2.0 = 0.9
   Display: "90% positive" (excellent sentiment)

Example 5: Extremely Positive
└─ Raw pulse: 1.0
   Normalized: (1.0 + 1.0) / 2.0 = 2.0 / 2.0 = 1.0
   Display: "100% positive" (perfect sentiment)

MATHEMATICAL CONCEPT:
═════════════════════

This is called "Min-Max Normalization" or "Feature Scaling"

General formula:
  normalized = (x - min) / (max - min)

For our case where min = -1.0 and max = +1.0:
  normalized = (x - (-1.0)) / (+1.0 - (-1.0))
             = (x + 1.0) / 2.0

This is a standard technique used in:
├─ Machine Learning (normalizing features)
├─ Statistics (standardization)
├─ Data Science (scaling data)
└─ Image Processing (pixel value normalization)

WHY THIS SPECIFIC FORMULA?
═══════════════════════════

Requirement: Map [-1, +1] to [0, 1]

Let's check different values:
├─ x = -1.0: (-1.0 + 1.0) / 2.0 = 0.0 ✓ (left boundary)
├─ x = 0.0:  (0.0 + 1.0) / 2.0 = 0.5 ✓ (middle)
└─ x = +1.0: (+1.0 + 1.0) / 2.0 = 1.0 ✓ (right boundary)

Linear and monotonic:
├─ Larger x → Larger output (preserves ordering)
├─ Equal spacing → Equal distance (linear)
└─ Simple and reversible (can reverse if needed)

WHY NOT ALTERNATIVES?
══════════════════════

Option A: Just multiply by 0.5?
  0.2681 × 0.5 = 0.13405 (too low!)
  Problem: Negative values stay negative (-0.5 × 0.5 = -0.25 ≠ in [0,1] range!)

Option B: Use sigmoid function?
  sigmoid(x) = 1 / (1 + e^(-x))
  Problem: Non-linear, curves the scale, harder for dashboards

Option C: Use absolute value?
  |0.2681| = 0.2681 (loses sign information!)
  Problem: Can't distinguish -0.5 from +0.5

Option D: (x + 1.0) / 2.0 ← BEST ✓
  Advantages:
  ├─ Linear (equal steps = equal changes)
  ├─ Simple (one operation)
  ├─ Intuitive (0 = bad, 0.5 = neutral, 1 = good)
  ├─ Standard in statistics
  └─ Easy to reverse: x = (2.0 × normalized) - 1.0

INTERPRETATION (Two Ways):
════════════════════════════

Interpretation 1: "Percentage Positive"
├─ Normalized score: 0.634
├─ Meaning: "63.4% of the sentiment spectrum is positive"
└─ How positive: Moderately positive

Interpretation 2: "Position on Scale"
├─ Normalized score: 0.634
├─ Scale: 0 (very bad) ─── 0.5 (neutral) ─── 1 (very good)
├─ Position: Above neutral, trending positive
└─ Relative strength: Good but not excellent

Both interpretations are valid!
```

### FAQ 4: Relevance Weights for Entity Types

```
ARE WE USING RELEVANCE WEIGHTS?
════════════════════════════════

SHORT ANSWER: Conceptually YES, but not fully in database yet.

CURRENT STATUS:
───────────────
✅ NewsEntityMention table stores multiple entity types per article
✅ Weights are calculated in our pulse calculation logic
❌ relevanceWeight field not yet stored in database
❌ SentimentSignal not linked to specific entity types

WHAT NEEDS TO BE IMPLEMENTED:
═════════════════════════════

Database Schema Update:

CREATE TABLE NewsEntityMention {
  id: Int @id
  articleId: Int
  entityType: EntityType (CANDIDATE | PARTY | GEO_UNIT)
  entityId: Int
  relevanceWeight: Float? ← NEW (currently missing)
  
  @@unique([articleId, entityType, entityId])
  @@index([relevanceWeight]) ← NEW
}

Default Relevance Weights to Populate:
──────────────────────────────────────
CANDIDATE direct mention:       1.0  (strongest)
CANDIDATE opposition mention:   0.95
GEO_UNIT (primary constituency): 0.85
GEO_UNIT (containing district):  0.70
GEO_UNIT (parent state):         0.50
GEO_UNIT (other state):          0.15
PARTY (same as candidate):       0.70
PARTY (other party):             0.40

USAGE IN PULSE CALCULATION:
───────────────────────────

For Siddaramaiah's pulse (7-day):

SELECT signals FROM SentimentSignal s
JOIN NewsArticle a ON s.sourceRefId = a.id
JOIN NewsEntityMention m ON a.id = m.articleId
WHERE m.entityType = 'CANDIDATE' 
  AND m.entityId = 123
  AND s.createdAt > now() - 7 days

For each signal:
  effectiveScore = s.sentimentScore × s.confidence × m.relevanceWeight

Result: Only signals mentioning Siddaramaiah count fully (weight 1.0)
        Signals mentioning Congress get 0.70 weight
        Signals mentioning his constituency get 0.85 weight

RECOMMENDATION:
────────────────
1. Add relevanceWeight field to NewsEntityMention
2. Populate with default values based on entity type
3. Allow admin to override weights per entity
4. Use in all pulse calculations

This gives proper credit based on mention type!
```

### FAQ 5: Sentiment Signal Creation

```
ARE WE CREATING ONE SIGNAL PER ARTICLE?
════════════════════════════════════════

SHORT ANSWER: Currently, sort of. Recommendation: Should be enhanced.

CURRENT BEHAVIOR:
──────────────────
Article: "Siddaramaiah announces scheme in Bangalore"

Mentions: CANDIDATE (Siddaramaiah), GEO_UNIT (Bangalore), PARTY (Congress)
BERT Result: sentiment=POSITIVE, score=0.75, confidence=0.85

Currently creates:
├─ SentimentSignal {
│   geoUnitId: 456 (Bangalore),
│   sourceRefId: 5001,
│   sentiment: POSITIVE,
│   sentimentScore: 0.75,
│   confidence: 0.85
│ }
│
└─ Maybe one more for state level if applicable

PROBLEM WITH CURRENT APPROACH:
──────────────────────────────
1. Only stores geounit-level sentiment
2. Doesn't track which entity triggered it
3. Can't apply different weights for candidate vs party mention
4. Can't distinguish "Siddaramaiah's pulse" from "Congress party pulse"

RECOMMENDED ENHANCEMENT:
═══════════════════════

Create SentimentSignal for EACH entity mention:

For single article: "Siddaramaiah announces scheme in Bangalore"

Create THREE SentimentSignals (one per entity type):

SentimentSignal 1 (Candidate Pulse):
├─ geoUnitId: 456 (Bangalore)
├─ sourceRefId: 5001 (article)
├─ sourceEntityType: CANDIDATE ← NEW
├─ sourceEntityId: 123 ← NEW
├─ sourceEntityMentionId: 9001 ← NEW (reference to NewsEntityMention)
├─ relevanceWeight: 1.0 ← NEW
├─ sentiment: POSITIVE
├─ sentimentScore: 0.75
└─ confidence: 0.85

SentimentSignal 2 (Party Pulse):
├─ geoUnitId: 456 (Bangalore)
├─ sourceRefId: 5001 (article)
├─ sourceEntityType: PARTY ← NEW
├─ sourceEntityId: 789 ← NEW
├─ sourceEntityMentionId: 9002 ← NEW
├─ relevanceWeight: 0.70 ← NEW
├─ sentiment: POSITIVE
├─ sentimentScore: 0.75
└─ confidence: 0.85

SentimentSignal 3 (Geo Pulse):
├─ geoUnitId: 456 (Bangalore)
├─ sourceRefId: 5001 (article)
├─ sourceEntityType: GEO_UNIT ← NEW
├─ sourceEntityId: 456 ← NEW
├─ sourceEntityMentionId: 9003 ← NEW
├─ relevanceWeight: 0.85 ← NEW
├─ sentiment: POSITIVE
├─ sentimentScore: 0.75
└─ confidence: 0.85

BENEFITS:
─────────
1. Each entity type gets proper weight
2. Can query signals by entity type
3. Can calculate entity-specific pulse
4. Can track which mentions matter most
5. Full audit trail of why signal was created

IMPLEMENTATION PRIORITY:
═════════════════════════
Phase 1 (Now): Keep current approach (works for MVP)
Phase 2 (Soon): Add sourceEntityType, sourceEntityId fields
Phase 3 (Next): Create signals for all entity types per article
Phase 4 (Future): Add sentiment signal linking to candidate profiles
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
