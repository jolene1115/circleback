"""Shared request/response shapes. These follow the API contracts in project_plan.md (section 7)."""

from typing import Literal, Optional

from pydantic import BaseModel


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


class Feedback(BaseModel):
    summary: str
    strengths: list[str]  # shown first
    improvements: list[str]  # 2-3 specific suggestions
    starCheck: Optional[StarCheck] = None  # interview
    pointsCovered: Optional[list[PointCovered]] = None  # speaking


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


# POST /api/interview/question
class QuestionRequest(BaseModel):
    type: Literal["behavioral", "resume"]
    role: str
    resumeText: Optional[str] = None


class QuestionResponse(BaseModel):
    question: str


# POST /api/interview/feedback
class InterviewFeedbackRequest(BaseModel):
    question: str
    transcript: str
    metrics: Metrics


# POST /api/speaking/feedback
class SpeakingFeedbackRequest(BaseModel):
    context: str
    points: list[str]
    transcript: str
    metrics: Metrics
