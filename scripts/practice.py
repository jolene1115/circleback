"""PitchPerfect in the terminal: pick a practice mode, then go.
Needs the API running (uvicorn) and ffmpeg (brew install ffmpeg).

    .venv/bin/python scripts/practice.py                    asks: interview or public speaking
    .venv/bin/python scripts/practice.py --threshold 0.05   extra options are passed to the mode
"""

import os
import sys

import interview_mic
import speech_mic

MODES = {
    "1": ("Interview practice", "answer AI-generated interview questions", interview_mic),
    "2": ("Public speaking", "give a speech on your own topic and key points", speech_mic),
}


def main():
    print("\n🎤 PitchPerfect: choose a practice mode\n")
    for key, (name, desc, _) in MODES.items():
        print(f"  {key}. {name}: {desc}")
    try:
        choice = ""
        while choice not in MODES:
            choice = input("\nEnter 1 or 2: ").strip()
    except (KeyboardInterrupt, EOFError):
        return print("\nBye!")

    _, _, mode = MODES[choice]
    extra = sys.argv[1:]
    # Use the mic unless --mic or an audio file was given.
    has_input = "--mic" in extra or any(os.path.isfile(a) for a in extra)
    sys.argv = [mode.__file__, *([] if has_input else ["--mic"]), *extra]
    mode.main()


if __name__ == "__main__":
    main()
