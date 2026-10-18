"""Vercel entrypoint for the backend service (see vercel.json).

On Vercel the `backend/` folder is deployed as the top level, but the code imports itself as
`backend.*` (as it does locally, run from the project root). Register this folder as the
`backend` package, then expose the FastAPI app. Locally, keep using:

    .venv/bin/uvicorn backend.main:app --reload --port 8000
"""

import importlib.util
import sys
from pathlib import Path

if "backend" not in sys.modules:
    here = Path(__file__).resolve().parent
    spec = importlib.util.spec_from_file_location(
        "backend", here / "__init__.py", submodule_search_locations=[str(here)]
    )
    package = importlib.util.module_from_spec(spec)
    sys.modules["backend"] = package
    spec.loader.exec_module(package)

from backend.main import app  # noqa: E402
from backend.routes import accounts  # noqa: E402
from backend.services.db import init_db  # noqa: E402

# Create tables on each cold start (safe to repeat), in case the platform skips the lifespan hook.
init_db()
accounts.init_accounts()

__all__ = ["app"]
