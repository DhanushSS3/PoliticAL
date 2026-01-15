# PoliticAI Backend - Issues Fixed & Implementation Guide

## Issues Addressed

### 1. ✅ 500 Error on `/api/v1/constituencies/subscribed?userId=usr_candidate_001`

**Problem:** The endpoint was throwing a 500 Internal Server Error when fetching subscribed constituencies.

**Root Cause:** Missing error handling and potential null reference issues in the query chain.

**Fix Applied:**
- Added comprehensive try-catch error handling in `constituencies.service.ts`
- Added logging for debugging
- Added null checks for subscription
- Returns empty array gracefully when no subscription exists

**File Modified:** `backend/src/modules/dashboard/constituencies.service.ts`

---

### 2. ✅ CandidateProfile `subscriptionId` Not Being Written

**Problem:** When creating a candidate user, the `subscriptionId` field in `CandidateProfile` was not being populated.

**Root Cause:** The `activateMonitoring` method in `MonitoringManagerService` was not fetching and linking the user's subscription.

**Fix Applied:**
- Modified `activateMonitoring` to fetch the user's subscription
- Added `subscriptionId` to the update data when marking candidate as subscribed

**File Modified:** `backend/src/modules/analytics/services/monitoring-manager.service.ts`

```typescript
// Fetch the user's subscription to link it
const subscription = userId ? await this.prisma.subscription.findUnique({
    where: { userId }
}) : null;

await this.prisma.candidateProfile.update({
    where: { candidateId },
    data: {
        isSubscribed: true,
        userId,
        subscriptionId: subscription?.id,  // ← Now properly set
        monitoringStartedAt: new Date(),
    },
});
```

---

### 3. ✅ Schema Updated for Profile Photos and Opponent Data

**Problem:** The schema didn't have fields to store:
- User's own profile photo path
- User's profile text/bio path
- Selected opponent's profile photo path
- Selected opponent's profile text path

**Fix Applied:**
- Added 4 new fields to `CandidateProfile` model in schema.prisma:
  - `profilePhotoPath` - Path to candidate's own profile photo
  - `profileTextPath` - Path to candidate's profile text/bio
  - `opponentProfilePhotoPath` - Path to selected opponent's profile photo
  - `opponentProfileTextPath` - Path to selected opponent's profile text
- Removed duplicate `candidateProfile` relation in User model

**File Modified:** `backend/prisma/schema.prisma`

**Migration Required:** Run `npx prisma migrate dev --name add_profile_photo_paths`

---

### 4. ✅ API to Fetch Opponents from Last Election

**Problem:** Frontend settings section needs to populate a dropdown with opponents from the last election for the user's constituency.

**Solution Implemented:**

**New Endpoint:** `GET /api/v1/constituencies/opponents?constituencyId={id}`

**Response Format:**
```json
[
  {
    "id": 123,
    "name": "Candidate Name",
    "party": "BJP",
    "partyColor": "#FF9933",
    "votes": 85432,
    "age": 45,
    "gender": "Male"
  },
  ...
]
```

**Logic:**
1. Fetches the latest election for the given constituency
2. Returns all candidates who contested in that election
3. Ordered by votes (descending) - winner first

**Files Modified:**
- `backend/src/modules/dashboard/constituencies.service.ts` - Added `getOpponents()` method
- `backend/src/modules/dashboard/constituencies.controller.ts` - Added endpoint

---

### 5. ✅ Opponent Selection Updates Priority

**Problem:** When a user selects an opponent in settings, that opponent's monitoring priority should match the user's priority.

**Solution Implemented:**

**New Service:** `CandidateSettingsService`

**Key Methods:**
- `updateOpponent(candidateId, opponentId)` - Updates selected opponent and syncs priority
- `updateProfilePhoto(candidateId, photoPath)` - Updates candidate's profile photo
- `updateProfileText(candidateId, textPath)` - Updates candidate's profile text
- `updateOpponentProfilePhoto(candidateId, photoPath)` - Updates opponent's photo
- `updateOpponentProfileText(candidateId, textPath)` - Updates opponent's text
- `getSettings(candidateId)` - Retrieves all settings for a candidate

**Priority Sync Logic:**
When an opponent is selected, the service:
1. Updates `CandidateProfile.opponentId`
2. Fetches the candidate's current monitoring priority from `EntityMonitoring`
3. Creates/updates the opponent's `EntityMonitoring` entry with the same priority
4. Sets reason as `SELECTED_OPPONENT`

