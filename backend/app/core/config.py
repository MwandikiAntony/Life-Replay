"""
Application configuration via pydantic-settings.
All values come from environment variables or .env file.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Google Cloud
    google_application_credentials: str = "backend/aiplatform-sa-key.json"
    project_id: str = "warm-alliance-381015"
    project_number: str = "521107151792"
    region: str = "us-central1"

    # Gemini AI
    gemini_api_key: str = "YOUR_KEY"
    gemini_model: str = "gemini-2.0-flash-live-001"
    gemini_location: str = "us-central1"

    # Firestore
    firestore_database: str = "(default)"
    firestore_mode: str = "NATIVE"

    # URLs
    api_base_url: str = "http://localhost:8000"
    ws_base_url: str = "ws://localhost:8000"
    frontend_url: str = "http://localhost:3000"

    # App
    debug: bool = True
    environment: str = "development"
    log_level: str = "DEBUG"
    secret_key: str = "your_secret_key_change_in_production_min_32_chars"

    # JWT
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # WebSocket
    ws_ping_interval: int = 20
    ws_ping_timeout: int = 10
    ws_max_message_size: int = 10 * 1024 * 1024  # 10MB

    # AI Analysis
    speech_chunk_duration_ms: int = 500
    vision_frame_interval_ms: int = 1000
    coaching_feedback_interval_ms: int = 3000


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
