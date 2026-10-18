from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from backend.routes.accounts import protect_user_history
from backend.models import NonEmptyText
from backend.services.db import create_user, get_user

router = APIRouter()


class CreateUserRequest(BaseModel):
    name: NonEmptyText


class UserResponse(BaseModel):
    id: str
    name: NonEmptyText
    createdAt: str


@router.post("/api/users", response_model=UserResponse)
def create_user_route(body: CreateUserRequest):
    return create_user(body.name)


@router.get("/api/users/{user_id}", response_model=UserResponse)
def get_user_route(user_id: str, request: Request):
    protect_user_history(user_id, request)
    user = get_user(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user