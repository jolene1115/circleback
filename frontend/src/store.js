// App state shared by the pages: current view, interview and speech setup, and saved sessions.
import {useSyncExternalStore} from 'react';
import {accountRequest} from './account-api.js';
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
  user: null,
  accountReady: false,
  syncError: '',
  syncing: false,
  view: 'home',
  config: {
    topic: 'Design internship',
    custom: '',
    focus: ['Project experience', 'Teamwork'],
    extra: '',
    context: '',
    rounds: '4',
    tone: 'Supportive',
    feedbackMode: 'summary',
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

export function go(view, {showPracticeChoices = false} = {}) {
  // `navigation` changes on every go(), even to the same view (e.g. the home page resets to its landing state).
  update({view, showPracticeChoices, navigation: (state.navigation || 0) + 1});
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
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
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
    localStorage.setItem(state.user ? accountKey(state.user.id) : SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    saved = false;
  }
  update({sessions, selectedSession: entry});
  go('summary');
  if (!saved) toast('Storage is unavailable. Keep this page open until your interview syncs.');
  if (state.user) syncHistory().catch(() => {});
}


const accountKey = id => 'circleback-account-history-' + id;
let syncPromise = null;

function cachedHistory(id) {
  try { const entries = JSON.parse(localStorage.getItem(accountKey(id)) || '[]'); return Array.isArray(entries) ? entries : []; }
  catch { return []; }
}

export async function syncHistory() {
  if (syncPromise) return syncPromise.then(() => syncHistory());
  const user = state.user;
  if (!user) return;
  update({syncing: true});
  syncPromise = (async () => {
    try {
      const entries = [...state.sessions];
      for (let i = 0; i < entries.length; i += 20) {
        await accountRequest('history', {entries: entries.slice(i, i + 20)});
      }
      const remote = [];
      for (let offset = 0; ; offset += 100) {
        const page = await accountRequest(`history?limit=100&offset=${offset}`);
        remote.push(...page);
        if (page.length < 100) break;
      }
      if (state.user?.id !== user.id) return;
      // Retain any answer completed while the network requests were running.
      const merged = [...new Map([...remote, ...state.sessions].map(s => [s.id, s])).values()];
      merged.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
      try { localStorage.setItem(accountKey(user.id), JSON.stringify(merged)); } catch {}
      update({sessions: merged, syncError: ''});
    } catch (error) {
      if (state.user?.id === user.id) update({syncError: 'History has not synced. ' + error.message});
      throw error;
    } finally { syncPromise = null; if (state.user?.id === user.id) update({syncing: false}); }
  })();
  return syncPromise;
}

async function activate(user) {
  update({user, accountReady: true, sessions: cachedHistory(user.id), selectedSession: null, syncError: ''});
  await syncHistory().catch(() => {});
}

export async function initializeAccount() {
  try { await activate(await accountRequest('me')); }
  catch { update({accountReady: true}); }
}

export async function authenticate(mode, values) {
  if (syncPromise) await syncPromise.catch(() => {});
  await activate(await accountRequest(mode, values));
  go('home', {showPracticeChoices: true});
}

export async function logoutAccount() {
  if (syncPromise) await syncPromise.catch(() => {});
  await accountRequest('logout', {});
  update({user: null, sessions: loadSessions(), selectedSession: null, syncError: ''});
  go('home');
}

export function guestHistoryCount() { return loadSessions().length; }

export async function importGuestHistory() {
  if (!state.user) return;
  const entries = loadSessions();
  for (let i = 0; i < entries.length; i += 20) {
    await accountRequest('history', {entries: entries.slice(i, i + 20)});
  }
  // Only remove the guest copy after every batch is safely stored on the server.
  localStorage.removeItem(SESSIONS_KEY);
  await syncHistory();
}


export function explorePractice() {
  if (state.user) go('home', {showPracticeChoices: true});
  else go('account');
}

export function continueAsGuest() {
  go('home', {showPracticeChoices: true});
}
