"""FastAPI app. Run from the project root:

    .venv/bin/uvicorn backend.main:app --reload --port 8000

Interactive API docs: http://localhost:8000/docs
"""

import logging
import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.services.db import init_db, NotFoundError, InvalidDataError
from backend.routers import interview, sessions, speaking, transcribe
from backend.routes import users

@asynccontextmanager
async def lifespan(app):
    init_db()
    yield


app = FastAPI(title="PitchPerfect API", lifespan=lifespan)


@app.exception_handler(NotFoundError)
async def missing_record(request, exc):
    return JSONResponse({"error": str(exc)}, status_code=404)


@app.exception_handler(InvalidDataError)
async def invalid_record(request, exc):
    return JSONResponse({"error": str(exc)}, status_code=422)


@app.exception_handler(sqlite3.Error)
async def database_error(request, exc):
    logging.getLogger("uvicorn.error").exception("Database operation failed")
    return JSONResponse({"error": "Database operation failed. Please try again."}, status_code=503)


# Local frontend dev servers (Vite on 5173, Next/React on 3000).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# Keep every error in the same { "error": "..." } shape.
@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    details = "; ".join(f"{'.'.join(str(p) for p in e['loc'][1:])}: {e['msg']}" for e in exc.errors())
    return JSONResponse({"error": f"Invalid request: {details}"}, status_code=422)


@app.get("/api/health")
def health():
    """Checks the Python server is running; does not call Gemini."""
    return {"ok": True}


@app.get("/")
def home():
    return {"message": "Server is running"}



for module in (transcribe, interview, speaking, sessions):
    app.include_router(module.router, prefix="/api")

app.include_router(users.router)
