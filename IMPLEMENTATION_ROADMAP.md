# Implementation Status & Recommendations

## Current System Status

### ✅ Fully Implemented & Working
1. **News Ingestion Service**
   - Fetches articles from Google News RSS every hour
   - Deduplicates by sourceUrl
   - Creates NewsArticle records
   - Stores in approved status
   - Async triggers sentiment analysis

2. **BERT Sentiment Analysis**
   - Python microservice analyzes articles
   - Produces 5 probabilities (1-5 stars)
   - Calculates normalized score (-1.0 to +1.0)
   - Calculates confidence (max probability)
   - Stores SentimentSignal records

3. **Basic Database Schema**
   - NewsArticle table ✓
   - NewsEntityMention table ✓
   - SentimentSignal table ✓
   - DailyGeoStats table ✓
   - Alert table ✓

4. **Daily Stats Computation**
   - Runs nightly
   - Aggregates sentiment per geounit per day
   - Calculates avgSentiment
   - Should calculate pulseScore (verify if working)

### ⚠️ Partially Implemented
1. **NewsKeyword Table**
   - Table exists ✓
   - Stores keywords per entity ✓
   - Used for query building ✓
   - Priority field exists but NOT USED ❌
   - Auto-seeding might not be complete ❌

2. **EntityMonitoring Table**
   - Table exists ✓
   - Stores active entities to monitor ✓
   - Used to determine what to fetch ✓
   - Not clear if properly auto-created on subscription ❌

3. **Pulse Calculation**
   - Algorithm documented ✓
   - Core logic should work ✓
   - Verification needed (test with real data) ❌
   - Normalization formula correct ✓

4. **Alert System**
   - Infrastructure exists ✓
   - Cron job defined ✓
   - Logic for alerts exists ✓
   - Verification needed ❌

### ❌ Not Yet Implemented
1. **Priority-Based Fetching**
   - Tiered scheduler not implemented
   - All entities fetched with same frequency
   - Should implement: Different cron jobs for Tier 1, 2, 3
   - Medium complexity, medium priority

2. **Relevance Weights in Database**
   - Weights calculated in code only
   - Should be stored in NewsEntityMention.relevanceWeight
   - SentimentSignal should link to entity type
   - Medium complexity, high priority

3. **Multiple SentimentSignals per Article**
   - Currently: One signal per geounit
   - Should: One signal per entity mention (candidate, party, geo)
   - Requires: Schema changes + signal creation logic
   - Medium complexity, high priority

4. **Dominant Issue Extraction**
   - Algorithm designed (keyword frequency)
   - Not yet implemented
   - Should populate DailyGeoStats.dominantIssue
   - Low complexity, medium priority

5. **Candidate Pulse Endpoint**
   - API should exist: GET /analytics/pulse/candidate/{id}
   - Returns pulseScore, trend, topDrivers
   - Verify if implemented and tested
   - Medium complexity, high priority

6. **User Alerts Display**
   - Alert creation likely works
   - Need to verify user receives alerts
   - Dashboard display needed
   - Medium complexity, medium priority

---

## Implementation Priority Matrix

### PHASE 1: CRITICAL (Do First)
**Target: Next 1-2 weeks**

#### 1.1 Verify Pulse Calculation Works
```
Status: Probably works, but unverified
Action:
  1. Create test candidate with 10+ articles
  2. Calculate pulse manually
  3. Compare with API response
  4. Fix any formula issues
  
Time: 4 hours
Priority: CRITICAL (core feature)
```

#### 1.2 Add Relevance Weights to Database
```
Status: Not in database, only in code
Action:
  1. Add relevanceWeight field to NewsEntityMention
  2. Update ingestion to populate weights
  3. Update pulse calculation to use database weights
  4. Test that different entity types get different weights
  
Migration:
```sql
ALTER TABLE NewsEntityMention ADD COLUMN relevanceWeight FLOAT DEFAULT 1.0;
UPDATE NewsEntityMention SET relevanceWeight = 1.0;  -- Default for existing records
CREATE INDEX idx_relevanceWeight ON NewsEntityMention(relevanceWeight);
```

Time: 6 hours
Priority: CRITICAL (affects all pulses)
```

#### 1.3 Implement Multiple SentimentSignals per Article
```
Status: Currently creates 1 signal per article+geounit
Action:
  1. Modify sentiment analysis to create signals per entity type
  2. Link signal to specific NewsEntityMention
  3. For each article mention (candidate, party, geo):
     - Create separate SentimentSignal
     - Set sourceEntityMentionId
     - Use correct relevanceWeight
  4. Update pulse query to use entity-specific signals
  
Database Changes:
```sql
ALTER TABLE SentimentSignal 
ADD COLUMN sourceEntityMentionId INT,
ADD COLUMN sourceEntityType EntityType,
ADD COLUMN sourceEntityId INT,
ADD COLUMN relevanceWeight FLOAT;

