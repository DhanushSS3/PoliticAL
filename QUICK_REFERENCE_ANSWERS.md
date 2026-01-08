# Quick Reference: Answers to All User Questions

## Quick Answers Summary

### Q1: Why weighted scores instead of stars?
**Stars (1-5):** Can't properly aggregate conflicting sentiment
- Article 1: 5 stars, Article 2: 1 star → Average: 3 stars ❌ (misleading as "neutral")

**Weighted (-1 to +1):** Properly captures conflict
- Article 1: +1.0, Article 2: -1.0 → Average: 0.0 ✅ (correctly shows conflict)

**Advantage:** Weighted scores enable mathematical operations (multiply by confidence, calculate trends, aggregate hierarchically)

---

### Q2: Why use probability × weights for sentiment score?
**BERT gives:** 5 probabilities like [0.02, 0.05, 0.10, 0.45, 0.38] (summing to 1.0)

**We use:** Expected Value formula = Σ(probability × sentiment_weight)
```
sentimentScore = (0.02×-1.0) + (0.05×-0.5) + (0.10×0.0) + (0.45×+0.5) + (0.38×+1.0)
               = 0.558 (moderately positive)
```

**Why:** 
- Combines probabilities into ONE meaningful sentiment number
- Incorporates model's full distribution of belief
- Weights by confidence (more confident predictions matter more)

---

### Q3: Mathematical concepts used
1. **Probability Theory** → BERT's 5 probabilities
2. **Weighted Averaging** → sentiment × confidence × relevance
3. **Linear Normalization** → (x + 1.0) / 2.0 for 0-100% display
4. **Time-Series Analysis** → trend detection (recent vs baseline)
5. **Aggregation** → Average multiple signals for stability
6. **Conditional Logic** → Thresholds for alerts/decisions
7. **Exponential Decay** (future) → Recency bias for older news

---

### Q4: What does "exclude" mean in confidence weighting?
**SOFT EXCLUDE (recommended):**
- Keep signal, but reduce its weight by multiplying by confidence
- Low confidence (0.35) → multiply by 0.35 → heavily reduced impact
- Formula: `effectiveScore = sentimentScore × confidence × relevanceWeight`

**HARD EXCLUDE:**
- Remove signal completely from calculation
- Use only if confidence < 0.20 (extremely unreliable)

**Current approach is correct:** Multiplication by confidence IS soft exclude

---

### Q5: Is priority-based fetching implemented?
**Current Status:** ❌ NOT IMPLEMENTED
- All entities fetched equally every hour
- NewsKeyword table has priority field but not used

**To Implement:**
```
Tier 1 (Every 1 hour):   Subscribed candidate + party + constituency
Tier 2 (Every 2 hours):  District + adjacent areas
Tier 3 (Every 6 hours):  State + national news
```

**Timeline:** Recommend implementing for efficiency before large-scale deployment

---

### Q6: How to get dominant issue for DailyGeoStats?
**Simple Approach (v0 - Recommended):**
1. Get all articles for date + geounit
2. Extract titles + summaries
3. Count word frequency (remove stop words)
4. Map to issue categories (Infrastructure, Welfare, Election, etc.)
5. Return most frequent issue

**Example:**
```
Articles today: "Development project", "Roads announcement", "New infrastructure"
Keyword frequency: Infrastructure=3, Welfare=1, Election=1
Result: dominantIssue = "Infrastructure"
```

---

### Q7: Do we create SentimentSignal for each news article?
**Current Status:** ✅ YES (per article + geounit)
- One SentimentSignal per article per geounit

**Recommended Enhancement:** Create per entity mention
- SentimentSignal for CANDIDATE mention (weight 1.0)
- SentimentSignal for PARTY mention (weight 0.70)
- SentimentSignal for GEO_UNIT mention (weight 0.85)
- Same article → 3 signals instead of 1

**Benefits:** Better pulse calculation with proper entity-specific weights

---

### Q8: Are we using relevance weights for different entity types?
**Current Status:** ⚠️ PARTIALLY
- ✅ Weights defined in architecture
- ✅ Calculated in logic
- ❌ Not stored in database yet
- ❌ SentimentSignal not linked to entity types

**To Implement:**
1. Add `relevanceWeight` field to NewsEntityMention
2. Add sourceEntityType/sourceEntityId to SentimentSignal
3. Apply weights: CANDIDATE=1.0, GEO_UNIT(constituency)=0.85, PARTY=0.70, etc.

---

### Q9: Why (+1.0) / 2.0 in pulse normalization?
**This is NOT time-based. It's mathematical range transformation.**

**Problem:** Raw pulse (-1.0 to +1.0) is hard to interpret
- What's -0.5? Is it -50%? Or 50% negative? Confusing!

**Solution:** Normalize to 0.0-1.0 (percentage display)
- Formula: `normalizedScore = (rawScore + 1.0) / 2.0`

**Examples:**
```
Raw -1.0  →  Normalized 0.0   (0% positive, very bad)
Raw  0.0  →  Normalized 0.5   (50% positive, neutral)
Raw +0.2  →  Normalized 0.6   (60% positive, good)
Raw +1.0  →  Normalized 1.0   (100% positive, perfect)
```

**Why this formula:** Standard linear transformation in statistics
- Maps [-1, +1] to [0, 1]
- Preserves order and spacing
- Reversible: `rawScore = (2.0 × normalized) - 1.0`

---

## Summary of Status

| Feature | Status | Action |
|---------|--------|--------|
| News ingestion | ✅ Working | Runs hourly, fetches all entities |
| Priority-based fetching | ❌ Not implemented | Implement tiered scheduler |
| BERT sentiment analysis | ✅ Working | Scores normalized to -1 to +1 |
| Confidence weighting | ✅ Implemented | Multiplies score × confidence |
| Relevance weights | ⚠️ Partial | Add to database, link to entities |
| Daily geo stats | ✅ Working | Aggregates daily sentiment |
| Dominant issue | ⚠️ Partial | Simple keyword approach ready |
| Pulse calculation | ✅ Working | Averages effective scores |
| Pulse normalization | ✅ Working | (raw + 1.0) / 2.0 formula |
| Multiple signals per article | ❌ Not yet | Should enhance for entity types |

---

## Recommended Implementation Order

1. **Now:** Verify BERT sentiment pipeline is working end-to-end
2. **Week 1:** Add relevanceWeight to NewsEntityMention, implement in pulse calculations
3. **Week 2:** Enhance SentimentSignal to track source entity types
4. **Week 3:** Implement priority-based fetching scheduler
5. **Future:** Add ML-based dominant issue extraction, exponential decay for recency

---

## Key Takeaways

1. **Weighted scores are better than stars** because they enable mathematical operations and properly capture conflicting sentiment
2. **Multiplying by confidence** is correct because low-confidence predictions should have lower impact
3. **Adding +1 and dividing by 2** is standard range normalization, not time-based
4. **Relevance weights are critical** for proper entity-specific pulse calculations
5. **Priority-based fetching** is important for efficiency at scale
6. **Create signals per entity type** to properly weight candidate vs party vs geographic signals
