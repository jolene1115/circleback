# zothacks-2026-team10

PitchPerfect: practice interviews and public speaking, get AI feedback. See [project_plan.md](project_plan.md).

The backend is **Python + FastAPI** in `backend/`.

## Setup

1. Install Python 3.12+ and `ffmpeg` (for the mic test script): `brew install ffmpeg`
2. Get a free Gemini key at <https://aistudio.google.com/app/apikey>.
3. Copy the env template and paste your key into `.env` (it's git-ignored):
   ```bash
   cp .env.example .env
   ```
4. Create the virtual environment and install packages:
   ```bash
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   ```

## Run the API

From the project root:
```bash
.venv/bin/uvicorn backend.main:app --reload --port 8000
```
- API: <http://localhost:8000/api/...>
- Interactive docs, where you can try every endpoint in the browser: <http://localhost:8000/docs>

## Testing transcription (no frontend needed)

With the API running, in a second terminal:
```bash
.venv/bin/python scripts/transcribe_file.py samples/your-recording.m4a
.venv/bin/python scripts/live_mic.py --mic --threshold 0.05 --silence 2000
```
The second command lets you talk; it auto-stops when you pause. Details: [docs/transcription.md](docs/transcription.md).
