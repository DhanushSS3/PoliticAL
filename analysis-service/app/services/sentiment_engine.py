from app.services.model_loader import SentimentModel, MultilingualSentimentModel
from app.services.translation_service import translate_text
from langdetect import detect, LangDetectException
from app.core import config
import logging

logger = logging.getLogger(__name__)


def _map_probs_to_output(probs, model_name: str, detected_lang: str) -> dict:
    """Map raw probability distribution to label, score and confidence.

    Handles different model output sizes:
    - 3 classes: [NEGATIVE, NEUTRAL, POSITIVE]
    - 5 classes: 1-5 stars (multilingual fallback)
    """

    if not probs or len(probs) == 0:
        raise ValueError("Empty probability distribution from sentiment model")

    num_classes = len(probs)

    if num_classes == 3:
        # [NEGATIVE, NEUTRAL, POSITIVE]
        neg, neu, pos = probs
        # Score in [-1, 1]
        score = (-1.0 * neg) + (0.0 * neu) + (1.0 * pos)

        max_idx = probs.index(max(probs))
        if max_idx == 0:
            label = "NEGATIVE"
        elif max_idx == 1:
            label = "NEUTRAL"
        else:
            label = "POSITIVE"

    elif num_classes == 5:
        # Legacy mapping from 1-5 stars to [-1, 1]
        score = (
            (probs[0] * -1.0)
            + (probs[1] * -0.5)
            + (probs[2] * 0.0)
            + (probs[3] * 0.5)
            + (probs[4] * 1.0)
        )

        max_idx = probs.index(max(probs))
        if max_idx <= 1:
            label = "NEGATIVE"
        elif max_idx == 2:
            label = "NEUTRAL"
        else:
            label = "POSITIVE"

    else:
        # Generic mapping: use class 0 as negative, last as positive
        score = (-1.0 * probs[0]) + (1.0 * probs[-1])
        max_idx = probs.index(max(probs))
        if max_idx == 0:
            label = "NEGATIVE"
        elif max_idx == num_classes - 1:
            label = "POSITIVE"
        else:
            label = "NEUTRAL"

    confidence = max(probs)

    return {
        "label": label,
        "score": round(score, 4),
        "confidence": round(confidence, 4),
        "model_version": f"{model_name}@v1",
        "language": detected_lang,
    }


def analyze_sentiment_text(text: str) -> dict:
    """Advanced sentiment analysis with language detection and translation.

    - Detects language of input text.
    - Optionally translates non-English (e.g., Kannada) to English using a
      configured translation provider (Azure today).
    - Runs primary English sentiment model.
    - Falls back to the multilingual model if the primary model fails.
    """

    try:
        # 1. Language detection (for metadata and routing)
        try:
            lang = detect(text)
        except LangDetectException:
            lang = "unknown"

        original_lang = lang

        # 2. Translation step (for Kannada or other non-English languages)
        effective_text = text
        if lang == "kn":
            translated, provider = translate_text(text, target_language="en")
            if provider != "none":
                logger.debug(
                    "Translated text from %s to en using provider %s", lang, provider,
                )
                effective_text = translated
                # We keep `language` in response as the *original* language
        
        # 3. Run primary English sentiment model
        try:
            model = SentimentModel.get_instance()
            probs = model.predict(effective_text)
            return _map_probs_to_output(probs, SentimentModel.MODEL_NAME, original_lang)
        except Exception as primary_exc:  # noqa: BLE001
            logger.error("Primary sentiment model failed: %s", primary_exc)

            # 4. Fallback to multilingual model on the original text
            try:
                fallback_model = MultilingualSentimentModel.get_instance()
                fallback_probs = fallback_model.predict(text)
                return _map_probs_to_output(
                    fallback_probs,
                    MultilingualSentimentModel.MODEL_NAME,
                    original_lang,
                )
            except Exception as fallback_exc:  # noqa: BLE001
                logger.error("Fallback multilingual sentiment model also failed: %s", fallback_exc)
                raise

    except Exception as e:  # noqa: BLE001
        logger.error("Sentiment analysis failed: %s", e)
        # Fallback to neutral on error
        return {
            "label": "NEUTRAL",
            "score": 0.0,
            "confidence": 0.0,
            "model_version": "error-fallback",
            "language": "unknown",
        }
