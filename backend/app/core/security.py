"""
JWT-based authentication and security utilities.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import unicodedata

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """
    Hash a password safely, normalizing it to NFC UTF-8 form.
    Handles special characters and prevents encoding errors.
    """
    if not password:
        raise ValueError("Password cannot be empty")
    normalized = unicodedata.normalize("NFC", password)
    return pwd_context.hash(normalized)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verify a password against a hash, safely handling UTF-8 characters.
    """
    normalized = unicodedata.normalize("NFC", plain)
    return pwd_context.verify(normalized, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token with expiration.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_expire_minutes)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """
    Decode a JWT access token and return its payload.
    Raises HTTPException if token is invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency to get the currently authenticated user.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    return {"user_id": user_id, "email": payload.get("email"), "name": payload.get("name")}


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[dict]:
    """
    FastAPI dependency to get an optional authenticated user (or None).
    """
    if not credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None