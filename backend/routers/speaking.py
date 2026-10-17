"""Public speaking mode endpoints (TODO: LLM teammate). Use services/gemini.py."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from backend.models import Feedback, SpeakingFeedbackRequest

router = APIRouter(prefix="/speaking")


@router.post("/feedback", response_model=Feedback)
async def feedback(body: SpeakingFeedbackRequest):
    return JSONResponse({"error": "Not implemented yet"}, status_code=501)
