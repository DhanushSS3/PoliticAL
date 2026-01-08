# Mathematical Foundation of PoliticAI

## 1. Probability & Expected Value

### 1.1 BERT Model Output
```
BERT Classification Head produces 5 probabilities:
P = [p₁, p₂, p₃, p₄, p₅]

Where:
- p₁ = Probability of 1-star (very negative)
- p₂ = Probability of 2-star (negative)
- p₃ = Probability of 3-star (neutral)
- p₄ = Probability of 4-star (positive)
- p₅ = Probability of 5-star (very positive)

Constraint: Σ pᵢ = 1.0 (probabilities sum to 1)

Example: [0.02, 0.05, 0.10, 0.45, 0.38]
- 2% chance it's 1-star
- 5% chance it's 2-star
- 10% chance it's 3-star
- 45% chance it's 4-star ← Most likely
- 38% chance it's 5-star
```

### 1.2 Expected Value Calculation
```
Goal: Convert 5 probabilities into ONE sentiment number

Formula: E(X) = Σ(pᵢ × xᵢ)

Where:
- pᵢ = probability of outcome i
- xᵢ = value/weight of outcome i

For sentiment:
  x₁ = -1.0 (1-star)
  x₂ = -0.5 (2-star)
  x₃ =  0.0 (3-star)
  x₄ = +0.5 (4-star)
  x₅ = +1.0 (5-star)

Calculation:
sentimentScore = Σ(pᵢ × xᵢ)
               = (0.02 × -1.0) + (0.05 × -0.5) + (0.10 × 0.0) 
                 + (0.45 × 0.5) + (0.38 × 1.0)
               = -0.02 - 0.025 + 0 + 0.225 + 0.38
               = 0.558

Result: 0.558 ∈ [-1, +1] (normalized sentiment score)
```

### 1.3 Confidence Calculation
```
Definition: Confidence = Maximum probability value

Confidence = max(pᵢ) = max([0.02, 0.05, 0.10, 0.45, 0.38])
           = 0.45

Interpretation:
- How sure is the model about its prediction?
- 45% confidence = Model is moderately sure (not highly certain)
- 90% confidence = Model is very sure
- 25% confidence = Model is uncertain/confused
```

---

## 2. Weighted Averaging & Aggregation

### 2.1 Effective Score Calculation
```
Goal: Combine sentiment, confidence, and relevance into one score

Formula: effectiveScore = sentimentScore × confidence × relevanceWeight

Components:
1. sentimentScore ∈ [-1, +1]
   - From BERT analysis
   - -1 = very negative, +1 = very positive

2. confidence ∈ [0, +1]
   - From BERT's max probability
   - 0 = uncertain, 1 = certain

3. relevanceWeight ∈ [0, +1]
   - Based on entity mention type
   - 1.0 = direct candidate mention
   - 0.85 = constituency mention
   - 0.70 = party mention
   - 0.50 = state mention

Example Calculation:
Article: "Siddaramaiah announces project in Bangalore"
- sentimentScore = 0.75 (positive)
- confidence = 0.85 (quite confident)
- relevanceWeight = 1.0 (direct candidate mention)

effectiveScore = 0.75 × 0.85 × 1.0 = 0.6375

Interpretation: This article contributes 63.75% of its full sentiment value
               to the pulse because it's highly confident and directly relevant
```

