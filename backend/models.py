"""Shared request/response shapes. These follow the API contracts in project_plan.md (section 7)."""

from typing import Annotated, Optional, Literal, Any

from pydantic import BaseModel, StringConstraints, Field, ConfigDict

NonEmptyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


NonNegativeInt = Annotated[int, Field(ge=0)]
NonNegativeFloat = Annotated[float, Field(ge=0, allow_inf_nan=False)]


class Metrics(BaseModel):
    durationSec: NonNegativeFloat
    wordsPerMinute: NonNegativeInt
    fillerCount: NonNegativeInt
    fillerWords: dict[str, NonNegativeInt]
    longPauses: Optional[NonNegativeInt] = None  # only if word timestamps are available


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


class InterviewContext(BaseModel):
    topic: str = Field(default="Software internship", max_length=160)
    context: str = Field(default="", max_length=3000)
    focus: list[str] = Field(default_factory=list, max_length=20)
    tone: str = Field(default="Supportive", max_length=80)
    history: list[dict[str, str]] = Field(default_factory=list, max_length=8)


# POST /api/interview/feedback
class InterviewFeedbackRequest(BaseModel):
    sessionId: Optional[NonEmptyText] = None
    question: NonEmptyText
    transcript: NonEmptyText  # the "transcript" field from /api/transcribe
    metrics: Optional[Metrics] = None  # optional: pass /api/transcribe's metrics through
    interview: Optional[InterviewContext] = None


class InterviewFeedbackResponse(BaseModel):
    strength: NonEmptyText
    improvement: NonEmptyText
    # Extras: the AI always returns these, but they're optional so 3-field clients/saves still validate.
    example_rewrite: Optional[str] = None  # one of their sentences, rewritten the way a strong candidate would say it
    retry_challenge: NonEmptyText
    star_check: Optional[StarCheck] = None
    delivery_tip: Optional[str] = None  # only when pace or filler words were off


# POST /api/speaking/feedback
class SpeakingFeedbackRequest(BaseModel):
    sessionId: Optional[NonEmptyText] = None  # when set, the attempt is saved to this session
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


class CreateSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    userId: NonEmptyText
    mode: Literal["interview", "speaking"]
    setup: dict[str, Any] = Field(default_factory=dict)


class SessionResponse(CreateSessionRequest):
    id: str
    createdAt: str


class SaveAttemptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: Optional[NonEmptyText] = None
    transcript: NonEmptyText
    metrics: Metrics
    feedback: InterviewFeedbackResponse | SpeakingFeedbackResponse


class AttemptResponse(SaveAttemptRequest):
    id: str
    sessionId: str
    durationSec: NonNegativeFloat
    createdAt: str
