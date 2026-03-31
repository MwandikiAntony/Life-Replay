"""
Authentication endpoints: register, login, profile, settings.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError

from app.core.security import get_current_user, hash_password, verify_password, create_access_token
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
    """
    Register a new user safely, hashing the password with UTF-8 normalization.
    Returns JWT token on success.
    """
    try:
        # Normalize and hash password
        hashed_pw = hash_password(data.password)

        # Call service to create user
        user = await svc.create_user(
            name=data.name,
            email=data.email,
            hashed_password=hashed_pw
        )

        # Create JWT token
        token = create_access_token(
            {"sub": user.id, "email": user.email, "name": user.name}
        )
        return TokenResponse(access_token=token, token_type="bearer")

    except ValueError as ve:
        # Raised by hash_password if password is empty
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except ValidationError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=ve.errors()
        )
    except Exception as e:
        # Catch duplicate email, Firestore errors, etc.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=TokenResponse)
async def login(
    data: UserLogin,
    svc: UserService = Depends(get_user_service),
):
    """
    Login a user and return JWT token.
    Handles UTF-8 safely in password verification.
    """
    user = await svc.get_user_by_email(data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    token = create_access_token(
        {"sub": user.id, "email": user.email, "name": user.name}
    )
    return TokenResponse(access_token=token, token_type="bearer")


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