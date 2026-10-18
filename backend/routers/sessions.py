"""Practice session creation and paginated history."""
from fastapi import APIRouter, Query, Request
from backend.models import CreateSessionRequest, SessionResponse, SaveAttemptRequest, AttemptResponse, InterviewFeedbackResponse, SpeakingFeedbackResponse
from backend.services import db
from backend.routes.accounts import protect_user_history, protect_session
from backend.services.metrics import compute_metrics

router = APIRouter(prefix="/sessions")


@router.post("", response_model=SessionResponse)
def create_session(body: CreateSessionRequest, request: Request):
    protect_user_history(body.userId, request)
    return db.create_session(body.userId, body.mode, body.setup)


@router.get("", response_model=list[SessionResponse])
def list_sessions(request: Request, userId: str = Query(min_length=1), limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    protect_user_history(userId, request)
    return db.list_sessions(userId, limit, offset)


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: str, request: Request):
    protect_session(session_id, request)
    return db.get_session(session_id)


@router.post("/{session_id}/attempts", response_model=AttemptResponse)
def save_attempt(session_id: str, body: SaveAttemptRequest, request: Request):
    protect_session(session_id, request)
    session = db.get_session(session_id)
    expected = InterviewFeedbackResponse if session['mode'] == 'interview' else SpeakingFeedbackResponse
    if not isinstance(body.feedback, expected):
        raise db.InvalidDataError('Feedback must match the session mode')
    metrics = compute_metrics(body.transcript, body.metrics.durationSec)
    return db.save_attempt(session_id, body.question, body.transcript, metrics.model_dump(), body.feedback.model_dump())


@router.get("/{session_id}/attempts", response_model=list[AttemptResponse])
def list_attempts(session_id: str, request: Request, limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    protect_session(session_id, request)
    return db.list_attempts(session_id, limit, offset)
