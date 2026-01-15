# PoliticAI Backend - Complete API Reference for Fixed Issues

## 📋 Overview
This document provides the complete API reference for all the issues that were fixed and new features implemented.

---

## 🔧 Fixed Issues

### 1. ✅ Subscribed Constituencies Endpoint - FIXED

**Endpoint:** `GET /api/v1/constituencies/subscribed`

**Query Parameters:**
- `userId` (required) - The user ID

**Response:**
```json
[
  {
    "id": 1,
    "name": "Shivamogga",
    "number": "AC001"
  },
  {
    "id": 2,
    "name": "Shimoga Rural",
    "number": "AC002"
  }
]
```

**Error Handling:**
- Returns `[]` if user has no subscription
- Returns `500` with error details if database error occurs
- Logs all operations for debugging

**Example:**
```bash
curl http://localhost:3000/api/v1/constituencies/subscribed?userId=1
```

---

### 2. ✅ Get Opponents from Last Election - NEW

**Endpoint:** `GET /api/v1/constituencies/opponents`

**Query Parameters:**
- `constituencyId` (required) - The constituency ID

**Response:**
```json
[
  {
    "id": 123,
    "name": "Siddaramaiah",
    "party": "INC",
    "partyColor": "#00AAFF",
    "votes": 85432,
    "age": 75,
    "gender": "Male"
  },
  {
    "id": 124,
    "name": "B.Y. Raghavendra",
    "party": "BJP",
    "partyColor": "#FF9933",
    "votes": 78901,
    "age": 45,
    "gender": "Male"
  }
]
```

**Logic:**
1. Finds the latest election for the constituency
2. Returns all candidates who contested
3. Ordered by votes (descending) - winner first

**Example:**
```bash
curl http://localhost:3000/api/v1/constituencies/opponents?constituencyId=1
```

---

### 3. ✅ Dashboard Summary with Vote Share Swing - FIXED

**Endpoint:** `GET /api/v1/dashboard/summary`

**Query Parameters:**
- `electionId` (optional) - Defaults to latest election

**Response:**
```json
{
  "totalConstituencies": 224,
  "totalElectors": 45000000,
  "avgTurnout": 72.35,
  "leadingPartySeats": 136,
  "leadingParty": "INC",
  "oppositionPartySeats": 66,
  "oppositionParty": "BJP",
  "majority": 113,
  "swing": "+5.23% Vote Share"
}
```

**Swing Calculation:**
- **OLD:** Showed seat change (e.g., "+55 Seats")
- **NEW:** Shows vote share change (e.g., "+5.23% Vote Share")
- Compares current election's average vote share vs previous election
- Positive = party gained vote share, Negative = party lost vote share

**Example:**
```bash
curl http://localhost:3000/api/v1/dashboard/summary?electionId=3
```

---

## 🆕 New Settings Endpoints

### 4. ✅ Get Candidate Settings

**Endpoint:** `GET /api/v1/settings`

**Query Parameters:**
- `candidateId` (required) - The candidate ID

**Response:**
```json
{
  "candidateId": 123,
  "candidateName": "Siddaramaiah",
  "constituency": {
    "id": 1,
    "name": "Varuna",
    "code": "AC175"
  },
  "party": {
    "id": 1,
    "name": "INC",
    "symbol": "Hand"
  },
  "profilePhotoPath": "/uploads/candidates/123/profile.jpg",
  "profileTextPath": "/uploads/candidates/123/bio.txt",
  "opponent": {
    "id": 124,
    "name": "B.Y. Raghavendra",
    "party": "BJP",
    "profilePhotoPath": "/uploads/opponents/124/profile.jpg",
    "profileTextPath": "/uploads/opponents/124/bio.txt"
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/v1/settings?candidateId=123
```

---

### 5. ✅ Update Selected Opponent

**Endpoint:** `PATCH /api/v1/settings/opponent`

**Request Body:**
```json
{
  "candidateId": 123,
  "opponentId": 124
}
```

**Response:**
```json
{
  "success": true,
  "opponentId": 124
}
```

