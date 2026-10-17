# Cadence UI integration

Run from the repository root:

```sh
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Open http://127.0.0.1:8001/?theme=moon. FastAPI serves both the frontend and API on
the same origin. Do not open the HTML as a file or use the old port 8793 server.

The UI uses local browser English voices. Interviewer drawings, saved characters
and completed session feedback are kept in this browser's localStorage. They do
not sync between browsers or ports. Live recordings only remain until reload.

The setup checkbox discloses that audio and answers are processed by Gemini.
The server requires the team's GEMINI_API_KEY and configured models in .env.
Keys stay on the server. No key or audio is included in the frontend assets.

## Connected flow

- POST /api/interview/question accepts an optional context body: topic, context,
  focus, tone, history. Calls without a body still work.
- PCM microphone chunks become WAV multipart uploads to /api/transcribe every
  eight seconds and at stop. Partial transcripts appear as responses arrive.
- POST /api/interview/feedback receives question, transcript and optional
  interview context/history. Its retry_challenge becomes the next question.
- Strengths and improvements are saved with each turn and displayed in History.
- API failures show a retryable error; they do not substitute sample AI results.

## Remaining limits

Public Speaking and server-side session storage are still team placeholders.
Transcription is chunked, not word-level streaming; chunk boundaries may affect
recognition. Browser voices vary by device. Cloud tests need a configured key
and may consume the project's quota. Automated integration tests mock Gemini.
