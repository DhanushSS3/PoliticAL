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
- **Identity**: Users, Roles (Admin/Subscriber), Sessions, PasswordResetOtp.
- **Geography**: Hierarchical `GeoUnit`.
- **Entities**: Parties, Candidates, Elections.
- **News Intelligence**: `NewsArticle`, `NewsKeyword`, `NewsEntityMention`.
- **Analytics**: `SentimentSignal`, `DailyGeoStats`.

## 2. Authentication & Security
- **Features**: Login, Session Management, Password Change/Forgot (OTP), Impersonation, RBAC.

## 3. News Ingestion Pipeline

### A. Auto-Ingestion (Google News)
- **Mechanism**: Background job (`NewsIngestionService`).
- **Logic**:
  - Iterates active entities.
  - Builds queries via `KeywordManagerService`.
  - Fetches from Google News RSS.
  - Deduplicates & Stores as `APPROVED`.
  - Link articles to entities.
  - **Auto-Analyses Sentiment**.

### B. Manual Ingestion (Admin)
- **Endpoint**: `POST /admin/news`
- **Supported Inputs**: Text, Link, File (PDF/DOCX/TXT).
- **Process**: Files are parsed via Python -> Text extracted -> Article created -> Sentiment analyzed.

## 4. Analytics & NLP Integration

### Python Microservice (`analysis-service`)
- **Status**: **PRODUCTION READY**
- **Model**: `nlptown/bert-base-multilingual-uncased-sentiment` (HuggingFace).
- **Optimization**: Singleton Model Loader (Fast startup).
- **Features**: 
  - Sentiment Analysis (Pos/Neu/Neg + Score + Confidence).
  - Language Detection.
  - File Parsing (PDF/DOCX/TXT).

### Integration (NestJS)
- **Services**: `SentimentAnalysisService` & `FileParsingService`.
- **Flow**: "Fire and forget" for sentiment to ensure non-blocking ingestion.

## 5. Read APIs (New)
- **Endpoint**: `GET /news`
- **Features**:
  - Pagination.
  - Filters: `page`, `limit`, `geoUnitId`, `entityId`, `sentiment`, `search`.
  - Response includes Sentiment Signals and Entity Mentions.

## 6. How to Run
1. **Backend**: `npm run start:dev`
2. **Python Service**:
   - `cd analysis-service`
   - `setup_env.bat` (Run once to install PyTorch/Transformers)
   - `venv\Scripts\uvicorn app.main:app --reload --port 8000`

## 7. Next Steps
1. **Dashboard Logic**: Implement aggregation for `DailyGeoStats`.
2. **Frontend Integration**: Connect React/Next.js frontend to these APIs.
