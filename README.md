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
| `POST /api/speaking/feedback` | Speech context + key points + transcript → feedback, including which points were covered |
| `GET/POST /api/sessions` | Not built yet (placeholder) |

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

All errors come back as `{ "error": "..." }`: empty or invalid input returns 422, invalid Gemini responses return 502, and rate limits return 429. Local frontend origins on ports 5173 and 3000 are allowed (CORS). Nothing saves attempts yet.

The frontend flow: record, `POST /api/transcribe`, then send `{question, transcript}` to `POST /api/interview/feedback`.

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
