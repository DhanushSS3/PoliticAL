# PoliticAI Analysis Service

Microservice for NLP analysis, sentiment scoring, and file parsing.
Built with FastAPI.

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   venv\Scripts\activate     # Windows
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Download NLP corpora (TextBlob):
   ```bash
   python -m textblob.download_corpora
   ```

## Running

Start the server:
```bash
uvicorn app.main:app --reload --port 8000
```

## API Endpoints

- **GET /health**: Health check
- **POST /analyze/sentiment**: Analyze text sentiment
- **POST /analyze/entities**: Extract entities (NER)
- **POST /parse/file**: Parse PDF/DOCX/TXT files

## Architecture

- **Stateless**: No database connection.
- **Compute-Focused**: Handles NLP and parsing.
- **Internal**: Intended to be called by NestJS backend only.
