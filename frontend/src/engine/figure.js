// The continuous-line interviewer: one sampled curve that blinks, nods, looks around, follows the
// pointer, and morphs into a waveform while speaking. One canvas is animated at a time.
import {figure, greetingPoints, reducedMotion, strokeMoonLine} from './drawing.js';
import {getInk, paintInk} from './ink.js';

// --- What the figure is doing ------------------------------------------------------------------
let state = 'listening',
  stateAt = 0,
  holdUntil = 0;
const stateListeners = new Set();

// --- Where it is shown ---------------------------------------------------------------------------
let scene = {view: 'home', immersive: false};
let canvas = null,
  animation = 0,
  last = 0,
  helloAt = 0;

// --- Motion state --------------------------------------------------------------------------------
let progress = 0,
  thought = 0,
  eyeThought = 0,
  gaze = 0,
  gazeTarget = 0,
  headGaze = 0,
  gazeY = 0,
  gazeYTarget = 0,
  headGazeY = 0,
  lean = 0,
  returnAt = -10000,
  pointerAt = -10000;
let nextBlink = performance.now() + 2600,
  blinkAt = -10000,
  doubleBlinkAt = -10000,
  attentionAt = -10000;
let voiceSince = 0,
  quietSince = 0,
  lastAck = -10000,
  phraseReady = false,
  nodStrength = 0.7,
  nodDuration = 1000,
  ackGap = 4500;
let previewExpression = 'neutral',
  previewExpressionAt = 0,
  curious = 0,
  unsure = 0,
  warmSmile = 0;
let gesture = 'none',
  gestureAt = -10000,
  nextGesture = performance.now() + 6000,
  gestureSide = 1,
  lastGesture = 'none',
  lastStretch = -30000;

// --- Background and audio-reactive light ---------------------------------------------------------
let analyser = null,
  analyserActive = () => false,
  samples = null,
  level = 0,
  warm = 0,
  light = 0,
  wordPulse = 0,
  presence = 1;
const curtain = document.createElement('canvas');
curtain.width = 140;
curtain.height = 70;
const curtainCtx = curtain.getContext('2d'),
  curtainPixels = curtainCtx.createImageData(140, 70);
let curtainTime = -100;

export function getFigureState() {
  return state;
}

export function figureStateLabel(s = state) {
  return {
    listening: 'Here with you',
    responding: scene.view === 'home' ? 'Your turn · motion preview' : 'Listening to your voice',
    speaking: 'Speaking',
    thinking: 'Thinking · sample transition',
  }[s];
}

