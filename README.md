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
| `POST /api/interview/feedback` | Question + transcript → feedback; saves an attempt when `sessionId` is supplied |
| `POST /api/speaking/feedback` | Speech context + key points + transcript → feedback, including which points were covered; saves an attempt when `sessionId` is supplied |
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
It returns:
- `strength`, `improvement`: each quotes the words from the answer it refers to
- `example_rewrite`: one of their sentences, rewritten the way a strong candidate would say it
- `retry_challenge`: what to do on the next attempt
- `star_check`: `{situation, task, action, result}` as true/false
- `delivery_tip`: only when pace or filler words were off (otherwise `null`). Pass `metrics` to get this

The prompt is in `build_feedback_prompt` in `backend/test_llm.py`. Busy-server errors (503) are retried automatically.

`POST /api/speaking/feedback` takes what the user said they'd talk about, plus `/api/transcribe`'s output (`points`, `metrics` and `timeLimitSec` are optional):
```json
{
  "context": "1-minute class presentation on campus recycling for my classmates",
  "points": ["why recycling matters", "how our campus recycles", "what students can do to help"],
  "transcript": "Hi everyone. Um, today I'm going to talk about recycling on campus...",
  "metrics": { "durationSec": 20.8, "wordsPerMinute": 139, "fillerCount": 5, "fillerWords": { "um": 1 } },
  "timeLimitSec": 60
}
```
It returns:
- `summary`: one-sentence overall take
- `pointsCovered`: `[{point, covered, evidence}]`, one per key point, where `evidence` quotes the speech or says what was missing
- `strengths` (1–2), `improvements` (2–3, most important first)
- `exampleRewrite`: one sentence rewritten to land better for that audience
- `deliveryTip`: only when pace, fillers or timing were off (otherwise `null`)
- `nextTry`: what to focus on in the next attempt
- `timeCheck`: `{limitSec, durationSec, overBySec}`, computed in code, when a time limit and metrics are sent

The prompt is in `backend/services/prompts.py`.

All errors come back as `{ "error": "..." }`: empty or invalid input returns 422, invalid Gemini responses return 502, and rate limits return 429. Local frontend origins on ports 5173 and 3000 are allowed (CORS). Feedback saves an attempt when a valid `sessionId` is included; omitting it keeps the existing stateless behavior.

The frontend flow: record, `POST /api/transcribe`, then send `{sessionId, question, transcript, metrics}` to `POST /api/interview/feedback`.

## Testing transcription (no frontend needed)

With the API running, in a second terminal:
```bash
.venv/bin/python scripts/transcribe_file.py samples/your-recording.m4a
.venv/bin/python scripts/live_mic.py --mic --threshold 0.05 --silence 2000
```
The second command lets you talk; it auto-stops when you pause.

**Practice (pick a mode):**
```bash
.venv/bin/python scripts/practice.py --threshold 0.05
```
It asks whether you want **1. Interview practice** or **2. Public speaking**, then starts that mode with your mic. You can also start each mode directly:

**Full interview practice** (question → answer out loud → transcript → feedback → retry or next):
```bash
.venv/bin/python scripts/interview_mic.py --mic --threshold 0.05
```
Add `--question "Tell me about yourself."` to skip question generation and save Gemini quota.

**Public speaking practice** (describe your topic + key points → give the speech → transcript → feedback → try again):
```bash
.venv/bin/python scripts/speech_mic.py --mic --threshold 0.05
```
It asks for your topic/context, key points and an optional time limit, then records until you press **Enter**, since pauses are normal in a speech. You can also pass them as flags: `--context "..." --point "..." --point "..." --time-limit 60`.

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
  "feedback": {
    "strength": "Clear focus", "improvement": "Add an example",
    "example_rewrite": "I enjoy building software that [helps people do X].",
    "retry_challenge": "Describe a project",
    "star_check": {"situation": false, "task": false, "action": false, "result": false}
  }
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

## Resume deep-dive interviews

In interview setup, choose **Resume deep dive**, upload a text-based PDF or paste
resume text, review the extracted text, then start. The existing recorder and
feedback flow are reused; questions and follow-ups use the resume and target topic.
Behavioral remains the default for existing clients.

`POST /api/interview/resume` accepts multipart field `file` and returns
`{"resumeText": "..."}`. Extraction uses pypdf locally without Gemini or saving the
PDF. Limits: 5 MB, 5 pages, 20,000 extracted characters. Encrypted, invalid and
image-only PDFs are rejected; paste text instead. Extraction may reorder columns.
Question setup and feedback's `interview` object accept `type` (`behavioral` or
`resume`) and `resumeText` (required for resume mode).

Resume text is held in active browser setup state, cleared on returning home,
and excluded from saved setup history. Spoken answers, generated questions and
feedback may still contain resume details and are saved in normal history.


## Website accounts and synced history

Build the React UI (`cd frontend`, `npm install`, `npm run build`), then run the backend
from the repository root on port 8001. Open http://127.0.0.1:8001 and choose
**Log in / Sign up**. Signed-in interviews are stored in the shared database;
Profile lets you explicitly import previous guest interviews and refresh history.
Guest practice remains available. Login on another device must use the same hosted
website, not a separate localhost database. HTTPS and persistent server storage are
required for deployment; set `COOKIE_SECURE=true` for HTTPS. Password recovery and
email verification are not implemented yet. See [frontend integration](docs/frontend-integration.md)
for account APIs, deployment details, and tests.

## Resume deep-dive interviews

In interview setup, choose **Resume deep dive**, upload a text-based PDF or paste
resume text, review the extracted text, then start. The existing recorder and
feedback flow are reused; questions and follow-ups use the resume and target topic.
Behavioral remains the default for existing clients.

`POST /api/interview/resume` accepts multipart field `file` and returns
`{"resumeText": "..."}`. Extraction uses pypdf locally without Gemini or saving the
PDF. Limits: 5 MB, 5 pages, 20,000 extracted characters. Encrypted, invalid and
image-only PDFs are rejected; paste text instead. Extraction may reorder columns.
Question setup and feedback's `interview` object accept `type` (`behavioral` or
`resume`) and `resumeText` (required for resume mode).

Resume text is held in active browser setup state, cleared on returning home,
and excluded from saved setup history. Spoken answers, generated questions and
feedback may still contain resume details and are saved in normal history.
