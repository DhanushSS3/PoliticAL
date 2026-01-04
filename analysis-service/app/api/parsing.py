from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.file_parser import extract_text_from_file

router = APIRouter()

@router.post("/file")
async def parse_file(file: UploadFile = File(...)):
    """
    Extract text from uploaded file (PDF, DOCX, TXT).
    """
    try:
        content = await file.read()
        filename = file.filename
        
        result = extract_text_from_file(content, filename)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
