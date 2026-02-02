import logging
import os
from typing import Tuple

import requests


logger = logging.getLogger(__name__)


def _get_provider() -> str:
    """Return the configured translation provider (lowercased).

    Supported values (for now):
    - "azure"  -> Azure Cognitive Services Translator
    - "google" -> Placeholder, currently not implemented
    - "none"   -> Disable translation (default)
    """

    return os.getenv("TRANSLATION_PROVIDER", "none").strip().lower()


def translate_text(text: str, target_language: str = "en") -> Tuple[str, str]:
    """Translate the given text to target_language.

    Returns a tuple of (translated_text, provider_used).

    If translation is disabled, misconfigured or fails, this function returns
    the original text and provider_used = "none".
    """

    provider = _get_provider()

    # Fast path: translation disabled
    if provider in ("", "none"):
        return text, "none"

    if provider == "azure":
        return _translate_with_azure(text, target_language)

    if provider == "google":
        # Placeholder for future Google implementation
        logger.warning(
            "Translation provider 'google' selected, but implementation is not available yet. "
            "Returning original text without translation.",
        )
        return text, "none"

    logger.warning(
        "Unknown TRANSLATION_PROVIDER '%s'. Translation disabled; returning original text.",
        provider,
    )
    return text, "none"


def _translate_with_azure(text: str, target_language: str) -> Tuple[str, str]:
    """Translate text using Azure Cognitive Services Translator.

    Required environment variables:
    - AZURE_TRANSLATOR_KEY: subscription key
    - AZURE_TRANSLATOR_REGION: region (e.g. 'centralindia')
    Optional environment variables:
    - AZURE_TRANSLATOR_ENDPOINT: base endpoint URL, defaults to
      'https://api.cognitive.microsofttranslator.com'
    """

    key = os.getenv("AZURE_TRANSLATOR_KEY")
    region = os.getenv("AZURE_TRANSLATOR_REGION")
    endpoint = os.getenv(
        "AZURE_TRANSLATOR_ENDPOINT",
        "https://api.cognitive.microsofttranslator.com",
    ).rstrip("/")

    if not key or not region:
        logger.warning(
            "Azure translation selected but AZURE_TRANSLATOR_KEY or AZURE_TRANSLATOR_REGION "
            "is not set. Returning original text without translation.",
        )
        return text, "none"

    path = "/translate"
    params = {
        "api-version": "3.0",
        "to": target_language,
    }
    url = f"{endpoint}{path}"

    headers = {
        "Ocp-Apim-Subscription-Key": key,
        "Ocp-Apim-Subscription-Region": region,
        "Content-type": "application/json",
    }

    body = [{"text": text}]

    try:
        response = requests.post(url, params=params, headers=headers, json=body, timeout=5)
        response.raise_for_status()
        data = response.json()

        # Successful response format:
        # [ { "translations": [ { "text": "...", "to": "en" } ] } ]
        translated = data[0]["translations"][0]["text"]
        return translated, "azure"
    except Exception as exc:  # noqa: BLE001
        logger.error("Azure translation failed: %s", exc)
        return text, "none"

