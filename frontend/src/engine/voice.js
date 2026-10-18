// Browser speech synthesis with a remembered voice choice (local English voices only).

const KEY = 'cadence-browser-voice';
const listeners = new Set();
let preference = '',
  generation = 0;
try {
  preference = localStorage.getItem(KEY) || '';
} catch {}

function notify() {
  listeners.forEach(fn => fn());
}

export function voices() {
  return (window.speechSynthesis?.getVoices() || []).filter(v => v.localService && /^en([-_]|$)/i.test(v.lang));
}

export const voiceId = v => v.voiceURI + '|' + v.lang;

export function currentVoice() {
  const list = voices();
  return (
    list.find(v => voiceId(v) === preference) ||
    list.find(v => v.name === 'Karen' && /^en[-_]AU$/i.test(v.lang)) ||
    list.find(v => v.default) ||
    list[0]
  );
}

export function selectVoice(value) {
  preference = value;
  try {
    localStorage.setItem(KEY, value);
  } catch {}
  notify();
}

export function stopVoice() {
  generation++;
  window.speechSynthesis?.cancel();
}

/** Speak callbacks.text. Supports onstart, onboundary, onend and onerror callbacks. */
export async function speak(callbacks) {
  stopVoice();
  const run = generation,
    synth = window.speechSynthesis;
  if (!synth || !window.SpeechSynthesisUtterance) {
    callbacks.onerror?.({error: 'unavailable'});
    return;
  }
  if (!voices().length)
    await new Promise(resolve => {
      const ready = () => {
        clearTimeout(timer);
        synth.removeEventListener('voiceschanged', ready);
        resolve();
      };
      const timer = setTimeout(ready, 1500);
      synth.addEventListener('voiceschanged', ready);
    });
  if (run !== generation) return;
  const voice = currentVoice();
  if (!voice) {
    callbacks.onerror?.({error: 'voice-unavailable'});
    return;
  }
  const u = new SpeechSynthesisUtterance(callbacks.text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.92;
  u.pitch = 1;
  for (const event of ['start', 'boundary', 'end', 'error'])
    u['on' + event] = e => {
      if (run === generation) callbacks['on' + event]?.(e);
    };
  synth.speak(u);
}

/** Subscribe to voice list or preference changes. Returns an unsubscribe function. */
export function onVoicesChange(fn) {
  listeners.add(fn);
  window.speechSynthesis?.addEventListener('voiceschanged', fn);
  return () => {
    listeners.delete(fn);
    window.speechSynthesis?.removeEventListener('voiceschanged', fn);
  };
}

window.addEventListener('storage', e => {
  if (e.key === KEY) {
    preference = e.newValue || '';
    notify();
  }
});
window.addEventListener('pagehide', stopVoice);
