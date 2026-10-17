"""Live mic test: talk, pause, and each answer is sent to POST /api/transcribe.
Needs the API running (uvicorn) and ffmpeg (brew install ffmpeg).

    .venv/bin/python scripts/live_mic.py --mic                 talk into your Mac's mic (Ctrl+C to quit)
    .venv/bin/python scripts/live_mic.py samples/test.m4a      stream a file as if it were live
    --silence 2000     pause (ms) that ends an answer        (default 1500)
    --threshold 0.05   loudness (0-1) that counts as speech  (default 0.02; raise in loud rooms)

Stop detection: measure loudness every 20ms, end the answer after N ms of quiet.
A browser frontend can do the same with a Web Audio AnalyserNode.
"""

import argparse
import array
import io
import math
import os
import subprocess
import sys
import threading
import wave
from concurrent.futures import ThreadPoolExecutor

import httpx

API_URL = os.getenv("API_URL", "http://localhost:8000")
SAMPLE_RATE = 16000
FRAME_MS = 20
FRAME_BYTES = SAMPLE_RATE * FRAME_MS // 1000 * 2
PREROLL_MS = 300  # keep audio from just before speech so the first word isn't clipped
MIN_SPEECH_MS = 700  # ignore blips (coughs, door slams) so they don't use Gemini quota

print_lock = threading.Lock()


def say(*lines):
    with print_lock:
        print(*lines, sep="\n", flush=True)


def rms(frame: bytes) -> float:
    samples = array.array("h", frame)  # 16-bit signed, little-endian on Mac
    return math.sqrt(sum(s * s for s in samples) / len(samples)) / 32768


def pcm_to_wav(pcm: bytes) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm)
    return buf.getvalue()


def send_answer(answer_id: int, pcm: bytes, duration_sec: float):
    try:
        res = httpx.post(
            f"{API_URL}/api/transcribe",
            files={"audio": (f"answer-{answer_id}.wav", pcm_to_wav(pcm), "audio/wav")},
            data={"durationSec": str(duration_sec)},
            timeout=120,
        )
        body = res.json()
    except httpx.ConnectError:
        return say(f"❌ Could not reach {API_URL}. Is the API running?")
    if res.status_code != 200:
        return say(f"❌ [#{answer_id}] {body.get('error')}")
    m = body["metrics"]
    fillers = ", ".join(f"{w}×{n}" for w, n in m["fillerWords"].items()) or "none"
    say(
        f'📝 [#{answer_id}] "{body["transcript"]}"',
        f"   {m['wordsPerMinute']} wpm, {m['fillerCount']} fillers ({fillers}), {body['ms']}ms",
    )


class Listener:
    def __init__(self, silence_ms: int, threshold: float, pool: ThreadPoolExecutor):
        self.silence_ms = silence_ms
        self.threshold = threshold
        self.pool = pool
        self.preroll: list[bytes] = []
        self.frames: list[bytes] = []
        self.speaking = False
        self.silent_ms = 0
        self.loud_ms = 0
        self.answer = 0

    def on_frame(self, frame: bytes):
        loud = rms(frame) > self.threshold
        if not self.speaking:
            self.preroll.append(frame)
            if len(self.preroll) > PREROLL_MS // FRAME_MS:
                self.preroll.pop(0)
            if loud:
                self.speaking = True
                self.silent_ms = 0
                self.loud_ms = FRAME_MS
                self.frames, self.preroll = self.preroll, []
                self.answer += 1
                say(f"\n🎙  [#{self.answer}] speech started")
            return
        self.frames.append(frame)
        self.silent_ms = 0 if loud else self.silent_ms + FRAME_MS
        if loud:
            self.loud_ms += FRAME_MS
        if self.silent_ms >= self.silence_ms:
            self.finish()

    def finish(self):
        trailing = self.silent_ms // FRAME_MS
        speech = self.frames[: len(self.frames) - trailing]  # drop the trailing quiet
        voiced, answer_id = self.loud_ms, self.answer
        self.speaking, self.frames, self.silent_ms, self.loud_ms = False, [], 0, 0

        if voiced < MIN_SPEECH_MS:
            return say(f"   [#{answer_id}] ignored (too short, probably noise)")
        pcm = b"".join(speech)
        duration = round(len(pcm) / (SAMPLE_RATE * 2), 2)
        say(f"⏹  [#{answer_id}] stopped, {duration}s of speech. Transcribing...")
        self.pool.submit(send_answer, answer_id, pcm, duration)


def main():
    parser = argparse.ArgumentParser(description="Live mic transcription test")
    parser.add_argument("file", nargs="?", help="audio file to stream as if live")
    parser.add_argument("--mic", action="store_true", help="use the Mac's default microphone")
    parser.add_argument("--silence", type=int, default=1500, help="pause (ms) that ends an answer")
    parser.add_argument("--threshold", type=float, default=0.02, help="loudness (0-1) that counts as speech")
    args = parser.parse_args()
    if not args.mic and not args.file:
        parser.error("use --mic or give an audio file")

    pcm_args = ["-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "s16le", "-loglevel", "error", "-"]
    source = ["-f", "avfoundation", "-i", ":0"] if args.mic else ["-re", "-i", args.file]  # ":0" = default mic
    try:
        ffmpeg = subprocess.Popen(["ffmpeg", *source, *pcm_args], stdout=subprocess.PIPE)
    except FileNotFoundError:
        sys.exit("ffmpeg not found. Install it with: brew install ffmpeg")

    say("Listening... start talking (Ctrl+C to quit)" if args.mic else f"Streaming {args.file}...")
    with ThreadPoolExecutor(max_workers=4) as pool:
        listener = Listener(args.silence, args.threshold, pool)
        try:
            while chunk := ffmpeg.stdout.read(FRAME_BYTES):
                if len(chunk) == FRAME_BYTES:
                    listener.on_frame(chunk)
            # File finished: feed silence so the last answer ends.
            for _ in range(args.silence // FRAME_MS + 5):
                listener.on_frame(bytes(FRAME_BYTES))
        except KeyboardInterrupt:
            ffmpeg.kill()
        # Leaving the "with" waits for pending transcripts.


if __name__ == "__main__":
    main()
