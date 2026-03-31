"""
User service: registration, login, profile management via Firestore.
"""
from datetime import datetime
import unicodedata
from typing import Optional

from fastapi import HTTPException, status
from google.cloud.firestore_v1 import AsyncDocumentReference
from google.cloud.firestore_v1 import Increment

from app.core.security import hash_password, verify_password, create_access_token
from app.db.firestore import get_db, Collections
from app.core.logging import get_logger
from app.models.schemas import (
    UserRegister, UserLogin, UserProfile,
    TokenResponse, UserSettings
)

logger = get_logger(__name__)


class UserService:
    def __init__(self):
        self.db = get_db()

    async def create_user(self, name: str, email: str, hashed_password: str) -> UserProfile:
        """Create a new user directly (used internally by /register)."""
        email = unicodedata.normalize("NFC", email.strip().lower())
        name = unicodedata.normalize("NFC", name.strip())

        users_ref = self.db.collection(Collections.USERS)
        existing_docs = await users_ref.where("email", "==", email).get()
        if existing_docs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        user_id = users_ref.document().id
        now = datetime.utcnow()

        user_doc = {
            "user_id": user_id,
            "name": name,
            "email": email,
            "password_hash": hashed_password,
            "created_at": now.isoformat(),
            "avatar_url": None,
            "total_sessions": 0,
            "total_practice_minutes": 0,
        }

        await users_ref.document(user_id).set(user_doc)

        # Initialize default settings
        await self.db.collection(Collections.SETTINGS).document(user_id).set({
            "user_id": user_id,
            "coaching_sensitivity": "medium",
            "show_live_transcript": True,
            "show_confidence_meter": True,
            "auto_start_recording": False,
            "notification_feedback": True,
            "updated_at": now.isoformat(),
        })

        logger.info("User registered", user_id=user_id, email=email)
        return UserProfile(
            user_id=user_id,
            name=name,
            email=email,
            created_at=now
        )

    async def register(self, data: UserRegister) -> TokenResponse:
        """Register via UserRegister schema and return JWT."""
        hashed_pw = hash_password(data.password)
        profile = await self.create_user(data.name, data.email, hashed_pw)
        token = create_access_token({
            "sub": profile.user_id,
            "email": profile.email,
            "name": profile.name
        })
        return TokenResponse(access_token=token, user=profile)

    async def login(self, data: UserLogin) -> TokenResponse:
        """Authenticate a user and return JWT."""
        email = unicodedata.normalize("NFC", data.email.strip().lower())
        users_ref = self.db.collection(Collections.USERS)
        docs = await users_ref.where("email", "==", email).get()
        if not docs:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        user_doc = docs[0].to_dict()
        if not verify_password(data.password, user_doc["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        profile = UserProfile(
            user_id=user_doc["user_id"],
            email=user_doc["email"],
            name=user_doc["name"],
            created_at=datetime.fromisoformat(user_doc["created_at"]),
            avatar_url=user_doc.get("avatar_url"),
            total_sessions=user_doc.get("total_sessions", 0),
            total_practice_minutes=user_doc.get("total_practice_minutes", 0),
        )

        token = create_access_token({
            "sub": user_doc["user_id"],
            "email": user_doc["email"],
            "name": user_doc["name"],
        })
        return TokenResponse(access_token=token, user=profile)

    async def get_profile(self, user_id: str) -> UserProfile:
        """Fetch user profile from Firestore."""
        doc = await self.db.collection(Collections.USERS).document(user_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="User not found")

        data = doc.to_dict()
        return UserProfile(
            user_id=data["user_id"],
            email=data["email"],
            name=data["name"],
            created_at=datetime.fromisoformat(data["created_at"]),
            avatar_url=data.get("avatar_url"),
            total_sessions=data.get("total_sessions", 0),
            total_practice_minutes=data.get("total_practice_minutes", 0),
        )

    async def update_stats(self, user_id: str, session_duration_seconds: int) -> None:
        """Increment user stats after a session completes."""
        doc_ref = self.db.collection(Collections.USERS).document(user_id)
        minutes = session_duration_seconds // 60
        await doc_ref.update({
            "total_sessions": Increment(1),
            "total_practice_minutes": Increment(minutes),
        })

    async def get_settings(self, user_id: str) -> UserSettings:
        """Fetch user settings."""
        doc = await self.db.collection(Collections.SETTINGS).document(user_id).get()
        if not doc.exists:
            return UserSettings(user_id=user_id)
        data = doc.to_dict()
        data["updated_at"] = datetime.fromisoformat(data.get("updated_at", datetime.utcnow().isoformat()))
        return UserSettings(**data)

    async def update_settings(self, user_id: str, updates: dict) -> UserSettings:
        """Update user settings in Firestore."""
        updates["updated_at"] = datetime.utcnow().isoformat()
        await self.db.collection(Collections.SETTINGS).document(user_id).set(updates, merge=True)
        return await self.get_settings(user_id)

    async def get_user_by_email(self, email: str) -> Optional[UserProfile]:
        """Fetch a user by email (used in login)."""
        email = unicodedata.normalize("NFC", email.strip().lower())
        docs = await self.db.collection(Collections.USERS).where("email", "==", email).get()
        if not docs:
            return None
        data = docs[0].to_dict()
        return UserProfile(
            user_id=data["user_id"],
            email=data["email"],
            name=data["name"],
            created_at=datetime.fromisoformat(data["created_at"]),
            avatar_url=data.get("avatar_url"),
            total_sessions=data.get("total_sessions", 0),
            total_practice_minutes=data.get("total_practice_minutes", 0),
        )