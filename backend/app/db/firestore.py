"""
Firestore database client and collection helpers.
"""
import os
from typing import Optional
from google.cloud import firestore
from google.oauth2 import service_account

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_db: Optional[firestore.AsyncClient] = None


def get_db() -> firestore.AsyncClient:
    global _db
    if _db is None:
        _db = _create_client()
    return _db


def _create_client() -> firestore.AsyncClient:
    try:
        creds_path = settings.google_application_credentials
        if os.path.exists(creds_path):
            credentials = service_account.Credentials.from_service_account_file(creds_path)
            client = firestore.AsyncClient(
                project=settings.project_id,
                credentials=credentials,
                database=settings.firestore_database,
            )
            logger.info("Firestore client created with service account")
        else:
            # Use Application Default Credentials
            client = firestore.AsyncClient(
                project=settings.project_id,
                database=settings.firestore_database,
            )
            logger.info("Firestore client created with ADC")
        return client
    except Exception as e:
        logger.error("Failed to create Firestore client", error=str(e))
        raise


# Collection name constants
class Collections:
    USERS = "users"
    SESSIONS = "sessions"
    TRANSCRIPTS = "transcripts"
    METRICS = "metrics"
    FEEDBACK = "feedback"
    SETTINGS = "user_settings"


async def close_db() -> None:
    global _db
    if _db:
        _db.close()
        _db = None
        logger.info("Firestore connection closed")
