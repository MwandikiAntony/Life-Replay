"""
Pydantic data models for LifeReplay entities.
"""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
import uuid


# ─── Enums ────────────────────────────────────────────────────────────────────

class SessionStatus(str, Enum):
    PENDING = "pending"
    LIVE = "live"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class FeedbackType(str, Enum):
    PACE = "pace"
    FILLER = "filler"
    EYE_CONTACT = "eye_contact"
    POSTURE = "posture"
    CONFIDENCE = "confidence"
    VOLUME = "volume"
    CLARITY = "clarity"
    POSITIVE = "positive"


class FeedbackSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    SUCCESS = "success"


# ─── Auth Models ──────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = Field(min_length=1, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserProfile(BaseModel):
    user_id: str
    email: str
    name: str
    created_at: datetime
    avatar_url: Optional[str] = None
    total_sessions: int = 0
    total_practice_minutes: int = 0


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile


# ─── Session Models ───────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class SessionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[SessionStatus] = None


class MetricSnapshot(BaseModel):
    timestamp_ms: int
    confidence_score: float = Field(ge=0, le=100)
    speaking_pace_wpm: float = Field(ge=0)
    filler_word_count: int = Field(ge=0)
    eye_contact_pct: float = Field(ge=0, le=100)
    posture_score: float = Field(ge=0, le=100)
    volume_level: float = Field(ge=0, le=100)
    clarity_score: float = Field(ge=0, le=100)


class FeedbackItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp_ms: int
    feedback_type: FeedbackType
    severity: FeedbackSeverity
    message: str
    detail: Optional[str] = None
    score: Optional[float] = None


class TranscriptSegment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp_ms: int
    duration_ms: int
    text: str
    filler_words: List[str] = []
    word_count: int = 0
    confidence: float = Field(ge=0, le=1, default=1.0)


class SessionSummary(BaseModel):
    avg_confidence: float
    avg_pace_wpm: float
    avg_eye_contact_pct: float
    avg_posture_score: float
    total_filler_words: int
    total_words: int
    top_issues: List[str]
    strengths: List[str]
    overall_score: float
    duration_seconds: int


class Session(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str = "Untitled Session"
    description: Optional[str] = None
    status: SessionStatus = SessionStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    thumbnail_url: Optional[str] = None
    recording_url: Optional[str] = None
    summary: Optional[SessionSummary] = None
    metrics_count: int = 0
    transcript_count: int = 0
    feedback_count: int = 0

    def to_firestore(self) -> dict:
        data = self.model_dump()
        # Convert datetimes to firestore-compatible
        for key in ["created_at", "started_at", "ended_at"]:
            if data[key] and isinstance(data[key], datetime):
                data[key] = data[key].isoformat()
        return data


# ─── WebSocket Message Models ─────────────────────────────────────────────────

class WSMessageType(str, Enum):
    # Client → Server
    START_SESSION = "start_session"
    STOP_SESSION = "stop_session"
    AUDIO_CHUNK = "audio_chunk"
    VIDEO_FRAME = "video_frame"
    PING = "ping"

    # Server → Client
    SESSION_STARTED = "session_started"
    SESSION_STOPPED = "session_stopped"
    TRANSCRIPT = "transcript"
    FEEDBACK = "feedback"
    METRICS = "metrics"
    ERROR = "error"
    PONG = "pong"
    COACHING = "coaching"


class WSMessage(BaseModel):
    type: WSMessageType
    session_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    timestamp_ms: Optional[int] = None


# ─── Dashboard Models ─────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_sessions: int
    total_practice_minutes: int
    avg_confidence_score: float
    avg_eye_contact_pct: float
    improvement_trend: float  # % change over last 7 days
    recent_sessions: List[Session]


class PerformanceTrend(BaseModel):
    date: str
    confidence_score: float
    pace_wpm: float
    eye_contact_pct: float
    posture_score: float
    overall_score: float


# ─── Settings Models ──────────────────────────────────────────────────────────

class UserSettings(BaseModel):
    user_id: str
    camera_device_id: Optional[str] = None
    microphone_device_id: Optional[str] = None
    coaching_sensitivity: str = "medium"  # low, medium, high
    show_live_transcript: bool = True
    show_confidence_meter: bool = True
    auto_start_recording: bool = False
    notification_feedback: bool = True
    updated_at: datetime = Field(default_factory=datetime.utcnow)
