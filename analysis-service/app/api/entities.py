from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()

class EntityRequest(BaseModel):
    content: str

class EntityItem(BaseModel):
    type: str # GEO_UNIT, PARTY, CANDIDATE
    value: str

class EntityResponse(BaseModel):
    entities: List[EntityItem]

@router.post("/entities", response_model=EntityResponse)
async def extract_entities(request: EntityRequest):
    """
    Extract political entities (NER).
    Placeholder for future spaCy implementation.
    """
    # Mock response for MVP
    # In v2: Use spaCy NER model trained on Indian political data
    return {
        "entities": []
    }