**File Created:** `backend/src/modules/dashboard/candidate-settings.service.ts`

**Usage Example:**
```typescript
// Update opponent
await candidateSettingsService.updateOpponent(candidateId, opponentId);

// This automatically:
// 1. Links opponent to candidate profile
// 2. Sets opponent's monitoring priority = candidate's priority
```

---

### 6. ✅ Swing Calculation - Vote Share Instead of Seats

**Problem:** The dashboard summary API was showing swing as seat change (e.g., "+55 Seats"), but the requirement is to show vote share change from the last election.

**Fix Applied:**
- Changed swing calculation to compute vote share percentage change
- Compares current election's average vote share vs previous election's average vote share
- Format: `"+5.23% Vote Share"` or `"-2.15% Vote Share"`

**File Modified:** `backend/src/modules/dashboard/dashboard.service.ts`

**New Logic:**
```typescript
// Get current vote share for winning party
const currentVoteShare = await this.prisma.partyVoteSummary.aggregate({
    where: {
        partyId: leadingParty.partyId,
        summary: {
            electionId: targetElectionId,
            geoUnit: { level: 'CONSTITUENCY' }
        }
    },
    _avg: { voteSharePercent: true }
});

// Get previous vote share
const previousVoteShare = await this.prisma.partyVoteSummary.aggregate({
    where: {
        partyId: leadingParty.partyId,
        summary: {
            electionId: previousElection.id,
            geoUnit: { level: 'CONSTITUENCY' }
        }
    },
    _avg: { voteSharePercent: true }
});

const diff = currentShare - previousShare;
swing = `${sign}${diff.toFixed(2)}% Vote Share`;
```

---

### 7. 📝 Map Data Metrics Explanation

**Endpoint:** `GET /api/v1/constituencies/map-data?electionId={id}&metric={metric}&level={level}`

**Supported Metrics:**

#### A. **Turnout Gap** (`metric=turnout`)
- **What it shows:** Voter turnout percentage per constituency/district
- **Calculation:** `(totalVotesCast / totalElectors) * 100`
- **Data Source:** `GeoElectionSummary.turnoutPercent`
- **Use Case:** Identify areas with low voter participation
- **Response Field:** `turnout` (percentage)

#### B. **Margin Heat** (`metric=margin`)
- **What it shows:** Victory margin between winner and runner-up
- **Calculation:** `winningVotes - runnerUpVotes`
- **Data Source:** `ConstituencyMarginSummary.marginVotes`
- **Use Case:** Identify swing constituencies (low margin = competitive)
- **Response Field:** `margin` (absolute vote count)
- **Color Coding:** 
  - Red (Hot) = Low margin (< 5000 votes) - Swing seat
  - Yellow = Medium margin (5000-15000)
  - Green (Cool) = High margin (> 15000) - Safe seat

#### C. **Controversy Density** (`metric=controversy`)
- **What it shows:** Concentration of controversial news/sentiment in the area
- **Calculation:** Currently using mock data based on constituency ID
- **Future Implementation:** 
  ```sql
  SELECT COUNT(*) 
  FROM SentimentSignal 
  WHERE geoUnitId = ? 
    AND sentiment = 'NEGATIVE' 
    AND confidence > 0.7
    AND createdAt > NOW() - INTERVAL 30 DAYS
  ```
- **Response Field:** `controversy` (0.00 to 1.00)
- **Use Case:** Identify areas with high negative sentiment or controversies

#### D. **Youth Share** (`metric=youth`)
- **What it shows:** Percentage of young voters (18-35) in the constituency
- **Calculation:** Currently using mock data
- **Future Implementation:** Requires demographic data integration
- **Response Field:** `youth` (percentage)

**Current Implementation:**
The `getMapData` method in `constituencies.service.ts` currently returns mock data for `controversy` and `youth` metrics. The actual implementation would require:
1. Sentiment analysis aggregation for controversy
2. Demographic data integration for youth share

---

### 8. ❓ District Details API

**Endpoint:** `GET /api/v1/constituencies/district-details?district=Shivamogga&electionId=3`

**Status:** This endpoint does not currently exist in the codebase.

