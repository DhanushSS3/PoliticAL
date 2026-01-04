# PoliticAI MVP v1 - Project Status Report

**Date:** January 4, 2026
**Status:** Backend Core & Ingestion Pipeline Complete

## 1. Core Architecture & Infrastructure

### Tech Stack
- **Backend**: NestJS (Monolith modular architecture)
- **Database**: PostgreSQL + Prisma ORM
- **Analytics Engine**: Python FastAPI Microservice (Stateless)
- **Communication**: REST (HTTP) between NestJS and Python

### Database Schema (Prisma)
A robust, scalable schema has been implemented supporting:
- **Identity**: Users, Roles (Admin/Subscriber), Sessions, PasswordResetOtp.
- **Geography**: Hierarchical `GeoUnit` (State -> District -> Constituency).
- **Entities**: Parties, Candidates, Elections.
- **News Intelligence**: 
  - `NewsArticle` (with ingestion metadata).
  - `NewsKeyword` (dynamic keyword management).
  - `NewsEntityMention` (many-to-many linking).
- **Analytics**: `SentimentSignal` (traceable to model version), `DailyGeoStats`.

## 2. Authentication & Security

### Features Implemented
- **Standard Auth**: Email/Phone + Password login.
- **Session Management**: Secure, database-backed sessions with device tracking.
- **Password Management**:
  - **Change Password**: Requires current password.
  - **Forgot Password**: Secure email OTP flow (6-digit, 10-min expiry).
  - **Security**: auto-invalidation of sessions on password change.
- **Impersonation**: Admin can impersonate users for support (audit logged).
- **RBAC**: Role-based access control (Admin vs Subscriber).

## 3. News Ingestion Pipeline

### A. Google News Auto-Ingestion
- **Mechanism**: Background job (`NewsIngestionService`).
- **Logic**:
  1. Iterates all active entities (Candidates, Parties, GeoUnits).
  2. Generates dynamic queries via `KeywordManagerService` (e.g., `("Siddaramaiah") AND (election OR policy)`).
  3. Fetches real-time data from Google News RSS.
  4. Deduplicates and stores as `NewsArticle`.
  5. Auto-approves (Status: APPROVED).
  6. Links articles to entities via `NewsEntityMention`.

### B. Manual Ingestion (Admin)
- **Endpoint**: `POST /admin/news`
- **Supported Inputs**:
  - **Text**: Direct text entry.
  - **Link**: URL submission.
  - **File**: PDF/DOCX/TXT upload.
- **File Parsing**: Files are streamed to the Python service for text extraction before storage.

## 4. Analytics & NLP Integration

### Python Microservice (`analysis-service`)
- **Role**: Compute-heavy, stateless engine.
- **Endpoints**:
  - `/analyze/sentiment`: Classification (Positive/Neutral/Negative) + Score + Confidence.
  - `/parse/file`: Extracts text from PDF/DOCX/TXT.
  - `/analyze/entities`: Placeholder for NER (Named Entity Recognition).

### Integration (NestJS)
- **SentimentAnalysisService**: 
  - Acts as the bridge.
  - Asynchronously calls Python service for every new article.
  - Stores results in `SentimentSignal` table linked to the article and GeoUnit.
  - "Fire and forget" design to not block ingestion.

## 5. Current Workflow

1. **Ingest**: 
   - Cron job runs -> fetches Google News -> Saves to DB.
   - OR Admin uploads file -> Text extracted -> Saved to DB.
2. **Tag**: Articles are automatically linked to the relevant Candidate/Party/Region.
3. **Analyze**: 
   - NestJS sends content to Python.
   - Python computes Sentiment & Score.
   - NestJS saves `SentimentSignal`.
4. **Result**: 
   - The database now contains a curated, categorized, and scored stream of political news.

## 6. Next Steps (Immediate)
1. **Read APIs**: Build endpoints for Frontend/App to consume this data (filtered by user's subscription).
2. **Dashboard Logic**: Aggregation of sentiment signals into `DailyGeoStats`.
3. **Scraping**: Add specialized scrapers for local news sites.