CREATE INDEX idx_sourceEntity ON SentimentSignal(sourceEntityType, sourceEntityId);
ALTER TABLE SentimentSignal 
ADD FOREIGN KEY (sourceEntityMentionId) REFERENCES NewsEntityMention(id);
```

Time: 8 hours
Priority: CRITICAL (enables proper entity weighting)
```

### PHASE 2: HIGH PRIORITY (Do Next)
**Target: Week 3-4**

#### 2.1 Implement Candidate Pulse Endpoint
```
Status: Unclear if exists
Action:
  1. Create AnalyticsController.getPulseTrend()
  2. Implement CandidatePulseService.calculatePulse()
  3. Return: pulseScore, trend, topDrivers
  4. Add comprehensive tests
  5. Document API endpoint
  
Expected Response:
{
  candidateId: 123,
  candidateName: "Siddaramaiah",
  partyName: "Congress",
  pulseScore: 0.634,
  trend: "STABLE",
  articlesAnalyzed: 8,
  timeWindow: "7 days",
  lastUpdated: "2025-01-08T14:32:00Z",
  topDrivers: [...]
}

Time: 8 hours
Priority: HIGH (main user-facing feature)
```

#### 2.2 Implement Dominant Issue Extraction
```
Status: Not implemented
Action:
  1. Create IssueExtractionService
  2. Implement keyword frequency approach
  3. Define issue categories and keywords
  4. Populate DailyGeoStats.dominantIssue
  5. Test accuracy
  
Issue Categories:
  - Infrastructure
  - Welfare
  - Elections
  - Political/Policy
  - Controversy
  - Healthcare
  - Economy
  - Law & Order
  
Time: 6 hours
Priority: HIGH (used in daily stats)
```

#### 2.3 Verify Alert System Works
```
Status: Partially implemented
Action:
  1. Test sentiment spike detection
  2. Test negative surge detection
  3. Test high-impact hit detection
  4. Verify alerts created in database
  5. Check user receives notifications
  6. Test dashboard displays alerts
  
Time: 6 hours
Priority: HIGH (critical user feature)
```

### PHASE 3: MEDIUM PRIORITY (Do after Phase 2)
**Target: Week 5-6**

#### 3.1 Implement Priority-Based Fetching
```
Status: Not implemented (all entities fetched equally)
Action:
  1. Populate NewsKeyword.priority field
  2. Create three separate schedulers:
     - Tier1: Every 1 hour (priority >= 9)
     - Tier2: Every 2 hours (priority 5-8)
     - Tier3: Every 6 hours (priority < 5)
  3. Update ingestion to filter by priority
  4. Monitor performance/API usage
  
Code Changes:
@Injectable()
export class NewsIngestionScheduler {
  @Cron('0 * * * * *') // Every hour
  async fetchTier1() {
    const keywords = await getKeywords({ minPriority: 9 });
    await ingestionService.fetchNews(keywords);
  }
  
  @Cron('0 */2 * * * *') // Every 2 hours
  async fetchTier2() {
    const keywords = await getKeywords({ 
      minPriority: 5, 
      maxPriority: 8 
    });
    await ingestionService.fetchNews(keywords);
  }
  
  @Cron('0 */6 * * * *') // Every 6 hours
  async fetchTier3() {
    const keywords = await getKeywords({ maxPriority: 4 });
    await ingestionService.fetchNews(keywords);
  }
}

Time: 4 hours
Priority: MEDIUM (optimization, not critical)
```

#### 3.2 Add Sentiment Spike Alerts
```
Status: Logic documented, verify implementation
Action:
  1. Test sentiment spike detection
  2. Create SentimentSpikeService
  3. Run hourly background job
  4. Verify alerts created for users
  5. Test threshold (delta >= 0.35)
  
Time: 4 hours
Priority: MEDIUM (enhancement)
```

### PHASE 4: NICE-TO-HAVE (Do later)
**Target: Week 7+**

#### 4.1 ML-Based Dominant Issue (Replace Keyword)
```
Use: Gensim, spaCy, or Hugging Face
Benefit: More accurate, handles emerging issues
Time: 16 hours
Priority: LOW (keyword approach works)
```

#### 4.2 Exponential Decay for Recency
```
Weight older articles less: weight = e^(-λ × days_old)
Benefit: Recent news more important
Time: 4 hours
Priority: LOW (nice enhancement)
```

#### 4.3 Advanced Dashboard Features
```
- Pulse trend graph (7/30/90 days)
- Sentiment heatmap by issue
- Competitive analysis (multiple candidates)
- Geographic breakdown
Time: 24+ hours
Priority: LOW (UI enhancement)
```

---

## Testing Checklist

### Unit Tests (Required before Phase 2)
- [ ] Sentiment score calculation (expected value)
- [ ] Confidence extraction (max probability)
- [ ] Effective score multiplication
- [ ] Pulse normalization formula
- [ ] Relevance weight application
- [ ] Trend detection logic
- [ ] Alert threshold checks

