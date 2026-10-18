"""Public speaking practice in the terminal:
describe your topic + key points -> give the speech out loud -> transcript + metrics
-> feedback on whether you got your message across -> try again.
Needs the API running (uvicorn) and ffmpeg (brew install ffmpeg).

    .venv/bin/python scripts/speech_mic.py --mic          asks for your topic and points first
    .venv/bin/python scripts/speech_mic.py --mic \\
        --context "2-min class presentation on recycling for classmates" \\
        --point "why recycling matters" --point "how campus recycles" --time-limit 120
    .venv/bin/python scripts/speech_mic.py samples/speech.m4a --context "..." --point "..."   (runs once)

Speeches have deliberate pauses, so recording runs until you press Enter (not on silence).
"""

import argparse
import sys
import threading

import httpx

from live_mic import API_URL, FRAME_BYTES, FRAME_MS, SAMPLE_RATE, print_transcript, rms, say, start_ffmpeg, transcribe

EDGE_MS = 300  # keep a little audio around the speech when trimming silence


def post(path: str, **kwargs):
    """POST to the API. Returns the JSON body, or None after printing the error."""
    try:
        res = httpx.post(f"{API_URL}/api{path}", timeout=180, **kwargs)
    except httpx.ConnectError:
        sys.exit(f"Could not reach {API_URL}. Is the API running? (.venv/bin/uvicorn backend.main:app --reload --port 8000)")
    body = res.json()
    if res.status_code != 200:
        say(f"❌ {path}: {body.get('error')}")
        return None
    return body


def trim_silence(pcm: bytes, threshold: float) -> bytes:
    """Cut quiet audio before the first and after the last loud frame, so duration = speaking time."""
    frames = [pcm[i : i + FRAME_BYTES] for i in range(0, len(pcm) - FRAME_BYTES + 1, FRAME_BYTES)]
    loud = [i for i, f in enumerate(frames) if rms(f) > threshold]
    if not loud:
        return b""
    edge = EDGE_MS // FRAME_MS
    return b"".join(frames[max(0, loud[0] - edge) : loud[-1] + edge + 1])


def record_speech(args) -> bytes:
    """Mic: record until Enter. File: read the whole file."""
    ffmpeg = start_ffmpeg(args.mic, args.file)
    if not args.mic:
        say(f"Using {args.file}...")
        pcm = ffmpeg.stdout.read()
        ffmpeg.wait()
        return trim_silence(pcm, args.threshold)

    chunks: list[bytes] = []
    reader = threading.Thread(target=lambda: chunks.extend(iter(lambda: ffmpeg.stdout.read(4096), b"")), daemon=True)
    reader.start()
    input("🔴 Recording... give your speech, then press Enter when you're done. ")
    ffmpeg.kill()  # kill (not terminate) so ffmpeg doesn't print "Broken pipe" noise
    ffmpeg.wait()
    reader.join(timeout=2)
    return trim_silence(b"".join(chunks), args.threshold)


def ask_setup():
    say("", "Describe your speech. Include the topic, audience and occasion.",
        "  e.g. 2-minute class presentation on campus recycling for my classmates")
    context = ""
    while not context:
        context = input("Context: ").strip()
    say("Key points you want to make (one per line, empty line to finish):")
    points = []
    while point := input(f"  {len(points) + 1}. ").strip():
        points.append(point)
    limit = input("Time limit in seconds (optional, Enter to skip): ").strip()
    return context, points, int(limit) if limit.isdigit() else None


def print_feedback(fb: dict):
    lines = [f"\n📋 {fb['summary']}"]
    if fb["pointsCovered"]:
        lines.append("\n🎯 Key points:")
        for p in fb["pointsCovered"]:
            lines.append(f"   {'✓' if p['covered'] else '✗'} {p['point']}" + (f"  ({p['evidence']})" if p.get("evidence") else ""))
    lines.append("\n✅ Strengths:")
    lines += [f"   • {s}" for s in fb["strengths"]]
    lines.append("\n🔧 Improve:")
    lines += [f"   {i}. {s}" for i, s in enumerate(fb["improvements"], 1)]
    lines.append(f"\n✍️  Try saying:  {fb['exampleRewrite']}")
    if fb.get("timeCheck"):
        t = fb["timeCheck"]
        over = t["overBySec"]
        lines.append(f"⏱  Time:        {t['durationSec']:.0f}s of {t['limitSec']}s "
                     + (f"({over:.0f}s over)" if over > 0 else f"({-over:.0f}s under)"))
    if fb.get("deliveryTip"):
        lines.append(f"🗣  Delivery:    {fb['deliveryTip']}")
    lines.append(f"🔁 Next try:    {fb['nextTry']}")
    say(*lines)


def practice(context: str, points: list[str], time_limit, args):
    say("", "=" * 70, f"🎤 {context}", *[f"   {i}. {p}" for i, p in enumerate(points, 1)], "=" * 70)
    pcm = record_speech(args)
    if not pcm:
        return say("No speech heard. Check your mic, or try a lower --threshold.")
    duration = round(len(pcm) / (SAMPLE_RATE * 2), 2)
    say(f"⏹  {duration}s of speech. Transcribing...")

    body = transcribe(1, pcm, duration)
    if not body:
        return
    print_transcript(1, body)
    if not body["transcript"].strip():
        return say("No words detected, so there's nothing to give feedback on. Try again, closer to the mic.")

    say("💬 Getting feedback...")
    fb = post("/speaking/feedback", json={
        "context": context,
        "points": points,
        "transcript": body["transcript"],
        "metrics": body["metrics"],
        "timeLimitSec": time_limit,
    })
    if fb:
        print_feedback(fb)


def main():
    parser = argparse.ArgumentParser(description="Public speaking practice: context, speech, transcript, feedback")
    parser.add_argument("file", nargs="?", help="audio file to use as your speech (runs once)")
    parser.add_argument("--mic", action="store_true", help="speak into the Mac's default microphone")
    parser.add_argument("--context", help="topic, audience and occasion (asked interactively if omitted)")
    parser.add_argument("--point", action="append", default=[], help="a key point you want to make (repeatable)")
    parser.add_argument("--time-limit", type=int, help="target length in seconds")
    parser.add_argument("--threshold", type=float, default=0.02, help="loudness (0-1) that counts as speech")
    args = parser.parse_args()
    if not args.mic and not args.file:
        parser.error("use --mic or give an audio file")
    if not args.mic and not args.context:
        parser.error("--context is required when using a file")

    try:
        if args.context:
            context, points, time_limit = args.context, args.point, args.time_limit
        else:
            context, points, time_limit = ask_setup()
        while True:
            practice(context, points, time_limit, args)
            if not args.mic:
                return
            choice = input("\n[Enter] try again   [n] new speech   [q] quit: ").strip().lower()
            if choice == "q":
                return
            if choice == "n":
                context, points, time_limit = ask_setup()
    except (KeyboardInterrupt, EOFError):
        say("\nBye!")


if __name__ == "__main__":
    main()
