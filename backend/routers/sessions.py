"""Save / fetch practice attempts (TODO). Use services/db.py; schema in project_plan.md section 8."""

from fastapi import APIRouter

router = APIRouter(prefix="/sessions")


@router.get("")
async def list_sessions():
    return []


@router.post("")
async def save_session():
    return {}