### Integration Tests (Required before launch)
- [ ] News ingestion end-to-end
- [ ] Sentiment analysis pipeline
- [ ] SentimentSignal creation
- [ ] Daily stats aggregation
- [ ] Pulse calculation (8+ articles)
- [ ] Trend detection
- [ ] Alert creation
- [ ] User notification

### Manual Testing (Required before each phase)
- [ ] Create test candidate
- [ ] Verify 10+ articles fetched
- [ ] Check sentiment analysis completes
- [ ] Verify pulse score calculated
- [ ] Check alerts triggered correctly
- [ ] Test dashboard displays correctly

### Test Data Needed
```
Candidate: Test Candidate 123
Party: Test Party
Constituency: Test Constituency
Articles: 15 real articles from Google News
Timespan: 7 days
Sentiment mix:
  - 5 positive articles (confidence 0.85+)
  - 5 negative articles (confidence 0.80+)
  - 5 neutral articles (confidence 0.50+)
```

---

## Risk & Mitigation

### Risk 1: Sentiment Analysis Inaccuracy
**Risk:** BERT model gives poor quality scores
**Mitigation:** 
- Test on 100+ manually labeled articles
- Compare against baseline models
- Fine-tune if accuracy < 80%
- Plan B: Use ensemble of multiple models

### Risk 2: Performance at Scale
**Risk:** Slow queries with millions of signals
**Mitigation:**
- Add proper indexes on geoUnitId, createdAt
- Use pagination for time-series queries
- Cache pulse scores (calculate once, reuse)
- Monitor query performance

### Risk 3: News API Limitations
**Risk:** Google News RSS quota exceeded
**Mitigation:**
- Implement priority-based fetching (Phase 3)
- Add rate limiting between fetches
- Cache RSS feed responses
- Plan backup: NewsAPI.org, NewsData.io

### Risk 4: Relevance Weights Incorrect
**Risk:** Weights don't reflect real importance
**Mitigation:**
- Gather user feedback on pulse accuracy
- A/B test different weight values
- Adjust based on user behavior
- Collect "was this accurate?" feedback

---

## Deployment Steps

### Pre-Deployment
1. All Phase 1 implementations complete
2. Phase 2 implementations complete and tested
3. Run full integration test suite
4. Manual UAT by team
5. Performance load testing (1000+ candidates)
6. Backup database before any migrations

### Database Migrations (In Order)
```sql
-- 1. Add relevance weights
ALTER TABLE NewsEntityMention ADD COLUMN relevanceWeight FLOAT DEFAULT 1.0;

-- 2. Enhance SentimentSignal
ALTER TABLE SentimentSignal 
ADD COLUMN sourceEntityMentionId INT,
ADD COLUMN sourceEntityType EntityType,
ADD COLUMN sourceEntityId INT,
ADD COLUMN relevanceWeight FLOAT;

-- 3. Add indexes
CREATE INDEX idx_sentimentSignal_entity ON SentimentSignal(sourceEntityType, sourceEntityId);
CREATE INDEX idx_newsKeyword_priority ON NewsKeyword(priority);

-- 4. Backfill relevance weights
UPDATE SentimentSignal 
SET relevanceWeight = 0.85 
WHERE sourceEntityType = 'GEO_UNIT';
UPDATE SentimentSignal 
SET relevanceWeight = 1.0 
WHERE sourceEntityType = 'CANDIDATE';
```

### Deployment Order
1. Deploy Phase 1 changes
2. Run migrations
3. Deploy Phase 2 services
4. Run integration tests
5. Enable new endpoints (feature flag)
6. Monitor for 24 hours
7. Full cutover

---

## Success Metrics

### Phase 1 (Foundation)
- ✓ All migrations complete
- ✓ 95%+ BERT accuracy on test set
- ✓ Pulse calculation matches manual calculation
- ✓ No performance degradation

### Phase 2 (Core Features)
- ✓ Pulse endpoint returns < 500ms
- ✓ Alerts triggered correctly 100% of time
- ✓ Dominant issue populated for 95%+ of days
- ✓ Users report pulse as accurate

### Phase 3 (Optimization)
- ✓ API call reduction by 40%
- ✓ No news fetching delays
- ✓ Cost savings from reduced API calls
- ✓ More subscribed candidates supported

---

## Timeline Estimate

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| 1 (Critical) | 2 weeks | Now | Week 2 |
| 2 (High) | 3 weeks | Week 2 | Week 5 |
| 3 (Medium) | 2 weeks | Week 5 | Week 7 |
| 4 (Nice) | Ongoing | Week 7+ | - |

**Total MVP Duration:** 5 weeks (Phase 1 + 2)
**Full System:** 7 weeks (Phase 1 + 2 + 3)
