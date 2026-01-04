from fastapi import FastAPI
from app.api import sentiment, entities, parsing, health
from app.core import config

app = FastAPI(
    title=config.PROJECT_NAME,
    version=config.VERSION,
    description="Microservice for NLP analysis and file parsing"
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(sentiment.router, prefix="/analyze", tags=["Sentiment"])
app.include_router(entities.router, prefix="/analyze", tags=["Entities"])
app.include_router(parsing.router, prefix="/parse", tags=["Parsing"])

@app.on_event("startup")
async def startup_event():
    # Load model into memory on startup
    from app.services.model_loader import SentimentModel
    SentimentModel.get_instance()

@app.get("/")
def root():
    return {"message": "PoliticAI Analysis Service v1"}
