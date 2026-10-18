// Live transcription: while recording, send WAV chunks to /api/transcribe in order. A chunk is sent at
// the first half-second pause after 2 seconds of audio, or after 3 seconds of continuous speech.

const MIN_CHUNK_SEC = 2,
  MAX_CHUNK_SEC = 3,
  PAUSE_SEC = 0.5,
  QUIET_RMS = 0.008;

function pcmWav(pcm, sampleRate) {
  const buffer = new ArrayBuffer(44 + pcm.length * 2),
    v = new DataView(buffer);
  const text = (offset, value) => {
    for (let i = 0; i < value.length; i++) v.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, pcm.length * 2, true);
  pcm.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * (s < 0 ? 32768 : 32767), true));
  return new Blob([buffer], {type: 'audio/wav'});
}

/**
 * Start transcribing `stream` while `recorder` is recording.
 * handlers.onText(text, seconds) gets each transcribed chunk and its length;
 * handlers.onFailure() is called once if a chunk can't be transcribed.
 * Returns {stop(discard), failed}: stop() flushes the last chunk unless discard is true.
 */
export async function startLiveTranscript(stream, recorder, handlers) {
  const context = new AudioContext({sampleRate: 16000});
  const source = context.createMediaStreamSource(stream),
    processor = context.createScriptProcessor(4096, 1, 1);
  const silent = context.createGain();
  silent.gain.value = 0;
  const state = {parts: [], count: 0, quietSamples: 0, chain: Promise.resolve(), valid: true, requests: new Set(), failed: false, stopping: false};

  function flush() {
    if (!state.count) return;
    const pcm = new Float32Array(state.count);
    let offset = 0;
    for (const part of state.parts) {
      pcm.set(part, offset);
      offset += part.length;
    }
    state.parts = [];
    state.count = 0;
    state.quietSamples = 0;
    state.chain = state.chain.then(async () => {
      if (!state.valid) return;
      const controller = new AbortController();
      state.requests.add(controller);
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const seconds = pcm.length / context.sampleRate;
        const body = new FormData();
        body.append('audio', pcmWav(pcm, context.sampleRate), 'answer.wav');
        body.append('durationSec', String(seconds));
        const response = await fetch('/api/transcribe', {method: 'POST', body, signal: controller.signal});
        if (!response.ok) throw new Error('Transcription unavailable');
        const result = await response.json();
        if (state.valid) handlers.onText(result.transcript || '', seconds);
      } catch {
        if (state.valid) {
          state.failed = true;
          state.valid = false;
          handlers.onFailure();
        }
      } finally {
        clearTimeout(timeout);
        state.requests.delete(controller);
      }
    });
  }

  processor.onaudioprocess = e => {
    if (!state.valid || recorder.state !== 'recording') return;
    const data = new Float32Array(e.inputBuffer.getChannelData(0));
    state.parts.push(data);
    state.count += data.length;
    const rms = Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
    state.quietSamples = rms < QUIET_RMS ? state.quietSamples + data.length : 0;
    const rate = context.sampleRate;
    if (state.count >= rate * MAX_CHUNK_SEC || (state.count >= rate * MIN_CHUNK_SEC && state.quietSamples >= rate * PAUSE_SEC))
      flush();
  };
  source.connect(processor);
  processor.connect(silent);
  silent.connect(context.destination);

  async function stop(discard = false) {
    if (discard) {
      state.valid = false;
      state.requests.forEach(controller => controller.abort());
    }
    if (!state.stopping) {
      state.stopping = true;
      processor.disconnect();
      source.disconnect();
      silent.disconnect();
      processor.onaudioprocess = null;
      context.close().catch(() => {});
      if (!discard) flush();
    }
    await state.chain;
  }
  recorder.addEventListener('stop', () => stop(false), {once: true});
  await context.resume();
  return {
    stop,
    // Exposed for tests: resolves when every chunk sent so far has been transcribed.
    settled: () => state.chain,
    get failed() {
      return state.failed;
    },
  };
}
