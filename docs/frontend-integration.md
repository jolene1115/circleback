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
remain in this browser's localStorage. Guest interview history is also local.
Signed-in interviews sync through /api/account/history to the shared SQLite database.
Existing guest interviews can be imported explicitly from the Profile page; logging in
alone does not claim them. Live recordings only remain until reload.

The setup checkbox discloses that audio and answers are sent to the AI service.
Set GEMINI_API_KEY in the ignored .env file. Only Gemini is supported.
Interview text and transcription default to gemini-3.5-flash-lite;
override with GEMINI_LLM_MODEL and GEMINI_TRANSCRIBE_MODEL if needed.
Keys stay on the server. No key or audio is included in the frontend assets.

## Connected flow

- POST /api/interview/question accepts an optional context body: topic, context,
  focus, tone, history. Calls without a body still work.
- PCM microphone chunks become WAV multipart uploads to /api/transcribe after
  two seconds when a half-second quiet interval is detected, at three seconds
  during continuous speech, and at stop. Partial transcripts appear in order.
  Shorter chunks mean more Gemini requests (about 20 per minute of speech),
  which uses free-tier quota faster.
- POST /api/interview/feedback receives question, transcript and optional
  interview context/history. Its retry_challenge becomes the next question.
- Strengths and improvements are saved with each turn and displayed in History.
- Recorded duration is accumulated from captured PCM samples. The server computes
  average pace and possible filler words from that duration and the transcript;
  the frontend saves these metrics with each answer for the delivery section.
- Optional star_check and delivery_tip fields add structure and verbal organization
  coaching. Both star_check and each dimension can be null (not assessed), distinct
  from false (missing detail). Non-STAR questions must not fail validation.
- Feedback can be previewed without API calls at /?theme=moon&preview=feedback.
  Preview data is labeled as sample feedback. Old answers without metrics show
  missing-data states; pronunciation, intonation and pause timing are not assessed.
- API failures show a retryable error; they do not substitute sample AI results.

## Remaining limits

The latest team backend includes Public Speaking feedback and database sessions.
This UI currently connects Interview. Signed-in History uses private account storage;
local copies are retained for network-error recovery. The older /api/sessions endpoints
remain available to terminal clients and enforce ownership for registered users.
Transcription is chunked, not word-level streaming; chunk boundaries may affect
recognition. Browser voices vary by device. Cloud tests need a configured key
and may consume the project's quota. Automated integration tests mock Gemini.

## Canvas lifecycle and interaction

Figure and InterviewRoom use layout-effect cleanup so the old animation stops
before the new canvas mounts. A passive cleanup can cancel the new room's first
frame, leaving the interviewer invisible. Keep drawing transformations shared
between the figure and custom ink. Welcome gestures, pointer attention and
listening transitions respect prefers-reduced-motion.

Run `node --test frontend/test-transcription.mjs` for chunk timing, request order,
stop-flush and captured-duration checks. Backend API tests cover feedback schema
validation, computed metrics and persistence without live Gemini requests.


## Accounts and cross-device history

The header's **Log in / Sign up** opens email/password registration and login. Login
uses an HTTP-only SameSite cookie with a 30-day expiry. Passwords use salted PBKDF2;
only session-token hashes are persisted. Login/signup requests are rate limited.
This implementation does not yet provide email verification or password recovery.

- `POST /api/account/signup`: `{name, email, password}` (password: 10–128 characters).
- `POST /api/account/login`: `{email, password}`.
- `GET /api/account/me`: current profile, or 401.
- `POST /api/account/logout`: revoke this browser's login.
- `GET /api/account/history?limit=100&offset=0`: this account's saved interviews.
- `POST /api/account/history`: `{entries: [...]}`; retries use immutable interview IDs.
  Entries match the React review shape (`id`, `topic`, `date`, optional `createdAt`,
  `focus`, `context`, and `turns` with `q`, `a`, `feedback`). This is an archive of
  completed UI interviews; it is separate from the older sessions/attempts API.

Signed-in interviews are cached under an account-specific browser key and uploaded
when finished. Profile → Refresh history retries failed uploads and retrieves updates
from other devices. Failures are visible, and the local copy is preserved. Logout
clears the displayed account history and returns to guest history. It does not erase
account-specific recovery copies on that device. Import guest interviews only on a
trusted device and only into their owner's account. Successful imports are idempotent.

Both devices must visit **the same hosted website and backend database**. Two independently
started localhost servers have different databases and cannot synchronize. Deploy the
built frontend and backend together, use HTTPS, set `COOKIE_SECURE=true`, and set
`DATABASE_PATH` to an absolute file path on a persistent disk. Keep one SQLite backend
instance (or use a shared production database before scaling to multiple instances).
The disk must retain the database and its WAL files across application restarts.
Do not expose the development server or the SQLite file as static assets.

Verification:
```sh
.venv/bin/python -m unittest discover -s backend/tests -v
.venv/bin/python -m unittest backend.test_ui_integration -v
node --test frontend/test-accounts.mjs frontend/test-transcription.mjs
```
Test real-device sync by creating an account in one browser, saving an interview,
then logging into that same account in another browser/device at the same URL.
The second browser's History should contain the interview. A different account
should see an empty history. Test the import with a browser that already has guest
interviews and confirm logging in alone does not move them.

### Planned Vercel frontend deployment

Vercel does not support a durable local SQLite database in its functions:
https://vercel.com/kb/guide/is-sqlite-supported-in-vercel.
Do not deploy this backend on Vercel with `DATABASE_PATH` pointing to a local file.

For this version, deploy the Python backend on a service with a persistent disk,
and deploy React on Vercel. Once you have that backend's HTTPS URL:

1. Set the Vercel project's Root Directory to `frontend`.
2. Copy `frontend/vercel.example.json` to `frontend/vercel.json`, replace
   `https://YOUR-PERSISTENT-BACKEND.example` with the actual backend origin,
   and commit that completed configuration. The example is deliberately inactive.
3. On the backend, configure `GEMINI_API_KEY`, `DATABASE_PATH` on its persistent
   volume, `COOKIE_SECURE=true`, and `APP_ORIGIN=https://your-site.vercel.app`
   (the exact public frontend origin). Do not expose secrets through Vite variables.
4. Start the backend with `uvicorn backend.main:app --host 0.0.0.0 --port <host-port>`.
5. Deploy/redeploy the Vercel frontend. All browser calls stay at `/api/...` and
   Vercel proxies them to the backend. Cookies remain HTTP-only and scoped to the
   frontend website. Profile and history responses must never be cached by a CDN.
6. Verify signup, login, logout, guest import, history after backend restart, and
   account isolation from two separate browsers at the final HTTPS URL.

Vercel supports external rewrites for this arrangement:
https://vercel.com/docs/routing/rewrites.
If the whole backend must also run on Vercel, migrate SQLite to a durable external
database first; the current code is not configured for that deployment model.
