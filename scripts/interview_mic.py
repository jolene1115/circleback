"""Full interview practice loop in the terminal:
question -> you answer out loud -> transcript + metrics -> AI feedback -> retry or next question.
Needs the API running (uvicorn) and ffmpeg (brew install ffmpeg).

    .venv/bin/python scripts/interview_mic.py --mic
    .venv/bin/python scripts/interview_mic.py --mic --question "Tell me about yourself."
    .venv/bin/python scripts/interview_mic.py samples/test.m4a      answer with a file (runs once)
    --silence 2500     pause (ms) that ends your answer      (default 2500, room to think)
    --threshold 0.05   loudness (0-1) that counts as speech  (default 0.02; raise in loud rooms)
"""

import argparse
import sys

import httpx

from live_mic import API_URL, FRAME_BYTES, FRAME_MS, Listener, print_transcript, say, start_ffmpeg, transcribe


def post(path: str, **kwargs):
    """POST to the API. Returns the JSON body, or None after printing the error."""
    try:
        res = httpx.post(f"{API_URL}/api{path}", timeout=120, **kwargs)
    except httpx.ConnectError:
        sys.exit(f"Could not reach {API_URL}. Is the API running? (.venv/bin/uvicorn backend.main:app --reload --port 8000)")
    body = res.json()
    if res.status_code != 200:
        say(f"❌ {path}: {body.get('error')}")
        return None
    return body


def record_one_answer(args):
    """Listen until the speaker pauses once. Returns (pcm, duration_sec), or None if the input ended first."""
    result = {}
    listener = Listener(args.silence, args.threshold, lambda _id, pcm, duration: result.update(pcm=pcm, duration=duration))
    ffmpeg = start_ffmpeg(args.mic, args.file)
    try:
        while not result and (chunk := ffmpeg.stdout.read(FRAME_BYTES)):
            if len(chunk) == FRAME_BYTES:
                listener.on_frame(chunk)
        if not result:  # file ended mid-answer: feed silence so it finishes
            for _ in range(args.silence // FRAME_MS + 5):
                listener.on_frame(bytes(FRAME_BYTES))
    finally:
        ffmpeg.kill()
        ffmpeg.wait()
    return (result["pcm"], result["duration"]) if result else None


def practice(question: str, args) -> bool:
    """One attempt at a question. Returns False if it failed early."""
    say("", "=" * 70, f"❓ {question}", "=" * 70)
    say("🎤 Answer out loud. Pause when you're done." if args.mic else f"Streaming {args.file}...")

    answer = record_one_answer(args)
    if not answer:
        say("No answer heard.")
        return False
    pcm, duration = answer

    body = transcribe(1, pcm, duration)
    if not body:
        return False
    print_transcript(1, body)
    if not body["transcript"].strip():
        say("No words detected, so there's nothing to give feedback on. Try again, closer to the mic.")
        return False

    say("💬 Getting feedback...")
    fb = post("/interview/feedback", json={"question": question, "transcript": body["transcript"], "metrics": body["metrics"], "sessionId": args.session_id})
    if fb:
        star = fb["star_check"]
        star_line = "  ".join(f"{'✓' if star[k] else '✗'} {k.title()}" for k in ("situation", "task", "action", "result"))
        lines = [
            f"\n✅ Strength:    {fb['strength']}",
            f"🔧 Improve:     {fb['improvement']}",
            f"✍️  Try saying:  {fb['example_rewrite']}",
            f"⭐ STAR:        {star_line}",
        ]
        if fb.get("delivery_tip"):
            lines.append(f"🗣  Delivery:    {fb['delivery_tip']}")
        lines.append(f"🔁 Next try:    {fb['retry_challenge']}")
        say(*lines)
    return bool(fb)


def main():
    parser = argparse.ArgumentParser(description="Interview practice: question, answer, transcript, feedback")
    parser.add_argument("file", nargs="?", help="audio file to use as your answer (runs once)")
    parser.add_argument("--mic", action="store_true", help="answer with the Mac's default microphone")
    parser.add_argument("--user-id", help="reuse an existing user for history")
    parser.add_argument("--name", default="Practice user", help="name when creating a user")
    parser.add_argument("--question", help="use this question instead of generating one (saves Gemini quota)")
    parser.add_argument("--silence", type=int, default=2500, help="pause (ms) that ends your answer")
    parser.add_argument("--threshold", type=float, default=0.02, help="loudness (0-1) that counts as speech")
    args = parser.parse_args()
    if not args.mic and not args.file:
        parser.error("use --mic or give an audio file")

    user_id = args.user_id
    if not user_id:
        user = post("/users", json={"name": args.name})
        if not user:
            return
        user_id = user["id"]
    session = post("/sessions", json={"userId": user_id, "mode": "interview", "setup": {}})
    if not session:
        return
    args.session_id = session["id"]
    say(f"History user ID: {user_id}", f"Session: {args.session_id}")
    question = args.question
    try:
        while True:
            if not question:
                say("\nGetting a question...")
                q = post("/interview/question")
                if not q:
                    return
                question = q["question"]

            practice(question, args)
            if not args.mic:
                return

            choice = input("\n[Enter] next question   [r] retry this one   [q] quit: ").strip().lower()
            if choice == "q":
                return
            if choice != "r":
                question = None
    except (KeyboardInterrupt, EOFError):
        say("\nBye!")


if __name__ == "__main__":
    main()
