"""POST /api/transcribe
multipart/form-data: "audio" (file, required), "durationSec" (number, optional; the recorder's timer)
-> TranscribeResponse (backend/models.py)
"""

import logging
import time
from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

from backend.config import GEMINI_API_KEY, TRANSCRIBE_MODEL
from backend.models import TranscribeResponse
from backend.services.metrics import compute_metrics
from backend.services.transcribe import (
    MAX_AUDIO_BYTES,
    TranscribeError,
    resolve_mime_type,
    transcribe_audio,
    wav_duration_sec,
)

router = APIRouter()
log = logging.getLogger("uvicorn.error")


def error(message: str, status: int) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


@router.get("/transcribe")
def health():
    return {"ok": True, "keyConfigured": bool(GEMINI_API_KEY), "model": TRANSCRIBE_MODEL}


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    audio: Optional[UploadFile] = File(None),
    durationSec: Optional[float] = Form(None),
):
    if audio is None:
        return error('No audio file. Send it as form field "audio".', 400)

    data = await audio.read()
    if len(data) > MAX_AUDIO_BYTES:
        return error("File too large (max 20MB).", 413)

    mime_type = resolve_mime_type(audio.content_type, audio.filename or "")
    if not mime_type:
        return error(f"Unsupported audio type: {audio.content_type or 'unknown'} ({audio.filename})", 400)

    duration = durationSec if durationSec and durationSec > 0 else (wav_duration_sec(data) or 0.0)

    start = time.monotonic()
    try:
        transcript = await transcribe_audio(data, mime_type)
    except TranscribeError as err:
        log.error("[transcribe] %s %s", err.status, err)
        return error(str(err), err.status)

    return TranscribeResponse(
        transcript=transcript,
        durationSec=duration,
        metrics=compute_metrics(transcript, duration),
        model=TRANSCRIBE_MODEL,
        ms=round((time.monotonic() - start) * 1000),
    )
