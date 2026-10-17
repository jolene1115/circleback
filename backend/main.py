"""FastAPI app. Run from the project root:

    .venv/bin/uvicorn backend.main:app --reload --port 8000

Interactive API docs: http://localhost:8000/docs
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.routers import interview, sessions, speaking, transcribe

app = FastAPI(title="PitchPerfect API")

# Let a local frontend (any port) call the API during development.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# Keep every error in the same { "error": "..." } shape.
@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    details = "; ".join(f"{'.'.join(str(p) for p in e['loc'][1:])}: {e['msg']}" for e in exc.errors())
    return JSONResponse({"error": f"Invalid request: {details}"}, status_code=400)


for module in (transcribe, interview, speaking, sessions):
    app.include_router(module.router, prefix="/api")
