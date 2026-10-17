"""Speaking metrics, computed in plain code (never by the LLM) so they're
consistent between attempts and progress comparisons mean something."""

import re

from backend.models import Metrics

# Each filler: the key it's counted under, and a regex over the lowercased transcript.
# "like" and "so" are only fillers in certain spots ("I like it" isn't one), so they
# count only at the start of a clause or when set off by a comma.
FILLERS: list[tuple[str, re.Pattern]] = [
    ("um", re.compile(r"\bu+m+\b|\berm+\b")),
    ("uh", re.compile(r"\bu+h+\b|\ber+\b")),
    ("ah", re.compile(r"\ba+h+\b")),
    ("hmm", re.compile(r"\bh+m+\b")),
    ("like", re.compile(r"(?:^|[,.!?]\s*)like\b|\blike(?=\s*,)")),
    ("so", re.compile(r"(?:^|[.!?]\s*)so\b|\bso(?=\s*,)")),
    ("you know", re.compile(r"\byou know\b")),
    ("i mean", re.compile(r"\bi mean\b")),
    ("basically", re.compile(r"\bbasically\b")),
    ("actually", re.compile(r"\bactually\b")),
    ("literally", re.compile(r"\bliterally\b")),
]


def count_fillers(transcript: str) -> dict[str, int]:
    text = transcript.lower().replace("’", "'").strip()
    counts = {}
    for key, pattern in FILLERS:
        n = len(pattern.findall(text))
        if n:
            counts[key] = n
    return counts


def count_words(transcript: str) -> int:
    return len(transcript.split())


def compute_metrics(transcript: str, duration_sec: float) -> Metrics:
    filler_words = count_fillers(transcript)
    words = count_words(transcript)
    return Metrics(
        durationSec=duration_sec,
        wordsPerMinute=round(words / (duration_sec / 60)) if duration_sec > 0 else 0,
        fillerCount=sum(filler_words.values()),
        fillerWords=filler_words,
    )
