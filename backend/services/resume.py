"""Extract resume text locally; original PDFs are never saved."""
from io import BytesIO

from pypdf import PdfReader

MAX_RESUME_BYTES = 5 * 1024 * 1024
MAX_RESUME_PAGES = 5
MAX_RESUME_TEXT = 20000


def extract_resume_text(data: bytes) -> str:
    if len(data) > MAX_RESUME_BYTES:
        raise ValueError("Resume PDF must be 5 MB or smaller.")
    if not data or not data.lstrip().startswith(b"%PDF-"):
        raise ValueError("Please upload a valid PDF or paste your resume text.")
    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted:
            raise ValueError("Password-protected PDFs are not supported. Paste your resume text instead.")
        if len(reader.pages) > MAX_RESUME_PAGES:
            raise ValueError("Resume PDF must have no more than 5 pages.")
        text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("Could not read this PDF. Please paste your resume text instead.") from exc
    if not text:
        raise ValueError("No readable text found. Scanned PDFs are not supported; paste your resume text instead.")
    if len(text) > MAX_RESUME_TEXT:
        raise ValueError("Resume text exceeds 20,000 characters. Paste a shorter version instead.")
    return text
