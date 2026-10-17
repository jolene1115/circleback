"""Gemini calls for feedback.

Interview question + feedback live in backend/test_llm.py (used by routers/interview.py).
Speaking-mode feedback is here, reusing test_llm's retrying Gemini call.
"""

from typing import Optional

from google import genai
from google.genai import types
from pydantic import BaseModel

from backend.models import PointCovered
from backend.services.prompts import build_speaking_feedback_prompt
from backend.test_llm import call_gemini


class SpeakingFeedbackOut(BaseModel):
    """Shape Gemini must return (enforced with response_schema)."""

    summary: str
    strengths: list[str]
    improvements: list[str]
    pointsCovered: list[PointCovered]
    exampleRewrite: str
    deliveryTip: Optional[str] = None
    nextTry: str


def speaking_feedback(
    client: genai.Client,
    context: str,
    points: list[str],
    transcript: str,
    metrics: Optional[dict] = None,
    time_limit_sec: Optional[int] = None,
) -> SpeakingFeedbackOut:
    prompt = build_speaking_feedback_prompt(context, points, transcript, metrics, time_limit_sec)
    response = call_gemini(
        client,
        prompt,
        types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SpeakingFeedbackOut,
            temperature=0.3,  # low = more consistent feedback between attempts
        ),
    )
    return SpeakingFeedbackOut.model_validate_json(response.text or "")
