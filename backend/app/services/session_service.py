"""
Session service: create, update, fetch, list sessions and their sub-collections.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException
from google.cloud import firestore

from app.db.firestore import get_db, Collections
from app.core.logging import get_logger
from app.models.schemas import (
    Session, SessionStatus, SessionCreate, SessionSummary,
    MetricSnapshot, FeedbackItem, TranscriptSegment,
    DashboardStats, PerformanceTrend,
)

logger = get_logger(__name__)


class SessionService:
    def __init__(self):
        self.db = get_db()

    async def create_session(self, user_id: str, data: SessionCreate) -> Session:
        session = Session(
            user_id=user_id,
            title=data.title or f"Session {datetime.utcnow().strftime('%b %d, %Y %H:%M')}",
            description=data.description,
        )
        await self.db.collection(Collections.SESSIONS).document(session.session_id).set(
            session.to_firestore()
        )
        logger.info("Session created", session_id=session.session_id, user_id=user_id)
        return session

    async def get_session(self, session_id: str, user_id: str) -> Session:
        doc = await self.db.collection(Collections.SESSIONS).document(session_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Session not found")
        data = doc.to_dict()
        if data["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        return self._doc_to_session(data)

    async def list_sessions(self, user_id: str, limit: int = 20) -> List[Session]:
        docs = (
            await self.db.collection(Collections.SESSIONS)
            .where("user_id", "==", user_id)
            .order_by("created_at", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .get()
        )
        return [self._doc_to_session(d.to_dict()) for d in docs]

    async def start_session(self, session_id: str, user_id: str) -> Session:
        session = await self.get_session(session_id, user_id)
        now = datetime.utcnow()
        await self.db.collection(Collections.SESSIONS).document(session_id).update({
            "status": SessionStatus.LIVE,
            "started_at": now.isoformat(),
        })
        session.status = SessionStatus.LIVE
        session.started_at = now
        return session

    async def stop_session(self, session_id: str, user_id: str) -> Session:
        session = await self.get_session(session_id, user_id)
        now = datetime.utcnow()
        duration = 0
        if session.started_at:
            duration = int((now - session.started_at).total_seconds())

        await self.db.collection(Collections.SESSIONS).document(session_id).update({
            "status": SessionStatus.PROCESSING,
            "ended_at": now.isoformat(),
            "duration_seconds": duration,
        })
        session.status = SessionStatus.PROCESSING
        session.ended_at = now
        session.duration_seconds = duration
        return session

    async def complete_session(self, session_id: str, summary: SessionSummary) -> None:
        await self.db.collection(Collections.SESSIONS).document(session_id).update({
            "status": SessionStatus.COMPLETED,
            "summary": summary.model_dump(),
        })

    async def save_metric(self, session_id: str, metric: MetricSnapshot) -> None:
        doc_id = f"{metric.timestamp_ms}"
        await (
            self.db.collection(Collections.SESSIONS)
            .document(session_id)
            .collection(Collections.METRICS)
            .document(doc_id)
            .set(metric.model_dump())
        )
        # Increment counter
        await self.db.collection(Collections.SESSIONS).document(session_id).update({
            "metrics_count": firestore.Increment(1)
        })

    async def save_feedback(self, session_id: str, feedback: FeedbackItem) -> None:
        await (
            self.db.collection(Collections.SESSIONS)
            .document(session_id)
            .collection(Collections.FEEDBACK)
            .document(feedback.id)
            .set(feedback.model_dump())
        )
        await self.db.collection(Collections.SESSIONS).document(session_id).update({
            "feedback_count": firestore.Increment(1)
        })

    async def save_transcript(self, session_id: str, segment: TranscriptSegment) -> None:
        await (
            self.db.collection(Collections.SESSIONS)
            .document(session_id)
            .collection(Collections.TRANSCRIPTS)
            .document(segment.id)
            .set(segment.model_dump())
        )
        await self.db.collection(Collections.SESSIONS).document(session_id).update({
            "transcript_count": firestore.Increment(1)
        })

    async def get_metrics(self, session_id: str, user_id: str) -> List[MetricSnapshot]:
        await self.get_session(session_id, user_id)  # auth check
        docs = (
            await self.db.collection(Collections.SESSIONS)
            .document(session_id)
            .collection(Collections.METRICS)
            .order_by("timestamp_ms")
            .get()
        )
        return [MetricSnapshot(**d.to_dict()) for d in docs]

    async def get_feedback(self, session_id: str, user_id: str) -> List[FeedbackItem]:
        await self.get_session(session_id, user_id)  # auth check
        docs = (
            await self.db.collection(Collections.SESSIONS)
            .document(session_id)
            .collection(Collections.FEEDBACK)
            .order_by("timestamp_ms")
            .get()
        )
        return [FeedbackItem(**d.to_dict()) for d in docs]

    async def get_transcript(self, session_id: str, user_id: str) -> List[TranscriptSegment]:
        await self.get_session(session_id, user_id)  # auth check
        docs = (
            await self.db.collection(Collections.SESSIONS)
            .document(session_id)
            .collection(Collections.TRANSCRIPTS)
            .order_by("timestamp_ms")
            .get()
        )
        return [TranscriptSegment(**d.to_dict()) for d in docs]

    async def get_dashboard_stats(self, user_id: str) -> DashboardStats:
        sessions = await self.list_sessions(user_id, limit=50)
        completed = [s for s in sessions if s.status == SessionStatus.COMPLETED and s.summary]

        total_minutes = sum((s.duration_seconds or 0) // 60 for s in sessions)
        avg_conf = sum(s.summary.avg_confidence for s in completed) / max(len(completed), 1)
        avg_eye = sum(s.summary.avg_eye_contact_pct for s in completed) / max(len(completed), 1)

        # Trend: compare last 3 vs previous 3
        recent_scores = [s.summary.overall_score for s in completed[:3] if s.summary]
        older_scores = [s.summary.overall_score for s in completed[3:6] if s.summary]
        if recent_scores and older_scores:
            trend = ((sum(recent_scores) / len(recent_scores)) - (sum(older_scores) / len(older_scores)))
        else:
            trend = 0.0

        return DashboardStats(
            total_sessions=len(sessions),
            total_practice_minutes=total_minutes,
            avg_confidence_score=round(avg_conf, 1),
            avg_eye_contact_pct=round(avg_eye, 1),
            improvement_trend=round(trend, 1),
            recent_sessions=sessions[:5],
        )

    async def get_performance_trends(self, user_id: str, days: int = 14) -> List[PerformanceTrend]:
        sessions = await self.list_sessions(user_id, limit=100)
        completed = [s for s in sessions if s.status == SessionStatus.COMPLETED and s.summary]
        trends = []
        for s in completed[:days]:
            if s.summary and s.created_at:
                trends.append(PerformanceTrend(
                    date=s.created_at.strftime("%Y-%m-%d"),
                    confidence_score=s.summary.avg_confidence,
                    pace_wpm=s.summary.avg_pace_wpm,
                    eye_contact_pct=s.summary.avg_eye_contact_pct,
                    posture_score=s.summary.avg_posture_score,
                    overall_score=s.summary.overall_score,
                ))
        return list(reversed(trends))

    def _doc_to_session(self, data: dict) -> Session:
        for key in ["created_at", "started_at", "ended_at"]:
            if data.get(key) and isinstance(data[key], str):
                try:
                    data[key] = datetime.fromisoformat(data[key])
                except (ValueError, TypeError):
                    data[key] = None
        if data.get("summary") and isinstance(data["summary"], dict):
            data["summary"] = SessionSummary(**data["summary"])
        return Session(**data)
