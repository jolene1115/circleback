// App state shared by the pages: current view, interview setup, and saved sessions.
import {useSyncExternalStore} from 'react';
import {toast} from './engine/toast.js';

const SESSIONS_KEY = 'cadence-sessions-v1';

export const topicOptions = [
  ['Design internship', 'Projects & creative thinking', 'pen-tool'],
  ['First job interview', 'Experience & motivation', 'briefcase-business'],
  ['Graduate school', 'Research & aspirations', 'graduation-cap'],
  ['Leadership role', 'People & decision-making', 'users'],
];
export const focusOptions = ['Project experience', 'Teamwork', 'Problem solving', 'Motivation'];

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
  sessions: loadSessions(),
  selectedSession: null,
  // A new interview gets a new id, so the room starts fresh.
  interview: {id: 0, opening: ''},
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

/** Open the interview room with this first question. */
export function startInterview(opening) {
  update({interview: {id: state.interview.id + 1, opening}});
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

/** "Practice again": set up a new interview on the same topic. */
export function retrySession(session) {
  useSessionConfig(session);
  go('setup');
}

/** "Retry this question": start an interview with that question. */
export function retryQuestion(session, question) {
  useSessionConfig(session);
  configure({rounds: '1'});
  startInterview(question);
}

/** Save a finished interview and show its review. */
export function finishSession(turns) {
  const entry = {
    id: String(Date.now()),
    topic: currentTopic(),
    date: new Date().toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}),
    focus: focusList(),
    context: state.config.context,
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
