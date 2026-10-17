"""Interview mode: generate a question, then give feedback on the spoken answer.
Uses the Gemini helpers in backend/test_llm.py."""

from fastapi import APIRouter, Depends, HTTPException
from google import genai
from google.genai import errors

from backend.models import InterviewFeedbackRequest, InterviewFeedbackResponse, QuestionResponse
from backend.test_llm import (
    QUESTION_PROMPT,
    feedback_from_transcription,
    generate_text,
    load_api_key,
    parse_json,
)

router = APIRouter(prefix="/interview")


def get_client():
    try:
        api_key = load_api_key()
    except ValueError as exc:
        raise HTTPException(500, "GEMINI_API_KEY is not configured on the server.") from exc
    with genai.Client(api_key=api_key) as client:
        yield client


def model_error(exc: errors.APIError) -> HTTPException:
    if exc.code == 429:
        return HTTPException(429, "Gemini rate limit reached. Please try again later.")
    if exc.code == 503:
        return HTTPException(503, "Gemini is overloaded right now (high demand). Try again in a minute.")
    return HTTPException(502, "Gemini request failed. Please try again later.")


@router.post("/question", response_model=QuestionResponse)
def question(client=Depends(get_client)):
    try:
        result = parse_json(generate_text(client, QUESTION_PROMPT))
        return QuestionResponse.model_validate(result)
    except errors.APIError as exc:
        raise model_error(exc) from exc
    except (ValueError, TypeError) as exc:
        raise HTTPException(502, "Gemini returned an invalid question.") from exc


@router.post("/feedback", response_model=InterviewFeedbackResponse)
def feedback(request: InterviewFeedbackRequest, client=Depends(get_client)):
    try:
        transcription = {"transcript": request.transcript}
        if request.metrics:
            transcription["metrics"] = request.metrics.model_dump()  # lets feedback cite real pace/filler numbers
        result = feedback_from_transcription(client, request.question, transcription)
        return InterviewFeedbackResponse.model_validate(result)
    except errors.APIError as exc:
        raise model_error(exc) from exc
    except (ValueError, TypeError) as exc:
        raise HTTPException(502, "Gemini returned invalid feedback.") from exc
