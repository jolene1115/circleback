"""Public speaking mode: the user gives their topic/context and key points, speaks,
then gets feedback on whether they got their message across. Optionally saved to a practice session."""

from fastapi import APIRouter, Depends, HTTPException
from google.genai import errors

from backend.models import SpeakingFeedbackRequest, SpeakingFeedbackResponse, TimeCheck
from backend.routers.interview import get_client, model_error
from backend.services import db
from backend.services.gemini import speaking_feedback
from backend.services.metrics import compute_metrics

router = APIRouter(prefix="/speaking")


@router.post("/feedback", response_model=SpeakingFeedbackResponse)
def feedback(request: SpeakingFeedbackRequest, client=Depends(get_client)):
    if request.sessionId:
        db.get_session(request.sessionId, "speaking")  # fail fast before spending a Gemini call

    metrics = request.metrics.model_dump() if request.metrics else None
    try:
        result = speaking_feedback(
            client, request.context, request.points, request.transcript, metrics, request.timeLimitSec
        )
    except errors.APIError as exc:
        raise model_error(exc) from exc
    except (ValueError, TypeError) as exc:  # includes pydantic ValidationError
        raise HTTPException(502, "Gemini returned invalid feedback.") from exc

    time_check = None
    if request.timeLimitSec and request.metrics:
        duration = request.metrics.durationSec
        time_check = TimeCheck(
            limitSec=request.timeLimitSec,
            durationSec=duration,
            overBySec=round(duration - request.timeLimitSec, 1),
        )
    validated = SpeakingFeedbackResponse(**result.model_dump(), timeCheck=time_check)

    if request.sessionId:
        saved_metrics = compute_metrics(request.transcript, request.metrics.durationSec if request.metrics else 0)
        db.save_attempt(request.sessionId, None, request.transcript,
                        saved_metrics.model_dump(), validated.model_dump(), mode="speaking")
    return validated
