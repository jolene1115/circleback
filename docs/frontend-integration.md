# Cadence UI integration

The UI uses React 19 + Vite. Build the frontend first:

```sh
cd frontend
npm install
npm run build
```

Then run from the repository root:

```sh
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Open http://127.0.0.1:8001/. FastAPI serves the React build and API on
the same origin. Do not open the HTML as a file or use the old port 8793 server.

For frontend development use `npm run dev` in frontend; Vite proxies /api to
port 8001. Rebuild and restart FastAPI when first creating frontend/dist.

The whole UI is React. Pages and the interview room are components in `src/`
(`App.jsx`, `room/InterviewRoom.jsx`, `Review.jsx`, `components/`); shared state
(view, setup, saved sessions) lives in `src/store.js`. Imperative browser work is
in plain ES modules under `src/engine/` that the components call:

- `figure.js`: the animated line interviewer (canvas loop, blinking, gestures,
  pointer gaze, waveform while speaking); `drawing.js` and `ink.js` for shared
  drawing code and the user's drawings/saved interviewers.
- `voice.js` (browser speech), `mic.js` (microphone, kept alive between rounds),
  `transcription.js` (8-second WAV chunks to /api/transcribe), `api.js`, `toast.js`.

Styling is unchanged: the CSS files in `public/` are loaded by `index.html`.

The UI uses local browser English voices. Interviewer drawings, saved characters
and completed session feedback are kept in this browser's localStorage. They do
not sync between browsers or ports. Live recordings only remain until reload.

The setup checkbox discloses that audio and answers are sent to the AI service.
Set GEMINI_API_KEY in the ignored .env file. Only Gemini is supported.
Interview text and transcription default to gemini-3.5-flash-lite;
override with GEMINI_LLM_MODEL and GEMINI_TRANSCRIBE_MODEL if needed.
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

The latest team backend includes Public Speaking feedback and database sessions.
This UI currently connects Interview; its History still uses browser storage.
The new database/user endpoints remain available for the next integration step.
Transcription is chunked, not word-level streaming; chunk boundaries may affect
recognition. Browser voices vary by device. Cloud tests need a configured key
and may consume the project's quota. Automated integration tests mock Gemini.
