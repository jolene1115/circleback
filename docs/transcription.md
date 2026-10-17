# Transcription (speech-to-text)

Owner: Jace. Covers build-order steps 1–2 in `project_plan.md` (backend side).

Audio in, **verbatim transcript** out (fillers like "um", "uh" and "like" kept), plus speaking metrics computed in code. Python + FastAPI.

## Files

| File | What it does |
|---|---|
| `backend/services/transcribe.py` | Gemini call. Prompts for a verbatim transcript; retries on 503 (busy) and short 429s (per-minute limit); readable error messages |
| `backend/services/metrics.py` | `compute_metrics(transcript, duration_sec)`: words per minute and filler counts, in plain code (no LLM), per the plan's rule |
| `backend/models.py` | Pydantic models: `Metrics`, `Feedback`, `TranscribeResponse`, and the other endpoints' request bodies |
| `backend/routers/transcribe.py` | `POST /api/transcribe` (and `GET` for a health check) |
| `scripts/transcribe_file.py` | Sends a file to the API and prints the result |
| `scripts/live_mic.py` | Talk into the mic; it auto-stops when you pause, then transcribes each answer |

## API

`POST /api/transcribe`: `multipart/form-data`
- `audio` (required): webm (browser MediaRecorder), wav, mp3, m4a/mp4, aac, ogg or flac. Max 20MB.
- `durationSec` (optional): recording length from the recorder's timer. It's needed for words per minute; WAV files are measured automatically.

```json
{
  "transcript": "Um, so, like, I worked on a project last summer where, uh, ...",
  "durationSec": 11.47,
  "words": null,
  "metrics": {
    "durationSec": 11.47,
    "wordsPerMinute": 167,
    "fillerCount": 6,
    "fillerWords": { "um": 1, "uh": 1, "like": 1, "so": 1, "you know": 1, "basically": 1 },
    "longPauses": null
  },
  "model": "gemini-3.5-flash-lite",
  "ms": 1105
}
```
`transcript` and `durationSec` match the contract in the plan. `metrics`, `model` and `ms` are extras, so the frontend can pass `metrics` straight to `/api/*/feedback`.

Errors come back as `{ "error": "..." }`: 400 (no file, bad type or invalid body), 413 (too large), 429 (rate or daily limit), 500 (key missing), 501 (endpoint not built yet), 503 (Gemini busy).

You can try it in the browser at <http://localhost:8000/docs>, or from code:
```python
import httpx
with open("answer.webm", "rb") as f:
    res = httpx.post("http://localhost:8000/api/transcribe",
                     files={"audio": ("answer.webm", f)}, data={"durationSec": "12.5"})
print(res.json()["transcript"])
```

## Filler counting (`backend/services/metrics.py`)
Counts um, uh, ah, hmm, you know, I mean, basically, actually and literally. "like" and "so" count only when they're fillers: at the start of a clause or set off by commas. "I like teamwork" isn't counted, but "So, like, I..." is.

## Auto-stop when you stop talking
`scripts/live_mic.py` measures loudness every 20ms. Once you've been quiet for 1.5s (`--silence`), it ends the answer and uploads it. Noise blips under 0.7s are ignored so they don't use quota. In a loud room, use `--threshold 0.05` or earbuds. A browser frontend can do the same with a Web Audio `AnalyserNode`.

## Answers for "Open decisions"
- **Does the model keep fillers?** Yes. Gemini kept every "um"/"uh" in every test.
- **Model:** `gemini-3.5-flash-lite` takes about 1s and is accurate. `gemini-3.8-flash` was 14–56s, and its free tier is 5 requests/minute and **20/day**. Quotas are per model and per Google project, so each teammate should use their own key.
- **Word timestamps:** not returned, so `longPauses` isn't supported yet.

## Problems hit along the way
| Problem | Fix |
|---|---|
| 404 "gemini-2.5-flash is no longer available to new users" | Use a newer model |
| 403 "Gemini API has not been used in project…" | Open the link in the error and enable the Gemini API, then wait a minute |
| 429 `limit: 20` per day | Daily free quota used up. Switch `GEMINI_TRANSCRIBE_MODEL` or use another key |
| Mic says "speech started" with nobody talking | Room noise. Raise `--threshold` or use earbuds |
