import io
import pdfplumber
import docx

def extract_text_from_file(content: bytes, filename: str) -> dict:
    """
    Extract text from file based on extension.
    Using io.BytesIO to handle in-memory files.
    """
    text = ""
    page_count = 0
    
    file_lower = filename.lower()
    
    if file_lower.endswith('.pdf'):
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            page_count = len(pdf.pages)
            for page in pdf.pages:
                text += page.extract_text() + "\n"
                
    elif file_lower.endswith('.docx'):
        doc = docx.Document(io.BytesIO(content))
        page_count = 1 # DOCX doesn't have strict pages
        for para in doc.paragraphs:
            text += para.text + "\n"
            
    elif file_lower.endswith('.txt'):
        text = content.decode('utf-8')
        page_count = 1
        
    else:
        raise ValueError("Unsupported file type. Use PDF, DOCX, or TXT.")
        
    return {
        "extracted_text": text.strip(),
        "page_count": page_count,
        "filename": filename
    }
