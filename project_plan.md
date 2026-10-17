# Project Plan: AI Speaking Practice

> Living document. Update the checkboxes and the "Open decisions" section as we go.

## 1. What we're building

A website where students practice speaking and get AI feedback. Two modes:

- **Interview practice:** AI generates a question from the user's scenario, the user answers out loud, AI gives feedback.
- **Public speaking practice:** the user gives context and key points, delivers the speech, AI gives feedback (including whether they covered their points).

**Pitch angle:** other tools score you; we help you build confidence. Feedback is encouragement-first (strengths before suggestions).

**Judges:** university professors and industry professionals. They value a working demo, evidence it helps, and honesty about limitations.

## 2. Scope

**MVP (focus now)**

- [ ] Home page with Start button
- [ ] Choose category page (Interview / Public Speaking)
- [ ] Record audio in the browser
- [x] Transcribe audio (backend: `/api/transcribe`, see docs/transcription.md)
- [ ] Interview mode: generate question, record, feedback, next question
- [ ] Public speaking mode: context + points, record, feedback, try again
- [ ] Save attempts (transcript, metrics, feedback) per user

**Later (after the core works)**

- [ ] Progress page (sessions, minutes practiced, trends)
- [ ] Self-reported confidence rating before/after each session
- [ ] Difficulty levels (30s, 1 min, harder questions)
- [ ] Past answers and feedback history page

**Stretch only if time remains:** follow-up interview questions, STAR check, video/eye contact.

## 3. User flow

```
Home -> Choose category
  |-> Interview:       setup -> question -> record -> feedback -> next question (loop)
  |-> Public speaking: setup (context + points) -> record -> feedback -> try again (loop)
Progress (later): view past answers and feedback
```



## 4. Tech stack (proposed, confirm in Open decisions)

- **Backend:** Python + FastAPI (switched from Next.js API routes). Frontend: TBD
- **AI:** Google AI Studio, Gemini Flash for questions and feedback; a Gemini transcription model for speech-to-text (confirm exact model IDs in the docs)
- **Database:** SQLite for local/demo (see Open decisions about deployment)
- **Secrets:** API keys live in `.env` at the project root, on the server only. Never in frontend code, never committed.



## 5. Folder structure

```
backend/
  main.py                         # FastAPI app (all routes under /api)
  config.py                       # Loads .env
  models.py                       # Shared types (Pydantic): Metrics, Feedback, requests/responses
  routers/
    transcribe.py                 # POST /api/transcribe: audio -> transcript (shared)
    interview.py                  # POST /api/interview/question, /api/interview/feedback
    speaking.py                   # POST /api/speaking/feedback
    sessions.py                   # GET/POST /api/sessions: save / fetch attempts
  services/
    transcribe.py                 # Transcription call
    metrics.py                    # Words/min, filler count (plain code, no LLM)
    gemini.py                     # All Gemini calls (question, feedback)
    prompts.py                    # All prompt templates
    db.py                         # Database client
scripts/
  transcribe_file.py              # Test: send a file to /api/transcribe
  live_mic.py                     # Test: talk into the mic, auto-stops on pause
frontend/                         # TBD (records audio, calls the API)
```



## 6. Data flow

**Interview**

1. User enters type (behavioral or resume deep dive), role/scenario, and resume text if deep dive.
2. `POST /api/interview/question` returns a question.
3. User records. `POST /api/transcribe` returns a transcript.
4. `lib/metrics.ts` computes pace and filler words.
5. `POST /api/interview/feedback` sends question + transcript + metrics, returns feedback JSON.
6. Save the attempt. "Next question" loops to step 2.

**Public speaking**

1. User enters context (audience, occasion, time limit) and key points.
2. Record, transcribe, compute metrics.
3. `POST /api/speaking/feedback` sends context + points + transcript + metrics, returns feedback JSON.
4. Save the attempt. "Try again" loops back to recording.

**Rule:** numbers (pace, fillers, duration) are computed in code, never by the LLM. LLM scores wobble between attempts and would make progress charts meaningless.

## 7. API contracts (agree on these first so everyone can work in parallel)

