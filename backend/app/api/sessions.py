"""
Session management endpoints.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import get_current_user
from app.models.schemas import (
    Session, SessionCreate, SessionUpdate,
    MetricSnapshot, FeedbackItem, TranscriptSegment,
    DashboardStats, PerformanceTrend,
)
from app.services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["sessions"])


def get_session_service() -> SessionService:
    return SessionService()


@router.post("", response_model=Session, status_code=201)
async def create_session(
    data: SessionCreate,
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    """Create a new session (call before starting WebSocket)."""
    return await svc.create_session(current_user["user_id"], data)


@router.get("", response_model=List[Session])
async def list_sessions(
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    """List user's sessions."""
    return await svc.list_sessions(current_user["user_id"], limit=limit)


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    """Get dashboard statistics."""
    return await svc.get_dashboard_stats(current_user["user_id"])


@router.get("/trends", response_model=List[PerformanceTrend])
async def get_trends(
    days: int = Query(14, ge=1, le=90),
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    """Get performance trends over time."""
    return await svc.get_performance_trends(current_user["user_id"], days=days)


@router.get("/{session_id}", response_model=Session)
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    """Get a single session."""
    return await svc.get_session(session_id, current_user["user_id"])


@router.get("/{session_id}/metrics", response_model=List[MetricSnapshot])
async def get_metrics(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    """Get metric timeline for replay."""
    return await svc.get_metrics(session_id, current_user["user_id"])


@router.get("/{session_id}/feedback", response_model=List[FeedbackItem])
async def get_feedback(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    """Get coaching feedback for replay."""
    return await svc.get_feedback(session_id, current_user["user_id"])


@router.get("/{session_id}/transcript", response_model=List[TranscriptSegment])
async def get_transcript(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    """Get full transcript for replay."""
    return await svc.get_transcript(session_id, current_user["user_id"])


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    """Delete a session."""
    await svc.get_session(session_id, current_user["user_id"])  # auth check
    from app.db.firestore import get_db, Collections
    db = get_db()
    await db.collection(Collections.SESSIONS).document(session_id).delete()
