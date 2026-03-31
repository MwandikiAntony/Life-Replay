"""
WebSocket connection manager for real-time session streaming.
Handles audio/video chunks, routes to AI pipeline, broadcasts feedback.
"""
import asyncio
import base64
import json
import time
from collections import defaultdict
from typing import Dict, Optional, Set

from fastapi import WebSocket, WebSocketDisconnect

from app.core.logging import get_logger
from app.models.schemas import (
    FeedbackItem, FeedbackSeverity, FeedbackType,
    MetricSnapshot, SessionStatus, WSMessage, WSMessageType,
)
from app.services.gemini_service import get_gemini_service
from app.services.session_service import SessionService

logger = get_logger(__name__)


class SessionState:
    """Mutable state for a live session."""

    def __init__(self, session_id: str, user_id: str):
        self.session_id = session_id
        self.user_id = user_id
        self.started_at = time.time()
        self.audio_buffer: bytearray = bytearray()
        self.pending_transcript: str = ""
        self.last_speech_analysis: float = 0.0
        self.last_vision_analysis: float = 0.0
        self.last_metric_save: float = 0.0

        # Rolling metrics
        self.current_confidence = 70.0
        self.current_eye_contact = 70.0
        self.current_posture = 70.0
        self.current_pace = 120.0
        self.current_clarity = 75.0
        self.current_volume = 60.0
        self.total_filler_count = 0

        self.metric_history: list = []
        self.transcript_parts: list = []
        self.is_active = True

    def elapsed_ms(self) -> int:
        return int((time.time() - self.started_at) * 1000)


