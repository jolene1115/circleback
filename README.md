# zothacks-2026-team10

## Python interview API

From the project root, activate your virtual environment and run:

```bash
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```

Keep `GEMINI_API_KEY` in the root `.env` file (never commit it).
Open http://localhost:8000/docs to test:

- `GET /api/health`: checks the Python server is running; does not call Gemini.
- `POST /api/interview/question`: generates a question; no request body needed.
- `POST /api/interview/feedback`: accepts the original question and Node transcription's `transcript` field:

```json
{
  "question": "Tell me about a time you worked on a team.",
  "transcript": "We disagreed about the tech stack. I organized a meeting and helped us choose one. We finished on time."
}
```

Feedback returns `strength`, `improvement`, and `retry_challenge` strings.
Empty input returns 422; invalid Gemini responses return 502; rate limits return 429.
Transcription remains on the separate Node server (port 3001). The frontend
passes its transcript to Python (port 8000). Local frontend origins on ports
5173 and 3000 are allowed. These endpoints do not save attempts or compute metrics yet.
