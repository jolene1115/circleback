// App state shared by the pages: current view, interview and speech setup, and saved sessions.
import {useSyncExternalStore} from 'react';
import {toast} from './engine/toast.js';

const SESSIONS_KEY = 'cadence-sessions-v1';

function loadSessions() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

let state = {
  view: 'home',
  config: {
    topic: 'Design internship',
    custom: '',
    focus: ['Project experience', 'Teamwork'],
    extra: '',
    context: '',
    rounds: '4',
    tone: 'Supportive',
  },
  // Public speaking setup: what the speech is about, the points to make, optional limit (seconds).
  speech: {context: '', points: [], timeLimitSec: ''},
  sessions: loadSessions(),
  selectedSession: null,
  // A new practice session gets a new id, so the room starts fresh. mode: 'interview' | 'speaking'.
  interview: {id: 0, opening: '', mode: 'interview'},
};
const listeners = new Set();

function update(changes) {
  state = {...state, ...changes};
  listeners.forEach(fn => fn());
}

export function getState() {
  return state;
}

export function useAppState() {
  return useSyncExternalStore(
    fn => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );
}

export const currentTopic = (config = state.config) => config.custom.trim() || config.topic;
export const focusList = (config = state.config) => [...config.focus, ...(config.extra ? [config.extra] : [])];

export function go(view) {
  // `navigation` changes on every go(), even to the same view (e.g. the home page resets to its landing state).
  update({view, navigation: (state.navigation || 0) + 1});
  window.scrollTo({top: 0, behavior: 'instant'});
}

export function configure(values) {
  update({config: {...state.config, ...values}});
}

export function configureSpeech(values) {
  update({speech: {...state.speech, ...values}});
}

/** Open the interview room with this first question. */
export function startInterview(opening) {
  update({interview: {id: state.interview.id + 1, opening, mode: 'interview'}});
  go('room');
}

/** Open the room to practice the speech set up in `state.speech`. */
export function startSpeech() {
  update({interview: {id: state.interview.id + 1, opening: state.speech.context.trim(), mode: 'speaking'}});
  go('room');
}

export function selectSession(session) {
  update({selectedSession: session});
  go('summary');
}

function useSessionConfig(session) {
  configure({
    custom: session.topic,
    context: session.context || '',
    focus: session.focus || [],
    extra: '',
  });
}

/** "Practice again": set up a new session on the same topic. */
export function retrySession(session) {
  if (session.mode === 'speaking') {
    configureSpeech({context: session.context || '', points: session.focus || [], timeLimitSec: session.timeLimitSec || ''});
    go('speaking');
    return;
  }
  useSessionConfig(session);
  go('setup');
}

/** "Retry this question": start an interview with that question. */
export function retryQuestion(session, question) {
  useSessionConfig(session);
  configure({rounds: '1'});
  startInterview(question);
}

/** Save a finished session and show its review. */
export function finishSession(turns) {
  const speaking = state.interview.mode === 'speaking';
  const {speech, config} = state;
  const entry = {
    id: String(Date.now()),
    mode: speaking ? 'speaking' : 'interview',
    topic: speaking ? speech.context.trim() : currentTopic(),
    date: new Date().toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}),
    focus: speaking ? speech.points : focusList(),
    context: speaking ? speech.context : config.context,
    ...(speaking && speech.timeLimitSec ? {timeLimitSec: Number(speech.timeLimitSec)} : {}),
    turns: [...turns],
  };
  const sessions = [entry, ...state.sessions];
  let saved = true;
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    saved = false;
  }
  update({sessions, selectedSession: entry});
  go('summary');
  if (!saved) toast('Storage is unavailable. This session lasts until you close the page.');
}
