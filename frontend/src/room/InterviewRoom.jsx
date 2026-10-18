import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {ArrowUp, AudioLines, ChevronRight, LoaderCircle, Mic, MicOff, Square, Volume2, VolumeX, X} from 'lucide-react';
import './room-controls.css';

import {request} from '../engine/api.js';
import {
  figureStateLabel,
  getFigureState,
  holdWave,
  mountFigure,
  onFigureState,
  pulseWord,
  setFigureScene,
  setFigureState,
  setVoiceInput,
} from '../engine/figure.js';
import {acquireMicStream, closeMic, recordingSupported} from '../engine/mic.js';
import {toast} from '../engine/toast.js';
import {startLiveTranscript} from '../engine/transcription.js';
import {speak, stopVoice} from '../engine/voice.js';
import {currentTopic, finishSession, focusList, go, useAppState} from '../store.js';
import MiniFeedback from './MiniFeedback.jsx';

// Remembered for the rest of the visit, like the original prototype.
let autoSpeakPreference = true,
  autoRecordPreference = true;

const SAMPLE_ANSWERS = [
  'At a hackathon, I worked with a team to build an interview practice website. I designed the user flow and tested the recording screen with two classmates.',
  'I listened to my teammate, compared both approaches, and tested a simpler flow. We finished the demo on time and learned that testing early helped us agree.',
];
const PRIMARY_ICONS = {'loader-circle': LoaderCircle, square: Square, 'volume-2': Volume2, 'arrow-up': ArrowUp, mic: Mic};

function useFigureState() {
  const [value, setValue] = useState(getFigureState);
  useEffect(() => onFigureState(setValue), []);
  return value;
}

/** Speech practice shows (and speaks) this prompt instead of an interview question. */
const speechPrompt = topic => `Whenever you're ready, give your speech: ${topic}`;
function RoomTool({label, hint = label, children, ...props}) {
  return <button type="button" className="room-tool" aria-label={label} {...props}>
    {children}<span className="room-tool-tip" aria-hidden="true">{hint}</span>
  </button>;
}


