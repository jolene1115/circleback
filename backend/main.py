"""HTTP API for interview questions and transcript feedback."""

from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import errors
from pydantic import BaseModel, StringConstraints

from backend.test_llm import (
    QUESTION_PROMPT,
    feedback_from_transcription,
    generate_text,
    load_api_key,
    parse_json,
)

app = FastAPI(title="Interview Feedback API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

NonEmptyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class FeedbackRequest(BaseModel):
    question: NonEmptyText
    transcript: NonEmptyText


class QuestionResponse(BaseModel):
    question: NonEmptyText


class FeedbackResponse(BaseModel):
    strength: NonEmptyText
    improvement: NonEmptyText
    retry_challenge: NonEmptyText


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
    return HTTPException(502, "Gemini request failed. Please try again later.")


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/interview/question", response_model=QuestionResponse)
def question(client=Depends(get_client)):
    try:
        result = parse_json(generate_text(client, QUESTION_PROMPT))
        return QuestionResponse.model_validate(result)
    except errors.APIError as exc:
        raise model_error(exc) from exc
    except (ValueError, TypeError) as exc:
        raise HTTPException(502, "Gemini returned an invalid question.") from exc


@app.post("/api/interview/feedback", response_model=FeedbackResponse)
def feedback(request: FeedbackRequest, client=Depends(get_client)):
    try:
        result = feedback_from_transcription(
            client, request.question, {"transcript": request.transcript}
        )
        return FeedbackResponse.model_validate(result)
    except errors.APIError as exc:
        raise model_error(exc) from exc
    except (ValueError, TypeError) as exc:
        raise HTTPException(502, "Gemini returned invalid feedback.") from exc