class ConnectionManager:
    """Manages WebSocket connections and routes messages."""

    def __init__(self):
        self._connections: Dict[str, WebSocket] = {}  # user_id → ws
        self._sessions: Dict[str, SessionState] = {}  # session_id → state
        self._user_sessions: Dict[str, str] = {}  # user_id → session_id

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        self._connections[user_id] = websocket
        logger.info("WebSocket connected", user_id=user_id)

    def disconnect(self, user_id: str) -> None:
        self._connections.pop(user_id, None)
        session_id = self._user_sessions.pop(user_id, None)
        if session_id:
            state = self._sessions.pop(session_id, None)
            if state:
                state.is_active = False
        logger.info("WebSocket disconnected", user_id=user_id)

    async def send(self, user_id: str, message: dict) -> bool:
        ws = self._connections.get(user_id)
        if ws:
            try:
                await ws.send_json(message)
                return True
            except Exception as e:
                logger.warning("Failed to send WS message", user_id=user_id, error=str(e))
                self.disconnect(user_id)
        return False

    async def handle_message(
        self, user_id: str, raw: str, session_svc: SessionService
    ) -> None:
        try:
            data = json.loads(raw)
            msg_type = data.get("type")

            if msg_type == WSMessageType.PING:
                await self.send(user_id, {"type": WSMessageType.PONG})
                return

            if msg_type == WSMessageType.START_SESSION:
                await self._handle_start(user_id, data, session_svc)

            elif msg_type == WSMessageType.STOP_SESSION:
                await self._handle_stop(user_id, data, session_svc)

            elif msg_type == WSMessageType.AUDIO_CHUNK:
                await self._handle_audio(user_id, data, session_svc)

            elif msg_type == WSMessageType.VIDEO_FRAME:
                await self._handle_video(user_id, data, session_svc)

        except json.JSONDecodeError:
            await self.send(user_id, {"type": WSMessageType.ERROR, "data": {"message": "Invalid JSON"}})
        except Exception as e:
            logger.error("WS message handling error", user_id=user_id, error=str(e))
            await self.send(user_id, {"type": WSMessageType.ERROR, "data": {"message": str(e)}})

    async def _handle_start(self, user_id: str, data: dict, session_svc: SessionService) -> None:
        session_id = data.get("session_id")
        if not session_id:
            await self.send(user_id, {"type": WSMessageType.ERROR, "data": {"message": "session_id required"}})
            return

        state = SessionState(session_id=session_id, user_id=user_id)
        self._sessions[session_id] = state
        self._user_sessions[user_id] = session_id

        await session_svc.start_session(session_id, user_id)

        await self.send(user_id, {
            "type": WSMessageType.SESSION_STARTED,
            "session_id": session_id,
            "data": {"message": "Session started. Coaching is active.", "timestamp_ms": state.elapsed_ms()},
        })
        logger.info("Session started via WS", session_id=session_id, user_id=user_id)

    async def _handle_stop(self, user_id: str, data: dict, session_svc: SessionService) -> None:
        session_id = self._user_sessions.get(user_id)
        if not session_id:
            return

        state = self._sessions.get(session_id)
        if state:
            state.is_active = False

        session = await session_svc.stop_session(session_id, user_id)

        # Generate and save summary async
        asyncio.create_task(
            self._finalize_session(session_id, user_id, state, session_svc)
        )

        await self.send(user_id, {
            "type": WSMessageType.SESSION_STOPPED,
            "session_id": session_id,
            "data": {
                "duration_seconds": session.duration_seconds,
                "message": "Session ended. Generating summary...",
            },
        })

    async def _handle_audio(self, user_id: str, data: dict, session_svc: SessionService) -> None:
        session_id = self._user_sessions.get(user_id)
        if not session_id:
            return
        state = self._sessions.get(session_id)
        if not state or not state.is_active:
            return

        # Extract transcript from audio chunk (client-side transcription or raw)
        transcript = data.get("data", {}).get("transcript", "")
        chunk_duration = data.get("data", {}).get("duration_s", 2.0)
        volume = data.get("data", {}).get("volume", 60.0)

        state.current_volume = float(volume)
        now = time.time()

        if transcript:
            state.pending_transcript += " " + transcript
            state.transcript_parts.append(transcript)

        # Analyze every 3 seconds of accumulated transcript
        if transcript and (now - state.last_speech_analysis) >= 3.0:
            state.last_speech_analysis = now
            gemini = get_gemini_service()

            try:
                segment, feedbacks = await gemini.analyze_speech(
                    state.pending_transcript.strip(),
                    min(now - state.last_speech_analysis + 3.0, 10.0),
                    state.elapsed_ms(),
                )
                state.pending_transcript = ""  # Reset buffer

                # Update rolling metrics
                state.current_pace = segment.word_count / max(chunk_duration, 1) * 60
                state.total_filler_count += len(segment.filler_words)

                # Save to Firestore
                await session_svc.save_transcript(session_id, segment)

                # Broadcast transcript
                await self.send(user_id, {
                    "type": WSMessageType.TRANSCRIPT,
                    "session_id": session_id,
                    "data": {
                        "text": segment.text,
                        "filler_words": segment.filler_words,
                        "timestamp_ms": segment.timestamp_ms,
                        "word_count": segment.word_count,
                    },
                })

                # Broadcast feedback
                for fb in feedbacks:
                    await session_svc.save_feedback(session_id, fb)
                    await self.send(user_id, {
                        "type": WSMessageType.COACHING,
                        "session_id": session_id,
                        "data": {
                            "id": fb.id,
                            "feedback_type": fb.feedback_type,
                            "severity": fb.severity,
                            "message": fb.message,
                            "detail": fb.detail,
                            "timestamp_ms": fb.timestamp_ms,
                        },
                    })

            except Exception as e:
                logger.warning("Speech analysis pipeline error", error=str(e))

        # Emit metrics every 2 seconds
        if (now - state.last_metric_save) >= 2.0:
            state.last_metric_save = now
            metric = MetricSnapshot(
                timestamp_ms=state.elapsed_ms(),
                confidence_score=state.current_confidence,
                speaking_pace_wpm=state.current_pace,
                filler_word_count=state.total_filler_count,
                eye_contact_pct=state.current_eye_contact,
                posture_score=state.current_posture,
                volume_level=state.current_volume,
                clarity_score=state.current_clarity,
            )
            state.metric_history.append(metric)
            await session_svc.save_metric(session_id, metric)

            await self.send(user_id, {
                "type": WSMessageType.METRICS,
                "session_id": session_id,
                "data": metric.model_dump(),
            })

    async def _handle_video(self, user_id: str, data: dict, session_svc: SessionService) -> None:
        session_id = self._user_sessions.get(user_id)
        if not session_id:
            return
        state = self._sessions.get(session_id)
        if not state or not state.is_active:
            return

        frame_b64 = data.get("data", {}).get("frame")
        if not frame_b64:
            return

        now = time.time()
        if (now - state.last_vision_analysis) < 2.0:
            return  # throttle to every 2s

        state.last_vision_analysis = now
        gemini = get_gemini_service()

        try:
            vision_data, feedbacks = await gemini.analyze_vision(frame_b64, state.elapsed_ms())

            # Update rolling metrics
            state.current_eye_contact = vision_data["eye_contact_pct"]
            state.current_posture = vision_data["posture_score"]
            # Blend confidence from both speech and vision
            state.current_confidence = (
                state.current_confidence * 0.6 + vision_data["confidence_score"] * 0.4
            )

            # Broadcast vision feedback
            for fb in feedbacks:
                await session_svc.save_feedback(session_id, fb)
                await self.send(user_id, {
                    "type": WSMessageType.COACHING,
                    "session_id": session_id,
                    "data": {
                        "id": fb.id,
                        "feedback_type": fb.feedback_type,
                        "severity": fb.severity,
                        "message": fb.message,
                        "timestamp_ms": fb.timestamp_ms,
                    },
                })

        except Exception as e:
            logger.warning("Vision analysis pipeline error", error=str(e))

    async def _finalize_session(
        self, session_id: str, user_id: str, state: Optional[SessionState], session_svc: SessionService
    ) -> None:
        """Generate session summary and mark complete."""
        try:
            if not state:
                return

            gemini = get_gemini_service()
            full_transcript = " ".join(state.transcript_parts)
            duration = int(time.time() - state.started_at)

            summary_data = await gemini.generate_session_summary(
                state.metric_history, full_transcript, duration
            )

            from app.models.schemas import SessionSummary
            summary = SessionSummary(**summary_data)
            await session_svc.complete_session(session_id, summary)

            await self.send(user_id, {
                "type": "session_summary",
                "session_id": session_id,
                "data": summary.model_dump(),
            })

            logger.info("Session finalized", session_id=session_id)

        except Exception as e:
            logger.error("Session finalization failed", session_id=session_id, error=str(e))
        finally:
            self._sessions.pop(session_id, None)


# Singleton manager
_manager: Optional[ConnectionManager] = None


def get_connection_manager() -> ConnectionManager:
    global _manager
    if _manager is None:
        _manager = ConnectionManager()
    return _manager
