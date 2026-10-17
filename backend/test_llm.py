"""Minimal Gemini smoke test: generate a question, then grade a sample answer."""

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
        model=MODEL,
        contents=prompt,
    )
    return response.text or ""


def main() -> None:
    load_api_key()
    client = genai.Client()

    question_text = generate_text(client, QUESTION_PROMPT)
    try:
        question = parse_json(question_text)["question"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise ValueError("Could not parse the generated interview question.") from exc

    print(f"Question: {question}")

    feedback_text = generate_text(client, build_feedback_prompt(question, SAMPLE_ANSWER))
    try:
        feedback = parse_json(feedback_text)
        print(f"Strength: {feedback['strength']}")
        print(f"Improvement: {feedback['improvement']}")
        print(f"Retry challenge: {feedback['retry_challenge']}")
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise ValueError("Could not parse structured feedback from the model.") from exc


if __name__ == "__main__":
    main()