### 2.2 Weighted Pulse Calculation
```
Goal: Calculate average sentiment over N days

Formula: 
pulseRaw = (Σ effectiveScoreᵢ) / n

Where:
- effectiveScoreᵢ = sentimentScore × confidence × relevanceWeight for article i
- n = number of articles/signals

Example (7-day window, 8 articles):

Article 1: effectiveScore = 0.75 × 0.85 × 1.0 = 0.6375
Article 2: effectiveScore = 0.68 × 0.82 × 0.7 = 0.3903
Article 3: effectiveScore = -0.60 × 0.90 × 0.5 = -0.27
Article 4: effectiveScore = 0.10 × 0.55 × 0.5 = 0.0275
Article 5: effectiveScore = 0.72 × 0.88 × 1.0 = 0.6336
Article 6: effectiveScore = 0.80 × 0.91 × 1.0 = 0.728
Article 7: effectiveScore = -0.40 × 0.75 × 0.85 = -0.255
Article 8: effectiveScore = 0.05 × 0.52 × 0.5 = 0.013

pulseRaw = (0.6375 + 0.3903 + (-0.27) + 0.0275 + 0.6336 + 0.728 
           + (-0.255) + 0.013) / 8
         = 2.1448 / 8
         = 0.2681

Range: pulseRaw ∈ [-1, +1]
Interpretation: 26.81% towards positive (slightly positive bias)
```

### 2.3 Properties of Weighted Average
```
Mathematical Properties:

1. Linear Combination
   Result is always within the range of inputs:
   min(effectiveScores) ≤ pulseRaw ≤ max(effectiveScores)

2. Balance Point
   If equal positive and negative signals:
   pulseRaw ≈ 0.0 (neutral)

3. Dominance
   Large positive/negative signals pull average in that direction:
   If 1 very positive (0.8) + 7 neutral (0.0):
   Average = 0.1 (slightly positive)

4. Noise Reduction
   More articles = more stable pulse (less affected by outliers)
   8 articles better than 1 article
   100 articles better than 10 articles
```

---

## 3. Range Normalization & Linear Transformation

### 3.1 Min-Max Normalization
```
Goal: Map raw pulse from [-1, +1] to [0, 1]

Formula: 
normalized = (raw - min) / (max - min)

For our case:
- min = -1.0
- max = +1.0

Simplified:
normalized = (raw - (-1.0)) / (+1.0 - (-1.0))
           = (raw + 1.0) / (2.0)
           = (raw + 1.0) / 2.0

This is a LINEAR TRANSFORMATION (affine transformation):
y = ax + b where a = 1/2, b = 1/2
```

### 3.2 Transformation Examples
```
Raw Value  →  Normalized Value
-1.0       →  (-1.0 + 1.0) / 2.0 = 0.0 / 2.0 = 0.00
-0.5       →  (-0.5 + 1.0) / 2.0 = 0.5 / 2.0 = 0.25
 0.0       →  ( 0.0 + 1.0) / 2.0 = 1.0 / 2.0 = 0.50
+0.2681    →  (+0.2681 + 1.0) / 2.0 = 1.2681 / 2.0 = 0.6341
+0.5       →  ( 0.5 + 1.0) / 2.0 = 1.5 / 2.0 = 0.75
+1.0       →  ( 1.0 + 1.0) / 2.0 = 2.0 / 2.0 = 1.00

Mapping visualization:
Raw:        -1.0    -0.5    0.0    +0.5    +1.0
            |-------|-------|-------|-------|
Normalized:  0.0    0.25   0.50   0.75    1.0
            |-------|-------|-------|-------|
Display:    0%      25%    50%    75%    100%
```

### 3.3 Mathematical Properties
```
1. Linearity
   If x₁ < x₂ then f(x₁) < f(x₂)
   (Ordering preserved)

2. Equal Spacing
   f(-1.0) = 0.0
   f(-0.5) = 0.25
   f( 0.0) = 0.50
   f(+0.5) = 0.75
   f(+1.0) = 1.00
   
   Differences are constant: 0.25 each
   (No distortion of scale)

3. Reversibility
   Can recover original: raw = (2.0 × normalized) - 1.0
   
   Example:
   normalized = 0.6341
   raw = (2.0 × 0.6341) - 1.0
       = 1.2682 - 1.0
       = 0.2682 ✓ (matches original 0.2681, within rounding)
```

---

## 4. Trend Detection & Time-Series Analysis