/** The practice room. mode 'interview': answer AI questions; 'speaking': rehearse a speech, try again. */
export default function InterviewRoom({opening, mode = 'interview'}) {
  const {config, speech: speechSetup} = useAppState();
  const figureState = useFigureState();
  const speechMode = mode === 'speaking';

  const [question, setQuestion] = useState(speechMode ? speechPrompt(opening) : opening);
  const [turns, setTurns] = useState([]);
  const [answer, setAnswer] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(autoSpeakPreference);
  const [autoRecord, setAutoRecord] = useState(autoRecordPreference);
  // Index of the last spoken character; Infinity shows the whole question.
  const [spokenThrough, setSpokenThrough] = useState(autoSpeakPreference ? -1 : Infinity);
  const [utterance, setUtterance] = useState(false);
  const [mic, setMic] = useState('idle'); // idle | starting | recording
  const [micStatus, setMicStatus] = useState('Optional voice recording');
  const [audioURL, setAudioURL] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null); // {data, last}

  const canvas = useRef(null),
    caption = useRef(null),
    liveAnswer = useRef(null);
  // Values read inside async callbacks and timers.
  const live = useRef({});
  Object.assign(live.current, {question, turns, answer, autoRecord, utterance, mic, feedback});
  const mounted = useRef(true),
    speech = useRef(0),
    timers = useRef({}),
    recorder = useRef(null),
    stream = useRef(null),
    transcript = useRef(null),
    audio = useRef(null),
    micGeneration = useRef(0),
    startingMic = useRef(false),
    answerSeconds = useRef(0);

  const clearTimer = name => {
    clearTimeout(timers.current[name]);
    timers.current[name] = null;
  };

  // --- Interviewer voice ---------------------------------------------------------------------
  const stopSpeech = useCallback(() => {
    stopVoice();
    ['caption', 'record', 'auto', 'start'].forEach(clearTimer);
    setSpokenThrough(Infinity);
    speech.current++;
    setUtterance(false);
    live.current.utterance = false;
    holdWave(0);
    setFigureState('listening');
  }, []);

  const releaseAudio = useCallback(() => {
    setVoiceInput(null);
    audio.current?.close().catch(() => {});
    audio.current = null;
  }, []);

  const showWordsThrough = index => {
    if (Number.isFinite(index)) pulseWord();
    setSpokenThrough(index);
  };

  // --- Microphone ----------------------------------------------------------------------------
  const toggleRecorder = useCallback(async () => {
    if (startingMic.current) return;
    if (recorder.current?.state === 'recording') {
      recorder.current.stop();
      stream.current?.getTracks().forEach(t => t.stop());
      return;
    }
    if (!recordingSupported()) {
      toast('Recording is unavailable in this browser. Please use a browser with microphone support.');
      return;
    }
    startingMic.current = true;
    setMic('starting');
    const generation = ++micGeneration.current;
    setMicStatus('Waiting for microphone...');
    try {
      const acquired = await acquireMicStream();
      if (generation !== micGeneration.current || !mounted.current) {
        acquired.getTracks().forEach(t => t.stop());
        return;
      }
      stream.current = acquired;
      const rec = new MediaRecorder(acquired);
      recorder.current = rec;
      const chunks = [];
      rec.ondataavailable = e => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        acquired.getTracks().forEach(t => t.stop());
        if (generation !== micGeneration.current || !mounted.current) return;
        setMic('idle');
        setAudioURL(old => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(new Blob(chunks, {type: rec.mimeType}));
        });
        setMicStatus('Recorded locally');
      };
      rec.start();
      setMic('recording');
      setMicStatus('Recording · tap to stop');
    } catch {
      if (generation === micGeneration.current) {
        setMic('idle');
        setMicStatus('Microphone unavailable');
        toast('Microphone access failed. Allow microphone access in your browser and retry.');
      }
    } finally {
      startingMic.current = false;
      if (recorder.current?.state !== 'recording') setMic(m => (m === 'starting' ? 'idle' : m));
    }
  }, []);

  /** Start or stop recording; while recording, the figure reacts and the answer is transcribed. */
  const toggleMic = useCallback(async () => {
    if (recorder.current?.state !== 'recording') {
      await transcript.current?.stop(false);
      transcript.current = null;
    }
    stopSpeech();
    releaseAudio();
    await toggleRecorder();
    const rec = recorder.current;
    if (rec?.state !== 'recording' || !stream.current || !mounted.current) return;
    setFigureState('responding');
    try {
      const context = new AudioContext();
      audio.current = context;
      await context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream.current).connect(analyser);
      setVoiceInput(analyser, () => rec.state === 'recording');
    } catch {
      releaseAudio();
      toast('Recording continues; audio-reactive lighting is unavailable.');
    }
    try {
      transcript.current = await startLiveTranscript(stream.current, rec, {
        onText: (text, seconds) => {
          answerSeconds.current += seconds;
          if (!text || !mounted.current) return;
          const next = (live.current.answer.trim() + ' ' + text).trim().slice(0, 5000);
          live.current.answer = next;
          setAnswer(next);
          setError('');
        },
        onFailure: () => {
          if (!mounted.current) return;
          setMicStatus('Transcription unavailable');
          setError('Transcription failed. Stop and record again; part of your answer may be missing.');
          toast('Transcription unavailable. Check the server connection and AI service quota.');
        },
      });
    } catch {
      toast('Live transcription could not start. Stop and retry recording.');
    }
  }, [releaseAudio, stopSpeech, toggleRecorder]);

  /** Stop recording, transcription and speech (but keep mic permission for the next question). */
  const stopEverything = useCallback(() => {
    micGeneration.current++;
    startingMic.current = false;
    releaseAudio();
    stopSpeech();
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
    recorder.current = null;
    setMic('idle');
    transcript.current?.stop(true);
    transcript.current = null;
  }, [releaseAudio, stopSpeech]);

  // --- Asking the question -------------------------------------------------------------------
  const speakQuestion = useCallback(() => {
    if (recorder.current?.state === 'recording') {
      toggleRecorder();
      releaseAudio();
    }
    if (getFigureState() === 'speaking' || live.current.utterance) {
      stopSpeech();
      return;
    }
    stopSpeech();
    const id = speech.current;
    setUtterance(true);
    live.current.utterance = true;
    setFigureState('thinking');
    const finished = () => {
      clearTimer('caption');
      clearTimer('start');
      setSpokenThrough(Infinity);
      setUtterance(false);
      live.current.utterance = false;
    };
    speak({
      text: live.current.question,
      onstart: () => {
        if (id !== speech.current || !mounted.current) return;
        clearTimer('start');
        setFigureState('speaking');
        showWordsThrough(0);
        // Some voices never report word boundaries; show the whole question if none arrive.
        timers.current.caption = setTimeout(() => setSpokenThrough(Infinity), 1800);
      },
      onboundary: e => {
        if (id !== speech.current || !mounted.current || e.name !== 'word') return;
        clearTimer('caption');
        showWordsThrough(e.charIndex);
      },
      onend: () => {
        if (id !== speech.current) return;
        finished();
        holdWave(performance.now() + 200);
        setFigureState('listening');
        if (live.current.autoRecord)
          timers.current.record = setTimeout(() => {
            timers.current.record = null;
            if (id === speech.current && mounted.current && !document.hidden && recorder.current?.state !== 'recording')
              toggleMic();
          }, 450);
      },
      onerror: e => {
        if (id !== speech.current) return;
        finished();
        holdWave(0);
        setFigureState('listening');
        if (!['canceled', 'interrupted'].includes(e.error))
          toast('Browser audio could not play. Open the menu and replay the question to retry.');
      },
    });
    timers.current.start = setTimeout(() => {
      if (id === speech.current && getFigureState() !== 'speaking') {
        stopSpeech();
        toast('Audio did not start. Replay the question to retry.');
      }
    }, 8000);
  }, [releaseAudio, stopSpeech, toggleMic, toggleRecorder]);

  // Ask each new question aloud.
  useEffect(() => {
    if (!autoSpeakPreference || document.hidden) return;
    timers.current.auto = setTimeout(() => {
      timers.current.auto = null;
      if (mounted.current && !live.current.feedback) speakQuestion();
    }, 300);
    return () => clearTimer('auto');
  }, [question, turns.length, speakQuestion]);

  // Keep the word being spoken centered when the question is taller than its box.
  useEffect(() => {
    if (!Number.isFinite(spokenThrough)) return;
    const box = caption.current,
      words = box?.querySelectorAll('.moon-word.is-spoken'),
      word = words?.[words.length - 1];
    if (!word || box.scrollHeight <= box.clientHeight + 1) return;
    const b = box.getBoundingClientRect(),
      w = word.getBoundingClientRect();
    box.scrollTo({
      top: Math.max(0, box.scrollTop + (w.top - b.top) - (box.clientHeight - w.height) / 2),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [spokenThrough]);

  // Follow the transcript as it grows.
  useEffect(() => {
    if (liveAnswer.current) liveAnswer.current.scrollTop = liveAnswer.current.scrollHeight;
  }, [answer]);

  // --- Room lifetime -------------------------------------------------------------------------
  useLayoutEffect(() => {
    mounted.current = true;
    document.body.dataset.theme = 'moon';
    document.body.className = 'moon moon-immersive';
    setFigureScene({view: 'room', immersive: true});
    setFigureState('listening');
    const unmount = mountFigure(canvas.current);
    const onVisibility = () => {
      if (document.hidden) stopSpeech();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', onVisibility);
      stopEverything();
      Object.keys(timers.current).forEach(clearTimer);
      closeMic();
      unmount();
    };
  }, [stopEverything, stopSpeech]);

  useEffect(() => () => audioURL && URL.revokeObjectURL(audioURL), [audioURL]);

  // --- Answering -----------------------------------------------------------------------------
  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const pending = transcript.current;
    try {
      if (recorder.current?.state === 'recording') recorder.current.stop();
      await transcript.current?.stop(false);
      transcript.current = null;
      if (!mounted.current) return;
      if (pending?.failed) throw Error('Transcription was incomplete. Please record your answer again.');
      const spoken = live.current.answer.trim();
      if (!spoken) throw Error('No speech transcribed yet. Please record your answer.');
      stopSpeech();
      setFigureState('thinking');
      const durationSec = answerSeconds.current || undefined;
      let result;
      if (speechMode) {
        result = await request('speaking/feedback', {
          context: speechSetup.context.trim(),
          points: speechSetup.points,
          transcript: spoken,
          durationSec,
          timeLimitSec: speechSetup.timeLimitSec ? Number(speechSetup.timeLimitSec) : undefined,
        });
        if (!mounted.current) return;
        if (typeof result.summary !== 'string' || !Array.isArray(result.strengths) || !Array.isArray(result.improvements))
          throw Error('The server returned incomplete feedback. Please try again.');
      } else {
        const history = live.current.turns.map(t => ({question: t.q, answer: t.a}));
        result = await request('interview/feedback', {
          question: live.current.question,
          transcript: spoken,
          interview: {type: config.type || 'behavioral', resumeText: config.type === 'resume' ? config.resumeText : undefined, topic: currentTopic(config), context: config.context, focus: focusList(config), tone: config.tone, history},
          durationSec,
        });
        if (!mounted.current) return;
        if (['strength', 'improvement', 'retry_challenge'].some(k => typeof result[k] !== 'string' || !result[k].trim()))
          throw Error('The server returned incomplete feedback. Please try again.');
      }
      stopEverything();
      // Speech attempts have no question; the summary page labels them "Your speech".
      const turn = {q: speechMode ? '' : live.current.question, a: spoken, feedback: result, metrics: result.metrics};
      const nextTurns = [...live.current.turns, turn];
      setTurns(nextTurns);
      setAnswer('');
      answerSeconds.current = 0;
      setFigureState('listening');
      if (speechMode || config.feedbackMode === 'each') {
        setFeedback({data: result, last: !speechMode && nextTurns.length >= Number(config.rounds)});
      } else {
        continueInterview(result, nextTurns);
      }
    } catch (err) {
      if (mounted.current) {
        setError(err.message);
        setFigureState('listening');
      }
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }

  function nextQuestion() {
    continueInterview(feedback.data, turns);
  }

  function continueInterview(data, completedTurns) {
    setFeedback(null);
    if (completedTurns.length >= Number(config.rounds)) {
      finishSession(completedTurns);
      return;
    }
    if (!speechMode) setQuestion(data.retry_challenge);
    setSpokenThrough(autoSpeakPreference ? -1 : Infinity);
    setMicStatus('Optional voice recording');
    setError('');
    setAudioURL(null);
  }

  function finish() {
    if (!turns.length) {
      toast(speechMode ? 'Give your speech at least once before finishing.' : 'Answer at least one question before finishing.');
      return;
    }
    finishSession(turns);
  }

  function toggleAutoSpeak() {
    const next = !autoSpeak;
    autoSpeakPreference = next;
    setAutoSpeak(next);
    if (recorder.current?.state === 'recording' || startingMic.current) return;
    stopSpeech();
    if (next) speakQuestion();
  }

  // --- Main button ---------------------------------------------------------------------------
  const isRecording = mic === 'recording',
    starting = mic === 'starting',
    speaking = figureState === 'speaking' || utterance,
    spoken = answer.trim();
  const primaryLabel = submitting
    ? 'Processing answer'
    : isRecording
      ? 'Stop recording'
      : speaking
        ? 'Interviewer speaking'
        : starting
          ? 'Starting microphone'
          : spoken
            ? 'Send answer'
            : 'Start recording';
  const primarySymbol = submitting ? 'loader-circle' : isRecording ? 'square' : speaking ? 'volume-2' : spoken ? 'arrow-up' : 'mic';
  const PrimaryIcon = PRIMARY_ICONS[primarySymbol];
  const placeholder = submitting
    ? 'Processing...'
    : speaking
      ? ''
      : starting
        ? 'Starting microphone...'
        : isRecording
          ? "I'm listening. Go ahead..."
          : 'Ready when you are.';

  function onPrimaryClick(e) {
    if (recorder.current?.state !== 'recording' && !live.current.answer.trim()) {
      e.preventDefault();
      toggleMic();
    }
  }

  const words = Array.from(question.matchAll(/\S+/g));
  const focus = focusList(config);
  const muteLabel = autoSpeak ? 'Mute questions' : 'Enable question audio';

  return (
    <div id="app">
      <div className="shell">
        <aside className="sidebar">
          <a
            href="#"
            className="brand"
            data-go="home"
            onClick={e => {
              e.preventDefault();
              go('home');
            }}
          >
            <AudioLines />
            <span>CircleBack</span>
          </a>
          <nav aria-label="Main navigation">
            <button className="nav-item " data-go="home" onClick={() => go('home')}>
              Practice
            </button>
            <button className="nav-item " data-go="history" onClick={() => go('history')}>
              History
            </button>
          </nav>
          <span className="workspace-edition">A little more you.</span>
        </aside>
        <main className="main">
          <header className="topbar">
            <div className="breadcrumb">
              Your workspace <ChevronRight /> <span>Interview</span>
            </div>
            <span className="status">Sample interview</span>
          </header>
          <div className="content">
            <div className="page-head">
              <div>
                <h1>{speechMode ? speechSetup.context : currentTopic(config)}</h1>
                <p>{speechMode ? 'Rehearse, get feedback, try again.' : 'One conversation. One question at a time.'}</p>
              </div>
              <div className="moon-session-controls room-tools" role="group" aria-label="Interview controls">
                <RoomTool label={muteLabel} aria-pressed={autoSpeak} disabled={submitting || !!feedback} onClick={toggleAutoSpeak}>
                  {autoSpeak ? <Volume2 /> : <VolumeX />}
                </RoomTool>
                <RoomTool label="Auto-record after question" hint={'Auto-record: ' + (autoRecord ? 'on' : 'off')} role="switch" aria-checked={autoRecord} onClick={() => {
                  autoRecordPreference = !autoRecord;
                  setAutoRecord(!autoRecord);
                  if (autoRecord) clearTimer('record');
                }}>
                  {autoRecord ? <Mic /> : <MicOff />}
                  <span className="room-tool-state" aria-hidden="true" />
                </RoomTool>
                <span className="room-tools-divider" aria-hidden="true" />
                <RoomTool label="Exit interview" onClick={() => go('home')}><X /></RoomTool>
              </div>
            </div>
            <div className="room-layout">
              <section>
                <div className="section-heading">
                  <span className="small-label">
                    {speechMode
                      ? `Attempt ${turns.length + (feedback ? 0 : 1)}`
                      : `Question ${turns.length + (feedback ? 0 : 1)} of ${config.rounds}`}
                  </span>
                  <span className="sample-label">Sample conversation</span>
                </div>
                <div className="journey">
                  {Array.from({length: speechMode ? 0 : Number(config.rounds)}, (_, i) => (
                    <span key={i} className={i <= turns.length - (feedback ? 1 : 0) ? 'done' : ''} />
                  ))}
                </div>
                <div className="moon-stage ">
                  <canvas
                    ref={canvas}
                    className="moon-canvas"
                    width="1000"
                    height="500"
                    aria-label="Original continuous-line interviewer, morphing into a waveform when speaking"
                  />
                  <div className="moon-caption">
                    <span className="moon-dot" />
                    <span id="moonStatus" role="status">
                      {figureStateLabel(figureState)}
                    </span>
                  </div>
                </div>
                <div className={'moon-dialogue' + (feedback ? ' has-feedback' : '')}>
                  <div className="question-stage">
                    <div className="speaker" hidden>
                      <span className="moon-speaker-icon">
                        <AudioLines />
                      </span>
                      Alex <span className="muted">/ {config.tone}</span>
                    </div>
                    <h2 ref={caption} aria-label={question}>
                      <button type="button" className="question-replay" aria-label={speaking ? 'Stop question audio' : speechMode ? 'Replay prompt' : 'Replay question'} title={speaking ? 'Stop question audio' : speechMode ? 'Replay prompt' : 'Replay question'} disabled={submitting || isRecording || starting || !!feedback} onClick={speakQuestion}>
                      {words.map(match => (
                        <span
                          key={match.index}
                          aria-hidden="true"
                          className={'moon-word' + (match.index <= spokenThrough ? ' is-spoken' : '')}
                          data-start={match.index}
                        >
                          {match[0] + ' '}
                        </span>
                      ))}
                      </button>
                    </h2>
                  </div>
                  <form id="answerForm" onSubmit={submit} style={feedback ? {display: 'none'} : undefined}>
                    <label className="field-label" htmlFor="answer" hidden>
                      Your answer
                    </label>
                    <div className="answer-box">
                      <div
                        id="liveAnswer"
                        ref={liveAnswer}
                        role="status"
                        aria-live="polite"
                        aria-label="Your transcribed answer"
                        className={spoken ? '' : 'is-placeholder'}
                      >
                        {spoken || placeholder}
                      </div>
                      <textarea
                        id="answer"
                        maxLength={5000}
                        placeholder="Type your reply..."
                        aria-label="Your transcribed reply"
                        hidden
                        aria-hidden="true"
                        tabIndex={-1}
                        value={answer}
                        onChange={e => setAnswer(e.target.value)}
                      />
                      <div className="answer-controls">
                        <button
                          type="button"
                          className="icon-button"
                          id="mic"
                          title="Start or stop recording"
                          aria-label={isRecording ? 'Stop recording' : 'Record locally'}
                          onClick={toggleMic}
                        >
                          {isRecording ? <Square /> : <Mic />}
                        </button>
                        <span id="micStatus" className="small-label" role="status">
                          {micStatus}
                        </span>
                        <button
                          type="submit"
                          className={'main-button' + (isRecording ? ' is-recording' : '')}
                          title={primaryLabel}
                          aria-label={primaryLabel}
                          data-symbol={primarySymbol}
                          disabled={submitting || speaking || starting}
                          onClick={onPrimaryClick}
                        >
                          <PrimaryIcon />
                        </button>
                      </div>
                    </div>
                    <p className="error" id="answerError" role="alert">
                      {error}
                    </p>
                    <div id="audioPlayback">
                      {audioURL && <audio style={{width: '100%', marginTop: 12}} controls src={audioURL} />}
                    </div>
                    <p className="field-note">Audio is transcribed through the team server.</p>
                    <button
                      type="button"
                      className="text-button"
                      id="sampleAnswer"
                      hidden
                      onClick={() => {
                        stopSpeech();
                        setAnswer(SAMPLE_ANSWERS[turns.length ? 1 : 0]);
                      }}
                    >
                      Use sample answer
                    </button>
                  </form>
                  {feedback && (
                    <MiniFeedback
                      feedback={feedback.data}
                      answer={turns.at(-1)?.a || ''}
                      last={feedback.last}
                      onContinue={nextQuestion}
                      continueLabel={speechMode ? 'Try again' : undefined}
                      onFinish={speechMode ? () => finishSession(turns) : undefined}
                    />
                  )}
                </div>
              </section>
              <aside className="context-panel">
                <h3>{speechMode ? 'Key points' : 'Your focus'}</h3>
                <div className="tag-list">
                  {(speechMode ? speechSetup.points : focus).map(f => (
                    <span key={f}>{f}</span>
                  ))}
                </div>
                <h3>Your context</h3>
                <p>{(speechMode ? speechSetup.context : config.context) || 'No background added.'}</p>
                <h3>Session notes</h3>
                <p>
                  {turns.length - (feedback ? 1 : 0)} {speechMode ? 'attempts' : 'answers'} so far
                  <br />
                  Reflection at the end
                </p>
                <p className="field-note">Voice stays on this device. Add your answer as text to continue this preview.</p>
              </aside>
            </div>
            <footer className="app-foot">
              <span>Find your voice, one conversation at a time.</span>
              <span>English · CircleBack</span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
