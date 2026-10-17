"""Generate interview feedback from transcription JSON or an explicit sample test."""

import argparse
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"
MODEL = "gemini-3.8-flash"

SAMPLE_ANSWER = (
    "On a group project, two teammates disagreed about the tech stack. "
    "I scheduled a short meeting, listed the tradeoffs, and we chose the option "
    "that matched our deadline. After that, we split work clearly and finished on time."
)

QUESTION_PROMPT = """You are an interviewer for a beginner software internship.

Return JSON only, with exactly this key:
- "question": one beginner behavioral interview question
"""


def load_api_key() -> str:
    load_dotenv(ENV_PATH)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError(
            "Missing GEMINI_API_KEY. Add it to the .env file at the project root."
        )
    return api_key


def build_feedback_prompt(question: str, answer: str) -> str:
    return f"""You are a beginner-friendly interview coach.

Interview question:
{question}

Candidate answer:
{answer}

Return JSON only, with exactly these keys:
- "strength": one specific strength in the answer
- "improvement": one specific thing to improve
- "retry_challenge": one follow-up question the candidate should practice next
"""


def parse_json(raw_text: str) -> dict:
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)

    return json.loads(text)


def generate_text(client: genai.Client, prompt: str) -> str:
    response = client.models.generate_content(
        model=os.getenv("GEMINI_LLM_MODEL", MODEL),  # override in .env (free quotas are per model)
        contents=prompt,
    )
    return response.text or ""


def feedback_from_transcription(
    client: genai.Client, question: str, transcription: dict
) -> dict:
    """Evaluate the transcript field returned by Node's /api/transcribe."""
    if not isinstance(question, str) or not question.strip():
        raise ValueError("An interview question is required.")
    if not isinstance(transcription, dict):
        raise ValueError("Transcription must be a JSON object.")
    transcript = transcription.get("transcript")
    if not isinstance(transcript, str) or not transcript.strip():
        raise ValueError("Transcription must contain a non-empty transcript string.")

    feedback_text = generate_text(client, build_feedback_prompt(question, transcript))
    try:
        feedback = parse_json(feedback_text)
        fields = ("strength", "improvement", "retry_challenge")
        if not isinstance(feedback, dict) or any(
            not isinstance(feedback.get(field), str) or not feedback[field].strip()
            for field in fields
        ):
            raise ValueError("Feedback fields must be non-empty strings.")
        return feedback
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        raise ValueError("Could not parse structured feedback from the model.") from exc


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--question", help="The question the user actually answered")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--transcription-file", type=Path, help="JSON saved from /api/transcribe")
    source.add_argument("--sample", action="store_true", help="Run the original sample smoke test")
    args = parser.parse_args()

    if args.transcription_file:
        if not args.question or not args.question.strip():
            parser.error("--question is required with --transcription-file")
        transcription = json.loads(args.transcription_file.read_text(encoding="utf-8"))
    else:
        transcription = {"transcript": SAMPLE_ANSWER}

    client = genai.Client(api_key=load_api_key())
    question = args.question
    if not question:
        question_text = generate_text(client, QUESTION_PROMPT)
        try:
            question = parse_json(question_text)["question"]
        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            raise ValueError("Could not parse the generated interview question.") from exc

    feedback = feedback_from_transcription(client, question, transcription)
    print(json.dumps({"question": question, "feedback": feedback}, indent=2))


if __name__ == "__main__":
    main()