### 4.1 Trend Calculation
```
Goal: Determine if sentiment is RISING, STABLE, or DECLINING

Formula:
delta = |recentPulse - baselinePulse|

Threshold:
SPIKE_THRESHOLD = 0.15 (15% change minimum)

Logic:
IF delta > SPIKE_THRESHOLD:
   IF recentPulse > baselinePulse:
      trend = "RISING"
   ELSE:
      trend = "DECLINING"
ELSE:
   trend = "STABLE"

Example:
recentPulse (last 2 days) = 0.68
baselinePulse (7 days) = 0.63
delta = |0.68 - 0.63| = 0.05

0.05 < 0.15 → trend = "STABLE"

Example 2:
recentPulse = 0.75
baselinePulse = 0.55
delta = 0.20

0.20 > 0.15 AND 0.75 > 0.55 → trend = "RISING"
```

### 4.2 Trend Strength
```
Weak trend: delta ∈ [0.15, 0.25]
Medium trend: delta ∈ [0.25, 0.40]
Strong trend: delta > 0.40

Example:
delta = 0.20 → "Weak rising trend"
delta = 0.30 → "Medium rising trend"
delta = 0.50 → "Strong rising trend"

Can use delta as trend strength metric:
trend_strength = min(delta / 0.40, 1.0)  // normalized to [0, 1]

0.20 / 0.40 = 0.50 (50% strong)
0.40 / 0.40 = 1.00 (100% strong)
0.60 / 0.40 = 1.00 (capped at 100%)
```

---

## 5. Confidence Weighting Strategy

### 5.1 Multiplication Property
```
Formula: effectiveScore = sentimentScore × confidence × relevanceWeight

Property: As confidence decreases, impact decreases proportionally

Examples:
Score = 0.75, Confidence = 0.90 → 0.75 × 0.90 = 0.675 (90% of full impact)
Score = 0.75, Confidence = 0.60 → 0.75 × 0.60 = 0.450 (60% of full impact)
Score = 0.75, Confidence = 0.30 → 0.75 × 0.30 = 0.225 (30% of full impact)
Score = 0.75, Confidence = 0.00 → 0.75 × 0.00 = 0.000 (0% of full impact)

This is mathematically correct because:
- Confidence ∈ [0, 1] acts as a scaling factor
- Low confidence → low scaling → low impact
- High confidence → high scaling → high impact
```

### 5.2 Why Not Add Instead of Multiply?
```
If we added (sentimentScore + confidence):

Example: 0.75 + 0.90 = 1.65
Problem 1: Exceeds [-1, +1] range!
Problem 2: Unintuitive: high confidence increases the value artificially

Correct multiplication: 0.75 × 0.90 = 0.675
Benefit 1: Stays within [-1, +1] range
Benefit 2: Acts as "reliability discount"
Benefit 3: Mathematically standard (probability theory)
```

---

## 6. Alert Detection Thresholds

### 6.1 Sentiment Spike Alert
```
Formula: delta = |recentAvg - baselineAvg|

Trigger: delta ≥ 0.35 AND count(articles) ≥ 3

Example:
Yesterday's pulse = 0.50
Today's pulse = 0.87
Delta = 0.37

0.37 ≥ 0.35 ✓ AND 3+ articles today ✓ → Alert triggered!

Alert message: "🚨 Sentiment positive spike detected! Change: +0.37"
```

### 6.2 Negative Surge Alert
```
Formula: count(articles with sentiment=NEGATIVE AND confidence ≥ 0.80 in last 24h)

Trigger: count ≥ 3

Example:
Found articles:
1. NEGATIVE, confidence = 0.85 ✓
2. NEGATIVE, confidence = 0.82 ✓
3. NEGATIVE, confidence = 0.88 ✓
4. POSITIVE, confidence = 0.75 ✗

Count = 3 ≥ 3 → Alert triggered!

Alert message: "⚠️ Negative coverage surge: 3 high-confidence negative articles"
```

