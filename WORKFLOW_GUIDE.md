# 📋 PoliticAI Admin Workflow Guide

This guide details the exact steps to manage users, candidates, and subscriptions.

## 1. Onboarding a "Fresh" Candidate (New Entry)
*Use this when the politician does not exist in the database.*

### Step A: Create the Candidate Entity
**Endpoint**: `POST /api/admin/subscriptions/candidates`
**Description**: Create the database record for the person and their election context.

```json
// Request
{
  "fullName": "Arvind Kejriwal",
  "partyId": 3,
  "constituencyId": 10, // GeoUnit ID
  "age": 55,
  "gender": "MALE"
}

// Response
{
  "success": true,
  "candidate": { "id": 5001, ... },
  "profile": { ... }
}
```
> 📝 **Note**: Write down the `candidate.id` (e.g. `5001`).

### Step B: Create the User Account
**Endpoint**: `POST /api/admin/users`
**Description**: Create the login credentials for the candidate's team.

```json
// Request
{
  "email": "campaign@aap.com",
  "password": "SecurityFirst!",
  "fullName": "Campaign Manager",
  "role": "CANDIDATE"
}

// Response
{
  "user": { "id": 205, ... }
}
```
> 📝 **Note**: Write down the `user.id` (e.g. `205`).

### Step C: Link & Activate Subscription
**Endpoint**: `POST /api/admin/subscriptions/activate`
**Description**: Connect the User to the Candidate and start the AI monitoring engine.

```json
// Request
{
  "candidateId": 5001,
  "userId": 205
}
```
> ✅ **Done!** The system will now automatically:
> 1. Mark profile as subscribed.
> 2. Find and activate all opponents in Constituency #10.
> 3. Generate keywords ("Arvind Kejriwal", "Kejriwal AAP", etc.).
> 4. Begin fetching news immediately.

---

## 2. Onboarding an "Existing" Candidate
*Use this when the politician is already tracked (e.g. an Opponent becoming a Client).*

### Step A: Find Candidate ID
*Search your database or use a listing API to find their ID (e.g. `101`).*

### Step B: Create the User Account
**Endpoint**: `POST /api/admin/users`
*Same as above (creates User `206`).*

### Step C: Link & Activate
**Endpoint**: `POST /api/admin/subscriptions/activate`
```json
{
  "candidateId": 101, // Established database ID
  "userId": 206       // New User ID
}
```

---

## 3. Advanced Features

### Add Custom Keywords to Listen For
*If the candidate has a specific nickname or slogan.*
**Endpoint**: `POST /api/admin/news/keywords`

```json
{
  "entityType": "CANDIDATE",
  "entityId": 5001,
  "keyword": "Muffler Man",
  "priority": 10
}
```

### Subscribe to a Generic Region (Newsroom Mode)
*If a user wants to track a whole state, not a person.*
**Endpoint**: `POST /api/admin/subscriptions/geounit/:id`
*Example: `POST /api/admin/subscriptions/geounit/1` (Karnataka)*

