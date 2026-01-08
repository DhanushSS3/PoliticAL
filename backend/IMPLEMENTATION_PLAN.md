# PoliticAI Sentiment Intelligence System - Implementation Plan

## ✅ Phase 1: Critical Fixes (NOW - Fixes 70% of Gap)

### 1.1 Geo Attribution Strategy
**File**: `backend/src/modules/news/services/sentiment-analysis.service.ts`
**Priority**: CRITICAL
**Status**: 🔴 Not Implemented

**Current Problem**: All Candidate/Party sentiment signals are dropped because no GeoUnit is linked.

**Solution**: Implement waterfall geo-resolution logic:
```typescript
1. Check if article has GEO_UNIT entity mention → use it
2. Else check CANDIDATE mention → lookup candidate.profile.primaryGeoUnitId
3. Else check PARTY mention → lookup party default geo (state level)
4. Else → use fallback State GeoUnit
```

**SOLID Principle**: Single Responsibility - Create `GeoAttributionResolver` service

---

## ✅ Phase 2: Analytics Foundation

### 2.1 Create Analytics Module Structure
```
backend/src/modules/analytics/
├── analytics.module.ts
├── controllers/
│   └── analytics.controller.ts
├── services/
│   ├── candidate-pulse.service.ts      # Pulse calculation
│   ├── relevance-calculator.service.ts # Relevance weighting
│   └── alert.service.ts                # Alert logic
└── dto/
    ├── pulse-request.dto.ts
    └── pulse-response.dto.ts
```

### 2.2 Relevance Calculator Service
**Purpose**: Calculate relevance weight based on entity match type
**SOLID**: Single Responsibility, Open/Closed (extensible weights)

```typescript
class RelevanceCalculatorService {
  WEIGHTS = {
    CANDIDATE: 1.0,
    GEO_UNIT: 0.8,
    PARTY: 0.6,
    STATE: 0.4
  };
  
  calculateWeight(entityMentions): number;
}
```

### 2.3 Candidate Pulse Service
**Purpose**: Calculate weighted average sentiment for candidates
**SOLID**: Single Responsibility, Dependency Inversion (depends on abstractions)

```typescript
class CandidatePulseService {
  calculatePulse(candidateId, days): PulseData;
  getTopDrivers(candidateId, limit): Article[];
  getTrend(candidateId): 'RISING' | 'STABLE' | 'DECLINING';
}
```

**Formula**:
```
effectiveScore = sentimentScore × confidence × relevanceWeight
pulse = Σ(effectiveScores) / count
```

---

## ✅ Phase 3: Alert System

### 3.1 Alert Service
**Purpose**: Detect anomalies and trigger user alerts
**SOLID**: Single Responsibility, Strategy Pattern for alert types

```typescript
class AlertService {
  checkSentimentSpikes(geoUnitId): Alert[];
  checkNegativeSurges(geoUnitId): Alert[];
  checkHighConfidenceHits(candidateId): Alert[];
}
```

### 3.2 Alert Triggers

| Alert Type | Condition | Action |
|------------|-----------|--------|
| **Sentiment Spike** | \|Δ\| ≥ 0.35 AND count ≥ 3 | Create SENTIMENT_SPIKE alert |
| **Negative Surge** | NEGATIVE ≥ 3 AND conf ≥ 0.8 within 24h | Create CONTROVERSY alert |
| **High-Confidence Hit** | score ≤ -0.7 AND conf ≥ 0.9 | Create NEWS_MENTION alert |

### 3.3 Baseline Calculation
```typescript
baselinePulse = avg(signals from day -7 to day -1)
todayPulse = avg(signals from day 0)
delta = todayPulse - baselinePulse
```

---

## ✅ Phase 4: API Endpoints

### 4.1 Analytics Controller

**GET** `/api/analytics/candidate/:id/pulse`
- Query params: `?days=7`
- Response: PulseData with score, trend, drivers

**GET** `/api/analytics/constituency/:geoUnitId/comparison`
- Response: Comparison data for all candidates in constituency

**GET** `/api/analytics/candidate/:id/trend`
- Response: Time-series data for charting

---

## ✅ Phase 5: Background Jobs

### 5.1 Alert Detection Job
**Schedule**: Hourly
**Logic**:
```typescript
@Cron(CronExpression.EVERY_HOUR)
async detectAlerts() {
  // For each active candidate with subscribers
  // Run spike/surge checks
  // Create alerts if triggered
}
```

### 5.2 Daily Stats Aggregation
**Schedule**: Daily at midnight
**Logic**:
```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async aggregateDailyStats() {
  // Group signals by geo + date
  // Calculate avgSentiment, pulseScore
  // Store in DailyGeoStats
}
```

---

## 📋 Implementation Checklist

### Phase 1: Critical Fixes ⏰ ETA: 1 hour
- [ ] Create `GeoAttributionResolverService`
- [ ] Update `SentimentAnalysisService` to use resolver
- [ ] Test with existing data
- [ ] Verify signals are now being saved

### Phase 2: Analytics Foundation ⏰ ETA: 2 hours
- [ ] Create `analytics` module boilerplate
- [ ] Implement `RelevanceCalculatorService`
- [ ] Implement `CandidatePulseService`
- [ ] Write unit tests

### Phase 3: Alert System ⏰ ETA: 2 hours
- [ ] Implement `AlertService`
- [ ] Implement spike detection
- [ ] Implement surge detection
- [ ] Create cron job

### Phase 4: API ⏰ ETA: 1 hour
- [ ] Create DTOs
- [ ] Create `AnalyticsController`
- [ ] Add endpoints
- [ ] Test with Postman/curl

### Phase 5: Jobs ⏰ ETA: 30 min
- [ ] Schedule alert job
- [ ] Schedule daily aggregation job

---

## 🎯 Success Criteria

✅ **Geo Attribution Fixed**
- Articles about "BJP" now create signals linked to Karnataka state
- Articles about "Basavaraj Bommai" link to his constituency

✅ **Pulse API Working**
- `GET /api/analytics/candidate/8040/pulse` returns valid pulse score
- Score is between -1.0 and 1.0
- Includes trend and top drivers

✅ **Alerts Triggering**
- Manual spike test creates alert
- Alert message is actionable
- No duplicate alerts

✅ **Dashboard Ready**
- Frontend can fetch pulse data
- Frontend can display trend charts
- Frontend can show alerts

---

## 🏗️ Architecture Principles Applied

1. **Single Responsibility**: Each service has one job
2. **Open/Closed**: Weight configuration is extensible
3. **Liskov Substitution**: Alert strategies are interchangeable
4. **Interface Segregation**: DTOs are minimal and focused
5. **Dependency Inversion**: Services depend on PrismaService abstraction

---

## 📊 Data Flow Diagram

```
[News Ingestion] → [Sentiment Analysis] → [Geo Attribution Resolver]
                                                    ↓
                                         [SentimentSignal Created]
                                                    ↓
                                         [Relevance Calculator]
                                                    ↓
                    [Pulse Service] ← [Load Signals + Entity Mentions]
                            ↓
                    [Compute Weighted Avg]
                            ↓
                    [Return Pulse Data]
                            ↓
            [Frontend Dashboard / Alert System]
```

---

Let's begin implementation! 🚀
