from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import logging

logger = logging.getLogger(__name__)

class SentimentModel:
    _instance = None
    _tokenizer = None
    _model = None
    
    # Using a multilingual model that supports English, Kannada, Hindi etc.
    # This model outputs 1-5 stars
    MODEL_NAME = "nlptown/bert-base-multilingual-uncased-sentiment"

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = SentimentModel()
        return cls._instance

    def __init__(self):
        if SentimentModel._model is not None:
            return
            
        logger.info(f"Loading sentiment model: {self.MODEL_NAME}...")
        try:
            SentimentModel._tokenizer = AutoTokenizer.from_pretrained(self.MODEL_NAME)
            SentimentModel._model = AutoModelForSequenceClassification.from_pretrained(self.MODEL_NAME)
            logger.info("Sentiment model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load sentiment model: {e}")
            raise e

    def predict(self, text: str):
        if not text:
            return None

        # Truncate to 512 tokens (BERT limit)
        inputs = SentimentModel._tokenizer(
            text, 
            return_tensors="pt", 
            truncation=True, 
            padding=True, 
            max_length=512
        )
        
        with torch.no_grad():
            outputs = SentimentModel._model(**inputs)
            logits = outputs.logits
            probs = torch.nn.functional.softmax(logits, dim=-1)
            
        return probs[0].tolist()

sentiment_model = SentimentModel()
