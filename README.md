# zothacks-2026-team10

PitchPerfect: practice interviews and public speaking, get AI feedback. See [project_plan.md](project_plan.md).

The backend is **Python + FastAPI** in `backend/`.

## Setup

1. Install Python 3.12+ and `ffmpeg` (for the mic test script): `brew install ffmpeg`
2. Get a free Gemini key at <https://aistudio.google.com/app/apikey>.
3. Copy the env template and paste your key into `.env` at the project root (it's git-ignored, never commit it):
   ```bash
   cp .env.example .env
   ```
4. Create the virtual environment and install packages:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   python -m pip install -r backend/requirements.txt
   ```

## Run the API

From the project root, with the venv active:
```bash
python -m uvicorn backend.main:app --reload --port 8000
```
Open <http://localhost:8000/docs> to try every endpoint in the browser.

| Endpoint | What it does |
|---|---|
| `GET /api/health` | Checks the server is running; doesn't call Gemini |
| `POST /api/transcribe` | Audio file → verbatim transcript + metrics (wpm, filler words). See [docs/transcription.md](docs/transcription.md) |
| `POST /api/interview/question` | Generates an interview question; no request body needed |
| `POST /api/interview/feedback` | Question + transcript → feedback |
| `POST /api/speaking/feedback` | Not built yet (returns 501) |
| `GET/POST /api/sessions` | Not built yet (placeholder) |

`POST /api/interview/feedback` takes the original question and the `transcript` field from `/api/transcribe`. You can also pass `/api/transcribe`'s `metrics` along; it's optional:
```json
{
  "question": "Tell me about a time you worked on a team.",
  "transcript": "We disagreed about the tech stack. I organized a meeting and helped us choose one. We finished on time."
}
```
It returns `strength`, `improvement` and `retry_challenge` strings.

All errors come back as `{ "error": "..." }`: empty or invalid input returns 422, invalid Gemini responses return 502, and rate limits return 429. Local frontend origins on ports 5173 and 3000 are allowed (CORS). Nothing saves attempts yet.

The frontend flow: record, `POST /api/transcribe`, then send `{question, transcript}` to `POST /api/interview/feedback`.

## Testing transcription (no frontend needed)

With the API running, in a second terminal:
```bash
.venv/bin/python scripts/transcribe_file.py samples/your-recording.m4a
.venv/bin/python scripts/live_mic.py --mic --threshold 0.05 --silence 2000
```
The second command lets you talk; it auto-stops when you pause.

**Full interview practice** (question → answer out loud → transcript → feedback → retry or next):
```bash
.venv/bin/python scripts/interview_mic.py --mic --threshold 0.05
```
Add `--question "Tell me about yourself."` to skip question generation and save Gemini quota.

Test the LLM alone: `.venv/bin/python -m backend.test_llm --sample`
