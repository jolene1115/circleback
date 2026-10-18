# zothacks-2026-team10

CircleBack: practice interviews and public speaking, get AI feedback. See [project_plan.md](project_plan.md).

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
| `POST /api/speaking/feedback` | Speaking feedback; saves an attempt when `sessionId` is supplied |
| `POST /api/users`, `GET /api/users/{id}` | Create or retrieve a demo user |
| `POST /api/sessions` | Create a practice session |
| `GET /api/sessions?userId=...&limit=20&offset=0` | Paginated user history |
| `GET /api/sessions/{id}` | Retrieve one session |
| `POST /api/sessions/{id}/attempts` | Explicitly save a completed attempt |
| `GET /api/sessions/{id}/attempts?limit=20&offset=0` | Paginated answers and feedback |

`POST /api/interview/feedback` takes the original question and the `transcript` field from `/api/transcribe`. You can also pass `/api/transcribe`'s `metrics` along; it's optional:
```json
{
  "question": "Tell me about a time you worked on a team.",
  "transcript": "We disagreed about the tech stack. I organized a meeting and helped us choose one. We finished on time."
}
```
It returns `strength`, `improvement` and `retry_challenge` strings.

All errors come back as `{ "error": "..." }`: empty or invalid input returns 422, invalid Gemini responses return 502, and rate limits return 429. Local frontend origins on ports 5173 and 3000 are allowed (CORS). Feedback saves an attempt when a valid `sessionId` is included; omitting it keeps the existing stateless behavior.

The frontend flow: record, `POST /api/transcribe`, then send `{sessionId, question, transcript, metrics}` to `POST /api/interview/feedback`.

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

## Saving practice and reading history

1. `POST /api/users` with `{"name":"Alex"}`. Keep the returned user `id`.
2. `POST /api/sessions` with `{"userId":"<user id>","mode":"interview","setup":{}}`.
   For speaking practice, use `"mode":"speaking"`; setup can contain context and points.
3. Transcribe audio as usual. Include the session `id` as `sessionId` in the feedback request,
   alongside the transcript and transcription metrics. Successful feedback is saved before the
   response returns. Invalid feedback or a missing/wrong-mode session does not save an attempt.
4. Read sessions by `userId`, then read each session's `/attempts` for transcripts, metrics,
   and feedback. Both lists are newest first, with `limit` (1–100) and `offset` pagination.

Alternatively, explicitly save an existing result with `POST /api/sessions/{id}/attempts`:
```json
{
  "question": "Tell me about yourself.",
  "transcript": "I enjoy building useful software.",
  "metrics": {"durationSec": 30, "wordsPerMinute": 12, "fillerCount": 0, "fillerWords": {}},
  "feedback": {"strength": "Clear focus", "improvement": "Add an example", "retry_challenge": "Describe a project"}
}
```
Use automatic saving **or** explicit saving for an answer; using both creates two attempts.
Speaking attempts use the speaking feedback shape and can omit `question`. Duration comes
from the recorder; pace and filler metrics are recomputed on the server before storage.
For interview requests without metrics, duration is recorded as 0 (unknown).

The interview microphone script creates a user and session automatically. Reuse your history
with `--user-id <id>`; use `--name Alex` when creating a user. It prints both IDs.

SQLite defaults to `backend/app.db`. Set `DATABASE_PATH` in `.env` to an absolute path on
persistent storage to customize it (the parent directory must exist). Startup creates missing
tables and history indexes without deleting existing records. Existing tables retain their
original constraints; request validation applies to all API writes. Future column changes
will need a versioned schema migration. SQLite uses WAL and a 10-second lock timeout.
Database failures return a generic 503 and log details on the server. Audio is never stored.

Users are demo profiles, with no authentication: IDs do not provide access control. Add
login and ownership checks before exposing personal practice history publicly.

Run offline database/API tests (Gemini responses are mocked; no paid API calls):
```bash
.venv/bin/python -m unittest discover -s backend/tests -v
```
