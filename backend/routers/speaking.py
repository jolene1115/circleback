"""Public speaking mode: the user gives their topic/context and key points, speaks,
then gets feedback on whether they got their message across."""

from fastapi import APIRouter, Depends, HTTPException
from google.genai import errors

from backend.models import SpeakingFeedbackRequest, SpeakingFeedbackResponse, TimeCheck
from backend.routers.interview import get_client, model_error
from backend.services.gemini import speaking_feedback

router = APIRouter(prefix="/speaking")


@router.post("/feedback", response_model=SpeakingFeedbackResponse)
def feedback(request: SpeakingFeedbackRequest, client=Depends(get_client)):
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
    return SpeakingFeedbackResponse(**result.model_dump(), timeCheck=time_check)