/** Subscribe to state changes (listening, speaking, thinking, responding). */
export function onFigureState(fn) {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

export function setFigureState(s) {
  if (s !== state) {
    stateAt = performance.now();
    if (s === 'listening' && state === 'speaking') returnAt = stateAt + 700;
    if (s === 'responding') {
      attentionAt = stateAt;
      lastAck = stateAt;
    }
    voiceSince = quietSince = 0;
    phraseReady = false;
  }
  state = s;
  stateListeners.forEach(fn => fn(s));
}

export function setFigureScene(next) {
  scene = {...scene, ...next};
}

/** Keep the waveform shape briefly after speech ends (ms timestamp from performance.now()). */
export function holdWave(until) {
  holdUntil = until;
}

/** Word boundaries brighten the background a little. */
export function pulseWord() {
  wordPulse = 1;
}

/** Feed microphone audio so the figure reacts while the user talks. */
export function setVoiceInput(node, isActive) {
  analyser = node;
  analyserActive = isActive || (() => false);
  samples = node ? new Float32Array(node.fftSize) : null;
  if (!node) level = 0;
}

export function nod(t) {
  attentionAt = t;
  nodStrength = 0.5 + Math.random() * 0.5;
  nodDuration = 850 + Math.random() * 450;
  ackGap = 4500 + Math.random() * 2500;
}

function gesturePose(t) {
  const quiet = ['listening', 'responding'].includes(state) && !reducedMotion.matches;
  if (!quiet) {
    gesture = 'none';
    nextGesture = t + 5000;
    return {tilt: 0, look: 0, brow: 0, smile: 0, stretch: 0};
  }
  if (t >= nextGesture && t - attentionAt > 1800) {
    const choices = ['tilt', 'look', 'brow', 'smile', ...(t - lastStretch > 22000 ? ['stretch'] : [])].filter(
      value => value !== lastGesture,
    );
    gesture = choices[Math.floor(Math.random() * choices.length)];
    lastGesture = gesture;
    gestureAt = t;
    gestureSide = Math.random() < 0.5 ? -1 : 1;
    if (gesture === 'stretch') lastStretch = t;
    nextGesture = t + 7500 + Math.random() * 5000;
  }
  const phase = Math.max(0, Math.min(1, (t - gestureAt) / 2500));
  const amount = Math.sin(phase * Math.PI) ** 2;
  return {
    tilt: gesture === 'tilt' ? amount * gestureSide : 0,
    look: gesture === 'look' && t - pointerAt > 2000 ? amount * gestureSide : 0,
    brow: gesture === 'brow' ? amount * gestureSide : 0,
    smile: gesture === 'smile' ? amount : 0,
    stretch: gesture === 'stretch' ? amount : 0,
  };
}

// Nod after the speaker finishes a phrase.
function reactToVoice(t, lvl) {
  if (lvl > 0.09) {
    if (!voiceSince) voiceSince = t;
    quietSince = 0;
    if (t - voiceSince > 650) phraseReady = true;
  } else {
    voiceSince = 0;
    if (!quietSince) quietSince = t;
    if (phraseReady && t - quietSince > 350 && t - lastAck > ackGap) {
      nod(t);
      lastAck = t;
      phraseReady = false;
    }
  }
}

function drawBackground(c, t, dt) {
  if (scene.view === 'setup') return;
  const quiet = scene.view === 'room',
    glow = quiet ? 0 : light;
  if (analyser && analyserActive()) {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const v of samples) sum += v * v;
    level += (Math.min(1, Math.sqrt(sum / samples.length) * 9) - level) * 0.18;
  } else level *= 0.9;
  const responding = state === 'responding',
    target = responding ? (scene.view === 'home' ? 0.65 : Math.min(0.9, 0.32 + level)) : 0;
  warm += (target - warm) * (1 - Math.exp(-dt * 2));
  wordPulse *= Math.exp(-dt * 3);
  light += ((state === 'speaking' ? 0.5 + wordPulse * 0.5 : 0) - light) * (1 - Math.exp(-dt * 2));
  if (t - curtainTime > 0.06) {
    curtainTime = t;
    const pixels = curtainPixels.data;
    for (let y = 0; y < 70; y++)
      for (let x = 0; x < 140; x++) {
        const u = x / 139,
          v = y / 69;
        const edge = Math.pow(Math.abs(u - 0.5) * 2, 1.8);
        const sweep = 0.5 + 0.5 * Math.sin(quiet ? u * 3.2 + v * 4.1 - t * 0.14 : u * 4.2 + v * 3.1 - t * 0.32);
        const fold = 0.5 + 0.5 * Math.sin(quiet ? v * 4 - u * 2 + t * 0.11 : v * 5 - u * 3 + t * 0.24);
        const blue = quiet
          ? edge * (0.24 + 0.5 * sweep) + 0.08 * fold
          : edge * (0.2 + 0.5 * sweep) + 0.17 * fold + glow * 0.22 * sweep;
        const warmth =
          warm *
          (quiet
            ? Math.pow(1 - u, 1.6) * (0.3 + 0.65 * fold)
            : (0.3 + 0.7 * Math.sin(u * 2 + v * 3 - t * 0.35) ** 2) * (0.3 + 0.65 * fold));
        const grain = (Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;
        const i = (y * 140 + x) * 4;
        pixels[i] = 14 + blue * 13 + warmth * 150 + glow * 18 * fold + grain * 1.5;
        pixels[i + 1] = 18 + blue * 45 + warmth * 82 + glow * 22 * fold + grain * 1.5;
        pixels[i + 2] = 25 + blue * 91 + warmth * 25 + grain * 1.5;
        pixels[i + 3] = 255;
      }
    curtainCtx.putImageData(curtainPixels, 0, 0);
  }
  c.imageSmoothingEnabled = true;
  c.drawImage(curtain, 0, 0, 1000, 500);
}

// On the landing page the line continues into a waving hand.
function drawGreeting(c, t, anchor) {
  if (!document.body.classList.contains('moon-landing')) return;
  const elapsed = (t - helloAt) / 1000;
  const phase = Math.max(0, Math.min(1, (elapsed - 0.6) / 3));
  const wave = reducedMotion.matches ? 0 : Math.sin(phase * Math.PI * 4) * Math.sin(phase * Math.PI) * 0.1;
  const pivot = {x: 800, y: 375};
  for (const point of greetingPoints) {
    const hand = Math.max(0, Math.min(1, (400 - point.y) / 65)),
      angle = wave * hand;
    const dx = point.x - pivot.x,
      dy = point.y - pivot.y;
    c.lineTo(
      anchor.x + pivot.x + dx * Math.cos(angle) - dy * Math.sin(angle) - 703,
      anchor.y + pivot.y + dx * Math.sin(angle) + dy * Math.cos(angle) - 413,
    );
  }
}

function draw(t) {
  if (!canvas?.isConnected) return;
  const {view} = scene;
  const dt = Math.min((t - last) / 1000 || 0.016, 0.05);
  last = t;
  const goal = (state === 'speaking' && t - stateAt > 130 && thought < 0.16) || t < holdUntil ? 1 : 0;
  progress += (goal - progress) * (1 - Math.exp(-dt * (reducedMotion.matches ? 18 : goal ? 3.8 : 2.7)));
  eyeThought += ((state === 'thinking' ? 1 : 0) - eyeThought) * (1 - Math.exp(-dt * 9));
  thought +=
    ((state === 'thinking' && t - stateAt > 240 ? 1 : 0) - thought) *
    (1 - Math.exp(-dt * (reducedMotion.matches ? 22 : 3.5)));
  gaze += (gazeTarget - gaze) * (1 - Math.exp(-dt * 9));
  headGaze += (gaze - headGaze) * (1 - Math.exp(-dt * 2));
  gazeY += (gazeYTarget - gazeY) * (1 - Math.exp(-dt * 9));
  headGazeY += (gazeY - headGazeY) * (1 - Math.exp(-dt * 2));
  const pose = gesturePose(t);
  const randomExpression = view === 'home' || (view === 'room' && ['listening', 'responding'].includes(state));
  if (randomExpression && !reducedMotion.matches && t >= previewExpressionAt && t - gestureAt > 2800) {
    const choices = ['neutral', 'curious', 'unsure', 'warm'].filter(value => value !== previewExpression);
    previewExpression = choices[Math.floor(Math.random() * choices.length)];
    previewExpressionAt = t + 4000 + Math.random() * 2000;
    nextGesture = Math.max(nextGesture, t + 1800);
  }
  const expression = randomExpression && !reducedMotion.matches ? previewExpression : 'neutral';
  curious += ((expression === 'curious' ? 1 : 0) - curious) * (1 - Math.exp(-dt * 5));
  unsure += ((expression === 'unsure' ? 1 : 0) - unsure) * (1 - Math.exp(-dt * 5));
  warmSmile += ((expression === 'warm' ? 1 : 0) - warmSmile) * (1 - Math.exp(-dt * 5));
  lean += ((state === 'responding' ? 1 : 0) - lean) * (1 - Math.exp(-dt * 2.8));
  if (state === 'responding') reactToVoice(t, view === 'home' ? ((t - stateAt) % 6500 < 3800 ? 0.2 : 0) : level);

  const c = canvas.getContext('2d'),
    w = 1000,
    rect = canvas.getBoundingClientRect(),
    h = (1000 * rect.height) / rect.width || 500;
  const dpr = window.devicePixelRatio || 1,
    pixelWidth = Math.max(1, Math.round(rect.width * dpr)),
    pixelHeight = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  // Keep the drawing coordinates stable while matching the display's physical pixels.
  c.setTransform(pixelWidth / w, 0, 0, pixelHeight / h, 0, 0);
  c.clearRect(0, 0, w, h);
  c.save();
  c.scale(1, h / 500);
  drawBackground(c, reducedMotion.matches ? 0 : t / 1000, dt);
  c.restore();
  c.save();
  const immersive = scene.immersive && view === 'room',
    short = rect.height <= 650,
    scale =
      view === 'setup'
        ? Math.min(1.2, h / 400)
        : Math.min(immersive ? 1.4 : 1, (h * (immersive ? (short ? 0.49 : 0.62) : 1)) / 500);
  c.translate((w - w * scale) / 2, immersive ? h * (short ? 0.31 : 0.37) - 250 * scale : (h - 500 * scale) / 2);
  c.scale(scale, scale);
  if (t > nextBlink) {
    blinkAt = t;
    doubleBlinkAt = Math.random() < 0.18 ? t + 310 : -10000;
    nextBlink = t + 2800 + Math.random() * 3300;
  }
  const blinkPulse = at => Math.sin(Math.max(0, Math.min(1, (t - at) / 190)) * Math.PI);
  const blink = reducedMotion.matches ? 0 : Math.max(blinkPulse(blinkAt), blinkPulse(doubleBlinkAt));
  const attention = reducedMotion.matches
    ? 0
    : Math.sin(Math.min(1, Math.max(0, (t - attentionAt) / nodDuration)) * Math.PI) * nodStrength;
  const returning = reducedMotion.matches ? 0 : Math.sin(Math.min(1, Math.max(0, (t - returnAt) / 1200)) * Math.PI);
  const time = reducedMotion.matches ? 0 : t / 1000,
    blend = progress * progress * (3 - 2 * progress),
    thinking = thought * thought * (3 - 2 * thought),
    nodAmount = reducedMotion.matches ? 0 : (headGaze * 0.035 + attention * 0.04) * (1 - thinking);
  const transformPoint = (p, i, total = figure.length, ink = false) => {
    const u = i / Math.max(1, total - 1),
      eye = Math.max(
        Math.exp(-Math.pow((p.x - 455) / 20, 2) - Math.pow((p.y - 202) / 14, 2)),
        Math.exp(-Math.pow((p.x - 570) / 20, 2) - Math.pow((p.y - 202) / 14, 2)),
      );
    const head = Math.max(0, Math.min(1, (365 - p.y) / 90));
    const mouth = Math.exp(-Math.pow((p.x - 510) / 35, 2) - Math.pow((p.y - 297) / 17, 2));
    const rightEye = Math.exp(-Math.pow((p.x - 570) / 22, 2) - Math.pow((p.y - 202) / 22, 2));
    const leftEye = Math.exp(-Math.pow((p.x - 455) / 22, 2) - Math.pow((p.y - 202) / 22, 2));
    const px =
      p.x -
      500 +
      (-8 * eyeThought + (reducedMotion.matches ? 0 : gaze * 5 + pose.look * 5) + attention * 3 * (1 - thinking)) *
        eye -
      (p.x - 510) * mouth * 0.16 * thinking;
    // Flatten the resting smile locally; expression changes stay on the same curve.
    const py =
      p.y -
      350 -
      (p.y - 202) * blink * 0.93 * eye -
      6 * eyeThought * eye -
      (p.y - 290) * mouth * ((ink ? 0 : 0.72) - 0.45 * warmSmile - 0.18 * pose.smile) -
      rightEye * (8 * curious + 4 * eyeThought) +
      rightEye * 5 * unsure +
      (reducedMotion.matches ? 0 : gazeY * 3 - Math.abs(pose.look) * 3) * eye -
      6 * Math.abs(pose.brow) * (pose.brow > 0 ? rightEye : leftEye);
    // Rotate around the neck; shoulders stay anchored while the face looks upward.
    const tilt = nodAmount + (-0.16 * thinking + 0.045 * curious - 0.06 * unsure + 0.035 * pose.tilt) * head;
    const leaning = reducedMotion.matches ? 0 : lean * head;
    const x = 500 + (px * Math.cos(tilt) - py * Math.sin(tilt)) * (1 + 0.045 * leaning),
      y =
        350 +
        px * Math.sin(tilt) +
        py * Math.cos(tilt) -
        8 * thinking * head +
        (reducedMotion.matches
          ? 0
          : Math.sin(time * 0.9) * 0.8 + attention * 7 * head * (1 - thinking) + leaning * 7 - returning * 5 * head);
    const envelope = Math.pow(Math.sin(Math.PI * u), 1.6),
      pulse = reducedMotion.matches ? 0.55 : 0.5 + 0.25 * Math.sin(time * 2.1) + 0.18 * Math.sin(time * 4.3);
    const wy =
      250 +
      envelope * (Math.sin(u * Math.PI * 12 - time * 5) * 55 + Math.sin(u * Math.PI * 21 + time * 2.3) * 16) * pulse;
    const lookShift = reducedMotion.matches ? 0 : headGaze * 8 * head * (1 - thinking);
    const fx = (x + lookShift) * (1 - blend) + (120 + u * 760) * blend;
    const shoulder = Math.max(0, Math.min(1, (p.y - 335) / 75));
    const fy =
      (y + (reducedMotion.matches ? 0 : headGazeY * 3 * head) - pose.stretch * (head * 4 + shoulder * 5)) *
        (1 - blend) +
      wy * blend;
    return {x: fx, y: fy};
  };
  c.beginPath();
  figure.forEach((p, i) => {
    const {x: fx, y: fy} = transformPoint(p, i);
    i ? c.lineTo(fx, fy) : c.moveTo(fx, fy);
    if (i === figure.length - 1 && view === 'home') drawGreeting(c, t, {x: fx, y: fy});
  });
  presence += ((document.body.classList.contains('moon-exploring') ? 0.07 : 1) - presence) * (1 - Math.exp(-dt * 3));
  strokeMoonLine(c, '#e9eef2', presence);
  if (view === 'room' || view === 'setup')
    paintInk(c, getInk(), blend, time, (p, i, total) => transformPoint(p, i, total, true));
  c.restore();
  animation = requestAnimationFrame(draw);
}

/**
 * Start animating `element`. `options.greet` replays the landing-page wave.
 * Returns a function that stops the animation (if this canvas is still the active one).
 */
export function mountFigure(element, options = {}) {
  cancelAnimationFrame(animation);
  canvas = element;
  last = 0;
  gazeTarget = gazeYTarget = 0;
  if (options.greet) helloAt = performance.now();
  if (canvas && !document.hidden) animation = requestAnimationFrame(draw);
  return () => {
    if (canvas === element) {
      cancelAnimationFrame(animation);
      canvas = null;
    }
  };
}

// The figure looks toward the pointer while it is over the canvas.
document.addEventListener('pointermove', e => {
  if (!canvas?.isConnected || e.pointerType === 'touch') return;
  const r = canvas.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
    gazeTarget = gazeYTarget = 0;
    return;
  }
  pointerAt = performance.now();
  gazeTarget = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
  gazeYTarget = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
});
document.documentElement.addEventListener('pointerleave', () => {
  gazeTarget = gazeYTarget = 0;
});
window.addEventListener('blur', () => {
  gazeTarget = gazeYTarget = 0;
});
// Pause while the tab is hidden.
document.addEventListener('visibilitychange', () => {
  cancelAnimationFrame(animation);
  if (!document.hidden && canvas?.isConnected) {
    last = 0;
    animation = requestAnimationFrame(draw);
  }
});
