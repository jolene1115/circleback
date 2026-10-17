# PitchPerfect — Transcription API

A small Node backend that turns a speech recording into a **verbatim transcript** (filler words like "um", "uh", "like" kept) using the free Gemini API.

## Setup

1. Install Node.js 20+ (`brew install node` on a Mac).
2. Get a free API key at <https://aistudio.google.com> → **Get API key**.
3. Copy the env file and paste your key into `.env` (it is git-ignored, so never commit it):
   ```bash
   cp .env.example .env
   ```
4. Install dependencies:
   ```bash
   npm install
   ```

## Testing (no frontend needed)

Put a recording in `samples/` (a phone voice memo works). Supported formats: webm, mp3, wav, m4a/mp4, aac, ogg, flac (max 20MB).

**Quickest: the CLI** (no server):
```bash
npm run transcribe -- samples/test.m4a
```

**Through the API:**
```bash
npm run server
```
Then in another terminal:
```bash
curl localhost:3001/api/health
curl -F "audio=@samples/test.m4a" localhost:3001/api/transcribe
```
You can also open `server/requests.http` in VS Code/Cursor (REST Client extension) and click **Send Request**.

## API

`POST /api/transcribe`: multipart form with field `audio`. Returns:
```json
{
  "transcript": "Um, so I, uh, worked on a project where...",
  "fillerWords": [{ "word": "um", "count": 1 }, { "word": "uh", "count": 1 }],
  "wordCount": 9,
  "model": "gemini-3.8-flash",
  "ms": 2140
}
```
Errors come back as `{ "error": "..." }` (400 bad or missing file, 413 too large, 429 free-tier rate limit).

`GET /api/health` → `{ ok, keyConfigured, model }`

From a browser frontend later:
```js
const form = new FormData();
form.append('audio', blob, 'recording.webm'); // blob from MediaRecorder
const res = await fetch('http://localhost:3001/api/transcribe', { method: 'POST', body: form });
const { transcript, fillerWords } = await res.json();
```
