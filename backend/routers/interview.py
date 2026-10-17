"""Interview mode endpoints (TODO: LLM teammate). Use services/gemini.py."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from backend.models import Feedback, InterviewFeedbackRequest, QuestionRequest, QuestionResponse

router = APIRouter(prefix="/interview")

def not_implemented() -> JSONResponse:
    return JSONResponse({"error": "Not implemented yet"}, status_code=501)


@router.post("/question", response_model=QuestionResponse)
async def question(body: QuestionRequest):
    return not_implemented()


@router.post("/feedback", response_model=Feedback)
async def feedback(body: InterviewFeedbackRequest):
    return not_implemented()
