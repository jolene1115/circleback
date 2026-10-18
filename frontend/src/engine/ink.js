// Strokes the user draws on the interviewer, the interviewer's name, and saved interviewer presets.
import {reducedMotion, strokeMoonLine} from './drawing.js';

const INK_KEY = 'cadence-interviewer-ink',
  NAME_KEY = 'cadence-interviewer-name',
  COLLECTION_KEY = 'cadence-interviewer-collection';

export const inkColors = [
  ['Silver', '#e9eef2'],
  ['Ice', '#8cddff'],
  ['Mint', '#9befcb'],
  ['Gold', '#ffda8e'],
  ['Coral', '#ffa4a4'],
  ['Lilac', '#cbb5ff'],
];

const validStrokes = strokes =>
  Array.isArray(strokes) &&
  strokes.length <= 150 &&
  strokes.every(
    s =>
      s &&
      inkColors.some(c => c[1] === s.color) &&
      Array.isArray(s.points) &&
      s.points.length <= 2000 &&
      s.points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)),
  );

let ink = [],
  name = '';
try {
  name = (localStorage.getItem(NAME_KEY) || '').slice(0, 40);
} catch {}
try {
  const saved = JSON.parse(localStorage.getItem(INK_KEY) || '[]');
  // Older saves stored bare point lists.
  const migrated = Array.isArray(saved) ? saved.map(s => (Array.isArray(s) ? {color: inkColors[0][1], points: s} : s)) : [];
  if (validStrokes(migrated)) ink = migrated;
} catch {}

const listeners = new Set();
export const getInk = () => ink;
export const getInterviewerName = () => name;
export function onInterviewerChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Save strokes and name. Throws if storage fails. */
export function saveInterviewer(nextInk, nextName) {
  localStorage.setItem(INK_KEY, JSON.stringify(nextInk));
  localStorage.setItem(NAME_KEY, nextName);
  ink = structuredClone(nextInk);
  name = nextName;
  listeners.forEach(fn => fn());
}

export function loadCollection() {
  try {
    const data = JSON.parse(localStorage.getItem(COLLECTION_KEY) || '[]');
    if (!Array.isArray(data)) return [];
    return data.filter(
      p => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.voice === 'string' && validStrokes(p.ink),
    );
  } catch {
    return [];
  }
}

/** Save the collection. Returns false if storage is full. */
export function saveCollection(next) {
  try {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

/**
 * Paint strokes. `blend` (0-1) fades them out as the figure becomes a waveform; `transform`
 * maps each point the same way the figure is moving.
 */
export function paintInk(c, strokes, blend = 0, time = 0, transform = null) {
  const opacity = Math.max(0, 1 - blend / 0.7) ** 2;
  if (opacity === 0) return;
  c.save();
  c.strokeStyle = '#e9eef2';
  c.lineWidth = 2.2;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.globalAlpha = 1;
  for (const stroke of strokes) {
    const points = stroke.points;
    c.beginPath();
    points.forEach(([x, y], i) => {
      const u = Math.max(0, Math.min(1, (x - 120) / 760)),
        envelope = Math.sin(Math.PI * u) ** 1.6,
        pulse = reducedMotion.matches ? 0.55 : 0.5 + 0.25 * Math.sin(time * 2.1) + 0.18 * Math.sin(time * 4.3);
      const wave =
        250 +
        envelope * (Math.sin(u * Math.PI * 12 - time * 5) * 55 + Math.sin(u * Math.PI * 21 + time * 2.3) * 16) * pulse;
      const p = transform ? transform({x, y}, i, points.length) : {x, y: y * (1 - blend) + wave * blend};
      i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
      if (points.length === 1) c.lineTo(p.x + 0.1, p.y);
    });
    const color = [0, 1, 2].map(v => {
      const original = parseInt(stroke.color.slice(1 + v * 2, 3 + v * 2), 16);
      return Math.round(original + ([233, 238, 242][v] - original) * Math.min(1, blend / 0.5));
    });
    strokeMoonLine(c, 'rgb(' + color.join(',') + ')', opacity);
  }
  c.restore();
}
