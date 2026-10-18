"""Prompt templates, kept in one place so they're easy to tune.
(The interview prompts are still in backend/test_llm.py.)"""

from typing import Optional

from backend.test_llm import describe_delivery


def describe_timing(duration_sec: Optional[float], time_limit_sec: Optional[int]) -> str:
    if not time_limit_sec or not duration_sec:
        return "No time limit given."
    diff = duration_sec - time_limit_sec
    if diff > 0:
        return f"Time limit {time_limit_sec}s; they spoke {duration_sec:.0f}s, which is {diff:.0f}s OVER."
    return f"Time limit {time_limit_sec}s; they spoke {duration_sec:.0f}s ({-diff:.0f}s under, fine)."


def build_speaking_feedback_prompt(
    context: str,
    points: list[str],
    transcript: str,
    metrics: Optional[dict] = None,
    time_limit_sec: Optional[int] = None,
) -> str:
    points_text = "\n".join(f"{i}. {p}" for i, p in enumerate(points, 1)) or "(none given; judge clarity of the message)"
    return f"""You are an encouraging but specific public speaking coach for a college student.
They delivered a speech out loud; the text below is a verbatim transcript, so filler words are expected.

What they told you before speaking:
- Topic and context (audience, occasion): {context}
- Key points they intended to make:
{points_text}

Speech (verbatim transcript):
"{transcript}"

Delivery (measured by code, trust these numbers):
{describe_delivery(metrics)}
- Timing: {describe_timing((metrics or {}).get("durationSec"), time_limit_sec)}

How to give feedback:
- Judge against THEIR goal: would this audience, on this occasion, understand and remember the message?
- pointsCovered: one entry per key point above, in the same order, using the point's text.
  covered = true only if the point was clearly made (not just hinted at). evidence = quote the words that
  cover it, or say briefly what was missing.
- Be specific. Quote their exact words (in quotes) when praising or critiquing.
- strengths: 1-2 real strengths, each quoting the words that show it.
- improvements: 2-3 changes, most important first. Consider: missed key points, structure
  (clear opening that states the topic, logical order, a closing that sums up or calls to action),
  vague wording, and whether the tone fits the audience.
- exampleRewrite: rewrite ONE sentence from the speech so it lands better for this audience.
  Keep it true to what they said; use [placeholders] instead of inventing facts.
- deliveryTip: only if pace, filler words or timing were flagged above, one tip naming the actual
  number. Otherwise null.
- nextTry: one short instruction for their next attempt.
- summary: one sentence overall, encouraging and honest.
- Tone: warm and direct, like a mentor. Never comment on accent or speaking style.
"""
