from fastapi import APIRouter, HTTPException
from app.models.sentiment import SentimentRequest, SentimentResponse
from app.services.sentiment_engine import analyze_sentiment_text

router = APIRouter()

@router.post("/sentiment", response_model=SentimentResponse)
async def analyze_sentiment(request: SentimentRequest):
    """
    Analyze sentiment of the provided text.
    """
    if not request.content:
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    
    result = analyze_sentiment_text(request.content)
    return result
