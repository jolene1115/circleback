"""Speech-to-text with Gemini.
Returns a VERBATIM transcript (fillers kept); all numbers are computed in metrics.py."""

import asyncio
import io
import re
import wave
from typing import Optional

from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from backend.config import GEMINI_API_KEY, TRANSCRIBE_MODEL

MAX_AUDIO_BYTES = 20 * 1024 * 1024  # Gemini inline-audio limit

# webm = browser MediaRecorder, m4a = iPhone voice memo
MIME_BY_EXT = {
    "webm": "audio/webm",
    "mp3": "audio/mp3",
    "wav": "audio/wav",
    "m4a": "audio/mp4",
    "mp4": "audio/mp4",
    "aac": "audio/aac",
    "ogg": "audio/ogg",
    "flac": "audio/flac",
}
SUPPORTED_MIME = set(MIME_BY_EXT.values()) | {"audio/mpeg", "audio/x-m4a", "audio/x-wav"}

PROMPT = """Transcribe this audio recording of someone practicing public speaking.

Rules:
- Transcribe VERBATIM. Keep every filler word (um, uh, like, you know, so, basically, actually, I mean), repeated words, and false starts exactly as spoken.
- Do NOT clean up grammar, remove disfluencies, or summarize.
- Use normal punctuation and sentence breaks.
- If there is no speech, return an empty transcript."""


class _TranscriptOut(BaseModel):
    transcript: str


class TranscribeError(Exception):
    def __init__(self, message: str, status: int):
        super().__init__(message)
        self.status = status


def resolve_mime_type(mime_type: Optional[str], filename: str = "") -> Optional[str]:
    """Trust the upload's type if it's audio we support, else fall back to the file extension."""
    base = (mime_type or "").split(";")[0].strip().lower()
    if base in SUPPORTED_MIME:
        return base
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return MIME_BY_EXT.get(ext)


def wav_duration_sec(audio: bytes) -> Optional[float]:
    """Duration of a WAV file from its header, or None if it isn't one."""
    try:
        with wave.open(io.BytesIO(audio)) as w:
            return round(w.getnframes() / w.getframerate(), 2)
    except Exception:
        return None


_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if not GEMINI_API_KEY:
        raise TranscribeError("GEMINI_API_KEY is not set. Copy .env.example to .env and paste your key.", 500)
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


def _retry_delay_sec(message: str) -> Optional[float]:
    """How long a 429 says to wait, e.g. 'Please retry in 12.8s' -> 13.3."""
    m = re.search(r"retry in ([\d.]+)s", message, re.I) or re.search(r"'retryDelay': '([\d.]+)s'", message)
    return float(m.group(1)) + 0.5 if m else None


def _friendly_error(err: errors.APIError) -> TranscribeError:
    message = str(err)
    if err.code == 429 and "PerDay" in message:
        return TranscribeError(
            "Daily free Gemini limit reached for this model. "
            "Change GEMINI_TRANSCRIBE_MODEL in .env or use a teammate's key.",
            429,
        )
    if err.code == 429:
        return TranscribeError("Gemini free-tier rate limit hit. Wait a minute and try again.", 429)
    if err.code == 503:
        return TranscribeError("Gemini is overloaded right now. Try again in a minute.", 503)
    return TranscribeError(err.message or message, err.code or 500)


async def transcribe_audio(audio: bytes, mime_type: str, attempts: int = 3) -> str:
    """Send audio to Gemini and return the verbatim transcript.

    Retries the errors that clear up on their own:
      503 = Gemini overloaded -> short backoff
      429 = free-tier per-minute limit -> wait as long as Gemini says (if under 30s)
    """
    client = _get_client()
    for attempt in range(1, attempts + 1):
        try:
            response = await client.aio.models.generate_content(
                model=TRANSCRIBE_MODEL,
                contents=[
                    types.Part.from_text(text=PROMPT),
                    types.Part.from_bytes(data=audio, mime_type=mime_type),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=_TranscriptOut,
                    temperature=0,
                ),
            )
            return _TranscriptOut.model_validate_json(response.text or '{"transcript": ""}').transcript.strip()
        except errors.APIError as err:
            wait = None
            if err.code == 503:
                wait = 2 * attempt
            elif err.code == 429:
                delay = _retry_delay_sec(str(err))
                if delay and delay <= 30:
                    wait = delay
            if wait is None or attempt == attempts:
                raise _friendly_error(err) from err
            await asyncio.sleep(wait)
    raise TranscribeError("Transcription failed", 500)  # unreachable
