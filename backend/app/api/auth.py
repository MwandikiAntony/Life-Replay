"""
Authentication endpoints: register, login, profile, settings.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.core.logging import get_logger
from app.core.security import get_current_user, create_access_token
from app.models.schemas import UserRegister, UserLogin, TokenResponse, UserProfile, UserSettings
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)


def get_user_service() -> UserService:
    return UserService()


# ─── Register ───────────────────────────────────────────────
@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    data: UserRegister,
    request: Request,
    svc: UserService = Depends(get_user_service),
):
    logger.info("Register request received", payload=data.dict(), client=str(request.client))
    try:
        # Use new UserService.register method
        token_response = await svc.register(data)
        logger.info("User registered successfully", user_id=token_response.user.user_id)
        return token_response
    except Exception as e:
        logger.error("Registration failed", error=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ─── Login ────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(
    data: UserLogin,
    request: Request,
    svc: UserService = Depends(get_user_service),
):
    logger.info("Login request received", payload=data.dict(), client=str(request.client))
    try:
        # Use new UserService.login method
        token_response = await svc.login(data)
        logger.info("Login successful", user_id=token_response.user.user_id)
        return token_response
    except HTTPException as e:
        logger.warning("Login failed", detail=e.detail)
        raise e
    except Exception as e:
        logger.error("Unexpected login error", error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ─── Get current user ──────────────────────────────────────
@router.get("/me", response_model=UserProfile)
async def get_me(
    current_user: dict = Depends(get_current_user),
    request: Request = None,
    svc: UserService = Depends(get_user_service),
):
    logger.info("Get /me called", user_id=current_user.get("user_id"))
    profile = await svc.get_profile(current_user["user_id"])
    logger.info("Profile retrieved", user_id=current_user.get("user_id"))
    return profile


# ─── Get user settings ────────────────────────────────────
@router.get("/settings", response_model=UserSettings)
async def get_settings(
    current_user: dict = Depends(get_current_user),
    request: Request = None,
    svc: UserService = Depends(get_user_service),
):
    logger.info("Get /settings called", user_id=current_user.get("user_id"))
    settings = await svc.get_settings(current_user["user_id"])
    logger.info("Settings retrieved", user_id=current_user.get("user_id"))
    return settings


# ─── Update user settings ─────────────────────────────────
@router.put("/settings", response_model=UserSettings)
async def update_settings(
    updates: dict,
    current_user: dict = Depends(get_current_user),
    request: Request = None,
    svc: UserService = Depends(get_user_service),
):
    logger.info("Update /settings called", user_id=current_user.get("user_id"), updates=updates)
    updated = await svc.update_settings(current_user["user_id"], updates)
    logger.info("Settings updated", user_id=current_user.get("user_id"))
    return updated