### 6.3 High-Impact Hit Alert
```
Formula: Find article where sentiment=NEGATIVE AND score ≤ -0.70 AND confidence ≥ 0.90

Trigger: Any single article matching ALL criteria

Example:
Article: "Corruption charges filed against candidate"
- sentiment = NEGATIVE ✓
- score = -0.85 ≤ -0.70 ✓
- confidence = 0.92 ≥ 0.90 ✓

All criteria met → Alert triggered!

Alert message: "🔴 Breaking: High-confidence negative article - 
               'Corruption charges filed' (confidence: 0.92)"
```

---

## 7. Relevance Weight Distribution

### 7.1 Weight Function
```
For direct mentions (candidate, party, etc.):
weight = 1.0

For geographic mentions:
├─ By primary constituency: weight = 0.85
├─ By district: weight = 0.70
├─ By state: weight = 0.50
└─ By other state: weight = 0.15

For cross-entity:
├─ Same party as candidate: weight = 0.70
└─ Different party: weight = 0.40

Constraints:
- weight ∈ [0, 1]
- weight ≤ 1.0 (never amplifies)
- weight > 0 (nothing completely ignored)
```

### 7.2 Cumulative Weight Example
```
Single article mentions multiple entities:
"Siddaramaiah (candidate) launches scheme in Bangalore (constituency) 
 under Congress (party)"

Creates signals with weights:
├─ For Siddaramaiah pulse: weight = 1.0
├─ For Bangalore pulse: weight = 0.85
└─ For Congress pulse: weight = 0.70

Each signal gets independent weight - no normalization needed.
Candidate pulse gets full value, others get less.
```

---

## 8. Summary of Mathematical Operations

| Operation | Formula | Input Range | Output Range | Purpose |
|-----------|---------|-------------|--------------|---------|
| Expected Value | E(X) = Σ(pᵢ × xᵢ) | [0, 1] × [-1, 1] | [-1, 1] | Sentiment score |
| Weighted Avg | avg(effectiveScores) | [-1, 1] | [-1, 1] | Pulse raw |
| Normalization | (x + 1) / 2 | [-1, 1] | [0, 1] | Display 0-100% |
| Trend | \|recent - baseline\| | [0, 2] | [0, 2] | Change magnitude |
| Confidence | max(probabilities) | [0, 1] | [0, 1] | Model certainty |
| Weighting | score × conf × relev | [-1, 1] | [-1, 1] | Impact factor |

---

## 9. Statistical Interpretation

### 9.1 Pulse Score as Percentile
```
Normalized pulse ∈ [0, 1] can be interpreted as:

P(sentiment > pulse) = normalized_pulse

Example:
pulse = 0.634
Interpretation: 63.4% of sentiment spectrum is "positive"
                36.6% of spectrum is "negative/neutral"

This is NOT: "63.4% of articles are positive"
This IS: "The overall sentiment leans 63.4% towards positive"
```

### 9.2 Confidence as Reliability
```
Confidence ∈ [0, 1] represents model reliability

High confidence (0.85+):
├─ Model has clear opinion
├─ Probabilities are sharp
└─ Trust the prediction fully

Medium confidence (0.50-0.85):
├─ Model is somewhat sure
├─ Probabilities are moderately distributed
└─ Trust with caution

Low confidence (<0.50):
├─ Model is uncertain
├─ Probabilities are diffuse
└─ Discount heavily or exclude

Example distribution:
[0.20, 0.20, 0.25, 0.20, 0.15] → max = 0.25 (very uncertain)
[0.01, 0.02, 0.05, 0.50, 0.42] → max = 0.50 (fairly certain)
[0.01, 0.02, 0.02, 0.10, 0.85] → max = 0.85 (very certain)
```

---

## References

1. Expected Value: E[X] = ∫ x f(x) dx
2. Min-Max Normalization: Linear transformation y = ax + b
3. Weighted Average: Σ(wᵢ × xᵢ) / Σ(wᵢ) when weights are normalized
4. Confidence: Maximum of probability distribution
5. Trend Detection: Change point detection in time series
