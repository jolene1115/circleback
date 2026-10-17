"""Send an audio file to POST /api/transcribe and print the result.
Needs the API running (uvicorn).   Usage: .venv/bin/python scripts/transcribe_file.py samples/test.m4a
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import httpx

API_URL = os.getenv("API_URL", "http://localhost:8000")


def probe_duration(path: str):
    """The browser recorder sends its timer as durationSec; here we read it with ffprobe if available."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        return float(out)
    except (OSError, subprocess.CalledProcessError, ValueError):
        return None


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python scripts/transcribe_file.py <path-to-audio-file>")
    path = sys.argv[1]
    if not Path(path).is_file():
        sys.exit(f"File not found: {path}")

    data = {}
    duration = probe_duration(path)
    if duration:
        data["durationSec"] = f"{duration:.2f}"

    try:
        with open(path, "rb") as f:
            res = httpx.post(f"{API_URL}/api/transcribe", files={"audio": (Path(path).name, f)}, data=data, timeout=120)
    except httpx.ConnectError:
        sys.exit(f"Could not reach {API_URL}. Is the API running? (.venv/bin/uvicorn backend.main:app --reload --port 8000)")

    body = res.json()
    if res.status_code != 200:
        sys.exit(f"Error {res.status_code}: {body.get('error')}")
    print(json.dumps(body, indent=2))


if __name__ == "__main__":
    main()
