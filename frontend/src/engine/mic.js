// Microphone access. The first stream is kept (muted) for the whole interview so the browser
// doesn't ask for permission again each round; each recording gets its own clone.

let source = null,
  pending = null,
  epoch = 0;

export const recordingSupported = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

export async function acquireMicStream() {
  const myEpoch = epoch;
  if (!source?.getAudioTracks().some(track => track.readyState === 'live')) {
    if (!pending) pending = navigator.mediaDevices.getUserMedia({audio: true});
    const request = pending;
    let stream;
    try {
      stream = await request;
    } finally {
      if (pending === request) pending = null;
    }
    if (myEpoch !== epoch) {
      stream.getTracks().forEach(track => track.stop());
      throw new DOMException('Interview ended', 'AbortError');
    }
    source = stream;
    // Keep permission alive between rounds without sending live samples to a recorder.
    source.getTracks().forEach(track => {
      track.enabled = false;
    });
  }
  const copy = source.clone();
  copy.getTracks().forEach(track => {
    track.enabled = true;
  });
  return copy;
}

/** Release the microphone completely (when leaving the interview). */
export function closeMic() {
  epoch++;
  source?.getTracks().forEach(track => track.stop());
  source = null;
  pending = null;
}

window.addEventListener('pagehide', closeMic);
