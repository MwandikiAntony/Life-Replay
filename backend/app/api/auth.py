"""
Authentication endpoints: register, login, profile, settings.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import ValidationError
from app.core.logging import get_logger
from app.core.security import get_current_user, hash_password, verify_password, create_access_token
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
        hashed_pw = hash_password(data.password)
        user = await svc.create_user(
            name=data.name,
            email=data.email,
            hashed_password=hashed_pw
        )
        token = create_access_token({"sub": user.id, "email": user.email, "name": user.name})
        logger.info("User registered successfully", user_id=user.id)
        return TokenResponse(access_token=token, token_type="bearer")
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
    user = await svc.get_user_by_email(data.email)
    if not user:
        logger.warning("Login failed: user not found", email=data.email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(data.password, user.hashed_password):
        logger.warning("Login failed: invalid password", email=data.email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({"sub": user.id, "email": user.email, "name": user.name})
    logger.info("Login successful", user_id=user.id)
    return TokenResponse(access_token=token, token_type="bearer")


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