```ts
// POST /api/interview/question
req:  { type: "behavioral" | "resume", role: string, resumeText?: string }
res:  { question: string }

// POST /api/transcribe   (multipart: audio file)
res:  { transcript: string, durationSec: number, words?: { word: string, start: number, end: number }[] }

// POST /api/interview/feedback
req:  { question: string, transcript: string, metrics: Metrics }
res:  Feedback

// POST /api/speaking/feedback
req:  { context: string, points: string[], transcript: string, metrics: Metrics }
res:  Feedback
```

```ts
type Metrics = {
  durationSec: number;
  wordsPerMinute: number;
  fillerCount: number;
  fillerWords: Record<string, number>;
  longPauses?: number;   // only if word timestamps are available
};

type Feedback = {
  summary: string;
  strengths: string[];        // shown first
  improvements: string[];     // 2-3 specific suggestions
  starCheck?: { situation: boolean; task: boolean; action: boolean; result: boolean };  // interview
  pointsCovered?: { point: string; covered: boolean }[];                                // speaking
};
```

Gemini must return JSON matching `Feedback`. Validate it before using it, and retry once if it's malformed.

## 8. Database schema

- **users:** `id`, `name/email`, `createdAt`
- **sessions:** `id`, `userId`, `mode` (interview|speaking), `setup` (JSON: type, role, context, points), `createdAt`
- **attempts:** `id`, `sessionId`, `question` (interview only), `transcript`, `durationSec`, `metrics` (JSON), `feedback` (JSON), `createdAt`

Don't store audio. The transcript is enough, and it simplifies privacy.

## 9. Build order

1. **Prove the hard part:** record in browser -> transcribe -> show transcript. (Backend 2 + Design)
2. **Transcription test:** record "um, so, like, uh" and check whether the model keeps fillers and returns word timestamps. Results decide how we compute fillers and pauses.
3. **Speaking mode end to end** (no question generation, so simpler).
4. **Interview mode** (adds question step and loop).
5. **Save attempts** to the database.
6. **Integration pass:** run both flows end to end with real recordings.
7. **Later features:** progress page, confidence rating, difficulty levels.
8. **Demo prep:** seed demo account, rehearse, record a backup demo video.



## 10. Open decisions

- [ ] **Deployment target:** laptop demo or public URL? SQLite does not work on Vercel/serverless. If public on serverless, use Turso or Supabase instead.
- [ ] **Login:** real auth (Supabase/Firebase) or anonymous browser-based user ID for now?
- [ ] **Resume input:** paste text (easier) vs PDF upload. Default: paste text.
- [ ] **Interview loop:** new question each time, or follow-up based on the previous answer?
- [ ] **Exact model IDs** for Gemini Flash and the transcription model (check Google AI Studio docs). Transcription: `gemini-3.5-flash-lite` (fast, separate free quota); `gemini-3.8-flash` free tier is only 20 requests/day.
- [x] **Filler words:** does the transcription model keep "um/uh"? (see build order step 2) Yes, kept in every test. No word timestamps, so `longPauses` is not supported yet.



## 11. Conventions

- **Git:** branch per feature (`feature/recorder`, `feature/gemini-feedback`), small PRs, one reviewer.
- **Env vars:** document names in `.env.example`, keep real keys in `.env.local` (git-ignored).
- **Don't commit** the `.db` file (add to `.gitignore`) unless it's intentional seed data.
- **Prompts** live only in `lib/prompts.ts` so they're easy to tune in one place.
- **Feedback tone:** encouraging, specific, and never judgmental about accents or speaking style.



## 12. Evidence and demo plan (for judges)

- [ ] Recruit 5-8 classmates: each does a session, retries once, rates confidence 1-5 before/after.
- [ ] One slide with before/after numbers, reported honestly.
- [ ] Seed a demo account with 8-10 past sessions so progress looks meaningful.
- [ ] Demo with short recordings (20-30 seconds) to keep feedback fast.
- [ ] Pre-recorded backup demo video in case Wi-Fi or mic fails.

**Limitations slide:** we coach habits (pace, fillers, structure), not overall speaking quality. AI feedback can be wrong. We shouldn't penalize accents. State how recordings and transcripts are stored and deleted.

## 13. Competitors (for the "how is this different?" question)

Yoodli, Orai, Speeko, Speakfect, SpeakBold, Orato, Cadency. Pace and filler feedback is common across all of them. Our difference: confidence-first design, gradual practice, and (later) progress tied to self-reported confidence. Verify competitor claims before putting them on a slide.