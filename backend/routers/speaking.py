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

    # Pace and filler numbers are computed in code from the transcript and the recording length.
    duration = request.metrics.durationSec if request.metrics else (request.durationSec or 0)
    metrics = compute_metrics(request.transcript, duration) if duration > 0 else None
    try:
        result = speaking_feedback(
            client,
            request.context,
            request.points,
            request.transcript,
            metrics.model_dump() if metrics else None,
            request.timeLimitSec,
        )
    except errors.APIError as exc:
        raise model_error(exc) from exc
    except (ValueError, TypeError) as exc:  # includes pydantic ValidationError
        raise HTTPException(502, "Gemini returned invalid feedback.") from exc

    time_check = None
    if request.timeLimitSec and duration > 0:
        time_check = TimeCheck(
            limitSec=request.timeLimitSec,
            durationSec=round(duration, 1),
            overBySec=round(duration - request.timeLimitSec, 1),
        )
    validated = SpeakingFeedbackResponse(
        **result.model_dump(), timeCheck=time_check, metrics=metrics or compute_metrics(request.transcript, 0)
    )

    if request.sessionId:
        db.save_attempt(request.sessionId, None, request.transcript,
                        validated.metrics.model_dump(), validated.model_dump(), mode="speaking")
    return validated