**Recommended Implementation:**
```typescript
async getDistrictDetails(districtName: string, electionId: number) {
    // Find district by name
    const district = await this.prisma.geoUnit.findFirst({
        where: {
            name: districtName,
            level: 'DISTRICT'
        }
    });

    if (!district) return null;

    // Get all constituencies in this district
    const constituencies = await this.prisma.geoUnit.findMany({
        where: {
            parentId: district.id,
            level: 'CONSTITUENCY'
        }
    });

    // Get election summaries for all constituencies
    const summaries = await this.prisma.geoElectionSummary.findMany({
        where: {
            electionId,
            geoUnitId: { in: constituencies.map(c => c.id) }
        },
        include: {
            partyResults: {
                include: { party: true }
            }
        }
    });

    // Aggregate district-level stats
    return {
        districtId: district.id,
        districtName: district.name,
        totalConstituencies: constituencies.length,
        totalElectors: summaries.reduce((sum, s) => sum + s.totalElectors, 0),
        totalVotes: summaries.reduce((sum, s) => sum + s.totalVotesCast, 0),
        avgTurnout: /* calculate average */,
        partyWiseSeats: /* aggregate seats by party */,
        constituencies: summaries.map(/* format each constituency */)
    };
}
```

---

## Next Steps

### 1. Run Database Migration
```bash
cd backend
npx prisma migrate dev --name add_profile_photo_paths
```

### 2. Rebuild and Restart Server
```bash
npm run build
npm run start:dev
```

### 3. Test Fixed Endpoints

**Test 1: Subscribed Constituencies**
```bash
curl http://localhost:3000/api/v1/constituencies/subscribed?userId=1
```

**Test 2: Get Opponents**
```bash
curl http://localhost:3000/api/v1/constituencies/opponents?constituencyId=1
```

**Test 3: Dashboard Summary (with new swing calculation)**
```bash
curl http://localhost:3000/api/v1/dashboard/summary?electionId=3
```

### 4. Frontend Integration

**Settings Page - Opponent Selection:**
```typescript
// Fetch opponents for dropdown
const opponents = await fetch(`/api/v1/constituencies/opponents?constituencyId=${constituencyId}`);

// Update selected opponent
await fetch(`/api/v1/settings/opponent`, {
    method: 'PATCH',
    body: JSON.stringify({ candidateId, opponentId })
});
```

**Settings Page - Profile Photo Upload:**
```typescript
// Upload photo to storage (S3/local)
const photoPath = await uploadPhoto(file);

// Update profile photo path
await fetch(`/api/v1/settings/profile-photo`, {
    method: 'PATCH',
    body: JSON.stringify({ candidateId, photoPath })
});
```

---

## Schema Changes Summary

```prisma
model CandidateProfile {
  // ... existing fields ...
  
  // ✨ NEW FIELDS
  profilePhotoPath         String?  // Candidate's own photo
  profileTextPath          String?  // Candidate's bio/text
  opponentProfilePhotoPath String?  // Selected opponent's photo
  opponentProfileTextPath  String?  // Selected opponent's text
  
  // ... rest of model ...
}
```

---

## API Endpoints Summary

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/v1/constituencies/subscribed` | GET | Get user's subscribed constituencies | ✅ Fixed |
| `/api/v1/constituencies/opponents` | GET | Get opponents from last election | ✅ New |
| `/api/v1/dashboard/summary` | GET | Dashboard summary with vote share swing | ✅ Fixed |
| `/api/v1/constituencies/map-data` | GET | Map visualization data | ✅ Documented |
| `/api/v1/constituencies/district-details` | GET | District-level aggregation | ❌ Not Implemented |

---

## Files Modified

1. ✅ `backend/prisma/schema.prisma` - Added profile photo fields
2. ✅ `backend/src/modules/dashboard/constituencies.service.ts` - Fixed getSubscribed, added getOpponents
3. ✅ `backend/src/modules/dashboard/constituencies.controller.ts` - Added opponents endpoint
4. ✅ `backend/src/modules/analytics/services/monitoring-manager.service.ts` - Fixed subscriptionId
5. ✅ `backend/src/modules/dashboard/dashboard.service.ts` - Fixed swing calculation
6. ✅ `backend/src/modules/dashboard/candidate-settings.service.ts` - New service for settings

---

## Testing Checklist

- [ ] Run database migration
- [ ] Test `/constituencies/subscribed` endpoint
- [ ] Test `/constituencies/opponents` endpoint
- [ ] Test dashboard summary swing calculation
- [ ] Create candidate user and verify subscriptionId is set
- [ ] Test opponent selection and priority sync
- [ ] Test profile photo upload flow
- [ ] Verify map data returns correct metrics