**What Happens:**
1. Updates `CandidateProfile.opponentId` to link the opponent
2. Fetches the candidate's current monitoring priority
3. Updates the opponent's `EntityMonitoring` entry to match the same priority
4. Sets reason as `SELECTED_OPPONENT`

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/v1/settings/opponent \
  -H "Content-Type: application/json" \
  -d '{"candidateId": 123, "opponentId": 124}'
```

---

### 6. ✅ Update Profile Photo

**Endpoint:** `PATCH /api/v1/settings/profile-photo`

**Request Body:**
```json
{
  "candidateId": 123,
  "photoPath": "/uploads/candidates/123/profile.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "photoPath": "/uploads/candidates/123/profile.jpg"
}
```

**Note:** This endpoint expects the photo to already be uploaded to storage (S3/local). You need to handle the file upload separately.

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/v1/settings/profile-photo \
  -H "Content-Type: application/json" \
  -d '{"candidateId": 123, "photoPath": "/uploads/candidates/123/profile.jpg"}'
```

---

### 7. ✅ Update Profile Text/Bio

**Endpoint:** `PATCH /api/v1/settings/profile-text`

**Request Body:**
```json
{
  "candidateId": 123,
  "textPath": "/uploads/candidates/123/bio.txt"
}
```

**Response:**
```json
{
  "success": true,
  "textPath": "/uploads/candidates/123/bio.txt"
}
```

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/v1/settings/profile-text \
  -H "Content-Type: application/json" \
  -d '{"candidateId": 123, "textPath": "/uploads/candidates/123/bio.txt"}'
```

---

### 8. ✅ Update Opponent Profile Photo

**Endpoint:** `PATCH /api/v1/settings/opponent-photo`

**Request Body:**
```json
{
  "candidateId": 123,
  "photoPath": "/uploads/opponents/124/profile.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "photoPath": "/uploads/opponents/124/profile.jpg"
}
```

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/v1/settings/opponent-photo \
  -H "Content-Type: application/json" \
  -d '{"candidateId": 123, "photoPath": "/uploads/opponents/124/profile.jpg"}'
```

---

### 9. ✅ Update Opponent Profile Text

**Endpoint:** `PATCH /api/v1/settings/opponent-text`

**Request Body:**
```json
{
  "candidateId": 123,
  "textPath": "/uploads/opponents/124/bio.txt"
}
```

**Response:**
```json
{
  "success": true,
  "textPath": "/uploads/opponents/124/bio.txt"
}
```

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/v1/settings/opponent-text \
  -H "Content-Type: application/json" \
  -d '{"candidateId": 123, "textPath": "/uploads/opponents/124/bio.txt"}'
```

---

## 📊 Map Data Metrics

### 10. ✅ Get Map Data

**Endpoint:** `GET /api/v1/constituencies/map-data`

**Query Parameters:**
- `electionId` (optional) - Defaults to latest election
- `metric` (optional) - One of: `turnout`, `margin`, `controversy`, `youth`
- `level` (optional) - One of: `CONSTITUENCY`, `DISTRICT` (default: `CONSTITUENCY`)

**Response:**
```json
[
  {
    "constituencyId": 1,
    "name": "Shivamogga",
    "code": "AC001",
    "turnout": 72.5,
    "electors": 185000,
    "seats": 1,
    "winner": "INC",
    "margin": 8500,
    "color": "#00AAFF",
    "youth": 32.5,
    "controversy": 0.45
  }
]
```

**Metrics Explained:**

#### A. Turnout Gap (`metric=turnout`)
- **What:** Voter turnout percentage per constituency/district
- **Calculation:** `(totalVotesCast / totalElectors) * 100`
- **Source:** `GeoElectionSummary.turnoutPercent`
- **Use Case:** Identify areas with low voter participation

#### B. Margin Heat (`metric=margin`)
- **What:** Victory margin between winner and runner-up
- **Calculation:** `winningVotes - runnerUpVotes`
- **Source:** `ConstituencyMarginSummary.marginVotes`
- **Use Case:** Identify swing constituencies
- **Color Coding:**
  - 🔴 Red (Hot) = Low margin (< 5000) - Swing seat
  - 🟡 Yellow = Medium margin (5000-15000)
  - 🟢 Green (Cool) = High margin (> 15000) - Safe seat

#### C. Controversy Density (`metric=controversy`)
- **What:** Concentration of controversial news/sentiment
- **Current:** Mock data (0.00 to 1.00)
- **Future:** Count of negative sentiment signals with confidence > 0.7 in last 30 days
- **Use Case:** Identify areas with high negative sentiment

#### D. Youth Share (`metric=youth`)
- **What:** Percentage of young voters (18-35)
- **Current:** Mock data
- **Future:** Requires demographic data integration
- **Use Case:** Target youth-focused campaigns

**Example:**
```bash
# Get turnout data for all constituencies
curl http://localhost:3000/api/v1/constituencies/map-data?electionId=3&metric=turnout

