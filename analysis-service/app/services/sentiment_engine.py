from textblob import TextBlob
from app.core import config

def analyze_sentiment_text(text: str) -> dict:
    """
    Basic sentiment analysis using TextBlob for MVP.
    Returns label, score (-1.0 to 1.0), and confidence.
    """
    blob = TextBlob(text)
    polarity = blob.sentiment.polarity
    
    # Determine label
    if polarity > 0.1:
        label = "POSITIVE"
    elif polarity < -0.1:
        label = "NEGATIVE"
    else:
        label = "NEUTRAL"
        
    # Calculate confidence (simplified for MVP)
    # Stronger polarity = higher confidence
    confidence = min(abs(polarity) * 2 + 0.5, 0.95)
    
    return {
        "label": label,
        "score": round(polarity, 2),
        "confidence": round(confidence, 2),
        "model_version": config.DEFAULT_SENTIMENT_MODEL
    }
