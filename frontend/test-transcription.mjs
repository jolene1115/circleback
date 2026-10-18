// Chunk timing, request order, stop-flush and duration checks for src/engine/transcription.js.
// Run: node --test frontend/test-transcription.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

import {startLiveTranscript} from './src/engine/transcription.js';

let processor;
class FakeAudioContext {
  sampleRate = 16000;
  destination = {};
  createMediaStreamSource() {
    return {connect() {}, disconnect() {}};
  }
  createScriptProcessor() {
    return (processor = {connect() {}, disconnect() {}});
  }
  createGain() {
    return {gain: {}, connect() {}, disconnect() {}};
  }
  async resume() {}
  async close() {}
}
globalThis.AudioContext = FakeAudioContext;

async function recorder({holdFirst = false} = {}) {
  let release;
  const requests = [],
    text = [];
  let seconds = 0;
  globalThis.fetch = async (url, {body}) => {
    requests.push({url, duration: Number(body.get('durationSec'))});
    const n = requests.length;
    if (holdFirst && n === 1) await new Promise(resolve => (release = resolve));
    return {ok: true, json: async () => ({transcript: `Part ${n}.`})};
  };
  const media = {state: 'recording', addEventListener() {}};
  const live = await startLiveTranscript({}, media, {
    onText: (t, s) => {
      text.push(t);
      seconds += s;
    },
    onFailure: () => assert.fail('transcription failed'),
  });
  return {
    requests,
    text: () => text.join(' '),
    seconds: () => seconds,
    release: () => release(),
    feed(value, secs) {
      processor.onaudioprocess({inputBuffer: {getChannelData: () => new Float32Array(16000 * secs).fill(value)}});
    },
    settle: () => live.settled(),
    stop: () => live.stop(false),
  };
}

test('sends at a natural pause after four seconds', async () => {
  const r = await recorder();
  r.feed(0.1, 3.5);
  r.feed(0, 0.5);
  await r.settle();
  assert.deepEqual(r.requests, [{url: '/api/transcribe', duration: 4}]);
  assert.equal(r.text(), 'Part 1.');
  await r.stop();
});

test('continuous speech keeps eight seconds of context', async () => {
  const r = await recorder();
  r.feed(0.1, 4);
  await r.settle();
  assert.equal(r.requests.length, 0);
  r.feed(0.1, 4);
  await r.settle();
  assert.equal(r.requests[0].duration, 8);
  await r.stop();
});

test('short pauses do not split an early phrase; stopping flushes the remainder once', async () => {
  const r = await recorder();
  r.feed(0.1, 1);
  r.feed(0, 0.5);
  await r.settle();
  assert.equal(r.requests.length, 0);
  await r.stop();
  await r.stop();
  assert.deepEqual(
    r.requests.map(x => x.duration),
    [1.5],
  );
});

test('slow requests remain ordered and final audio is not lost', async () => {
  const r = await recorder({holdFirst: true});
  r.feed(0.1, 3.5);
  r.feed(0, 0.5);
  await new Promise(resolve => setImmediate(resolve));
  r.feed(0.1, 3.5);
  r.feed(0, 0.5);
  r.feed(0.1, 1);
  const stopped = r.stop();
  assert.equal(r.requests.length, 1);
  r.release();
  await stopped;
  assert.deepEqual(
    r.requests.map(x => x.duration),
    [4, 4, 1],
  );
  assert.equal(r.seconds(), 9);
  assert.equal(r.text(), 'Part 1. Part 2. Part 3.');
});
