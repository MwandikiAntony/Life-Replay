"""
Authentication endpoints: register, login, profile, settings.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.models.schemas import UserRegister, UserLogin, TokenResponse, UserProfile, UserSettings
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])


def get_user_service() -> UserService:
    return UserService()


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    data: UserRegister,
    svc: UserService = Depends(get_user_service),
):
    """Register a new user and return JWT."""
    return await svc.register(data)


@router.post("/login", response_model=TokenResponse)
async def login(
    data: UserLogin,
    svc: UserService = Depends(get_user_service),
):
    """Login and return JWT."""
    return await svc.login(data)


@router.get("/me", response_model=UserProfile)
async def get_me(
    current_user: dict = Depends(get_current_user),
    svc: UserService = Depends(get_user_service),
):
    """Get current user's profile."""
    return await svc.get_profile(current_user["user_id"])


@router.get("/settings", response_model=UserSettings)
async def get_settings(
    current_user: dict = Depends(get_current_user),
    svc: UserService = Depends(get_user_service),
):
    return await svc.get_settings(current_user["user_id"])


@router.put("/settings", response_model=UserSettings)
async def update_settings(
    updates: dict,
    current_user: dict = Depends(get_current_user),
    svc: UserService = Depends(get_user_service),
):
    return await svc.update_settings(current_user["user_id"], updates)
