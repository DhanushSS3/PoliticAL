from pydantic import BaseModel

class SentimentRequest(BaseModel):
    content: str
    language: str = "en"
    context: str = "political_news"

class SentimentResponse(BaseModel):
    label: str
    score: float
    confidence: float
    model_version: str
    language: str = "unknown"
