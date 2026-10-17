"""Shared request/response shapes. These follow the API contracts in project_plan.md (section 7)."""

from typing import Annotated, Optional

from pydantic import BaseModel, StringConstraints

NonEmptyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class Metrics(BaseModel):
    durationSec: float
    wordsPerMinute: int
    fillerCount: int
    fillerWords: dict[str, int]
    longPauses: Optional[int] = None  # only if word timestamps are available


class StarCheck(BaseModel):
    situation: bool
    task: bool
    action: bool
    result: bool


class PointCovered(BaseModel):
    point: str
    covered: bool
    evidence: Optional[str] = None  # the words from the speech that cover it, or what was missing


class Word(BaseModel):
    word: str
    start: float
    end: float


# POST /api/transcribe
class TranscribeResponse(BaseModel):
    transcript: str
    durationSec: float
    words: Optional[list[Word]] = None
    # Extras, so callers don't have to compute metrics themselves:
    metrics: Metrics
    model: str
    ms: int


# POST /api/interview/question  (no request body)
class QuestionResponse(BaseModel):
    question: NonEmptyText


# POST /api/interview/feedback
class InterviewFeedbackRequest(BaseModel):
    question: NonEmptyText
    transcript: NonEmptyText  # the "transcript" field from /api/transcribe
    metrics: Optional[Metrics] = None  # optional: pass /api/transcribe's metrics through


class InterviewFeedbackResponse(BaseModel):
    strength: NonEmptyText
    improvement: NonEmptyText
    example_rewrite: NonEmptyText  # one of their sentences, rewritten the way a strong candidate would say it
    retry_challenge: NonEmptyText
    star_check: StarCheck
    delivery_tip: Optional[str] = None  # only when pace or filler words were off


# POST /api/speaking/feedback
class SpeakingFeedbackRequest(BaseModel):
    context: NonEmptyText  # topic, audience, occasion, e.g. "5-min class presentation on recycling for classmates"
    points: list[NonEmptyText] = []  # key points they intend to make
    transcript: NonEmptyText  # the "transcript" field from /api/transcribe
    metrics: Optional[Metrics] = None  # optional: pass /api/transcribe's metrics through
    timeLimitSec: Optional[int] = None  # optional target length


class TimeCheck(BaseModel):
    """Computed in code, not by the LLM."""

    limitSec: int
    durationSec: float
    overBySec: float  # negative = under the limit


class SpeakingFeedbackResponse(BaseModel):
    summary: NonEmptyText  # one-sentence overall take
    strengths: list[str]  # shown first
    improvements: list[str]  # 2-3 specific suggestions
    pointsCovered: list[PointCovered]
    exampleRewrite: NonEmptyText  # one of their sentences, rewritten to land better
    deliveryTip: Optional[str] = None  # only when pace, filler words or timing were off
    nextTry: NonEmptyText  # what to focus on in the next attempt
    timeCheck: Optional[TimeCheck] = None
