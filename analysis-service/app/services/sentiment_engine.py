from app.services.model_loader import SentimentModel
from langdetect import detect, LangDetectException
from app.core import config
import logging

logger = logging.getLogger(__name__)

def analyze_sentiment_text(text: str) -> dict:
    """
    Advanced sentiment analysis using BERT model.
    Maps 1-5 star ratings to Positive/Neutral/Negative.
    """
    try:
        # 1. Language Detection (for metadata, model is multilingual already)
        try:
            lang = detect(text)
        except LangDetectException:
            lang = "unknown"

        # 2. Run Model Inference
        model = SentimentModel.get_instance()
        probs = model.predict(text)
        
        # probs is a list of 5 probabilities corresponding to [1 star, 2 stars, 3 stars, 4 stars, 5 stars]
        
        # 3. Map to Label & Score
        # We calculate a weighted score from -1 (1 star) to +1 (5 stars)
        # 1 star = -1.0
        # 2 stars = -0.5
        # 3 stars = 0.0
        # 4 stars = +0.5
        # 5 stars = +1.0
        
        score = (
            (probs[0] * -1.0) + 
            (probs[1] * -0.5) + 
            (probs[2] *  0.0) + 
            (probs[3] *  0.5) + 
            (probs[4] *  1.0)
        )
        
        # 4. Determine Label from dominant class
        max_prob_idx = probs.index(max(probs)) # 0 to 4
        
        if max_prob_idx <= 1: # 0 or 1 (1-2 stars)
            label = "NEGATIVE"
        elif max_prob_idx == 2: # 2 (3 stars)
            label = "NEUTRAL"
        else: # 3 or 4 (4-5 stars)
            label = "POSITIVE"
            
        # 5. Confidence
        confidence = max(probs)
        
        return {
            "label": label,
            "score": round(score, 4),
            "confidence": round(confidence, 4),
            "model_version": f"{SentimentModel.MODEL_NAME}@v1",
            "language": lang
        }
        
    except Exception as e:
        logger.error(f"Sentiment analysis failed: {e}")
        # Fallback to neutral on error
        return {
            "label": "NEUTRAL",
            "score": 0.0,
            "confidence": 0.0,
            "model_version": "error-fallback",
            "language": "unknown"
        }