# Get margin heat at district level
curl http://localhost:3000/api/v1/constituencies/map-data?electionId=3&metric=margin&level=DISTRICT
```

---

## 🔄 Frontend Integration Examples

### React/TypeScript Example

```typescript
// Fetch opponents for dropdown
const fetchOpponents = async (constituencyId: number) => {
  const response = await fetch(
    `/api/v1/constituencies/opponents?constituencyId=${constituencyId}`
  );
  const opponents = await response.json();
  return opponents;
};

// Update selected opponent
const updateOpponent = async (candidateId: number, opponentId: number) => {
  const response = await fetch('/api/v1/settings/opponent', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateId, opponentId })
  });
  return response.json();
};

// Upload and update profile photo
const updateProfilePhoto = async (candidateId: number, file: File) => {
  // 1. Upload file to storage (S3/local)
  const formData = new FormData();
  formData.append('file', file);
  const uploadResponse = await fetch('/api/v1/upload', {
    method: 'POST',
    body: formData
  });
  const { path } = await uploadResponse.json();

  // 2. Update profile photo path in database
  const response = await fetch('/api/v1/settings/profile-photo', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateId, photoPath: path })
  });
  return response.json();
};

// Get candidate settings
const getSettings = async (candidateId: number) => {
  const response = await fetch(
    `/api/v1/settings?candidateId=${candidateId}`
  );
  return response.json();
};
```

---

## 🗄️ Database Schema Changes

### CandidateProfile Model - New Fields

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

**Migration Applied:** `20260115080302_add_profile_photo_paths`

---

## 🧪 Testing Checklist

- [ ] Test `/constituencies/subscribed` with valid userId
- [ ] Test `/constituencies/subscribed` with userId that has no subscription
- [ ] Test `/constituencies/opponents` with valid constituencyId
- [ ] Test `/dashboard/summary` and verify swing shows vote share
- [ ] Test `/settings` to get candidate settings
- [ ] Test `/settings/opponent` to update opponent
- [ ] Test `/settings/profile-photo` to update photo path
- [ ] Test `/settings/profile-text` to update bio path
- [ ] Test `/settings/opponent-photo` to update opponent photo
- [ ] Test `/settings/opponent-text` to update opponent bio
- [ ] Verify opponent priority is synced when selected
- [ ] Test map data with different metrics
- [ ] Create new candidate user and verify subscriptionId is set

---

## 🚀 Deployment Steps

1. **Pull latest code**
2. **Run migration:** Already applied `20260115080302_add_profile_photo_paths`
3. **Restart server:** `npm run start:dev`
4. **Test endpoints** using the examples above
5. **Update frontend** to use new endpoints

---

## ❓ Questions & Clarifications Needed

1. **File Upload:** How are you handling file uploads? S3? Local storage? I can help integrate.
2. **District Details API:** Do you want me to implement `/api/v1/constituencies/district-details`?
3. **Controversy Calculation:** Implement actual sentiment-based calculation or keep mock data?
4. **Authentication:** Should settings endpoints require authentication/authorization?

---

## 📞 Support

If you encounter any issues or need clarification on any endpoint, please let me know!
