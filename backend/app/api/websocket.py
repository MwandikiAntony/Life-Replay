"""
WebSocket endpoint for real-time session streaming.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from fastapi.websockets import WebSocketState

from app.core.logging import get_logger
from app.core.security import decode_access_token
from app.services.session_service import SessionService
from app.services.ws_manager import get_connection_manager

logger = get_logger(__name__)
router = APIRouter(tags=["websocket"])


@router.websocket("/ws/session")
async def session_websocket(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
):
    """
    Real-time session WebSocket.

    Client must connect with ?token=<jwt>

    Message types (client → server):
      - start_session: { session_id }
      - stop_session: {}
      - audio_chunk: { transcript, duration_s, volume }
      - video_frame: { frame (base64 JPEG) }
      - ping: {}

    Message types (server → client):
      - session_started, session_stopped
      - transcript: { text, filler_words, timestamp_ms }
      - coaching: { feedback_type, severity, message, timestamp_ms }
      - metrics: MetricSnapshot
      - session_summary: SessionSummary
      - pong, error
    """
    manager = get_connection_manager()
    session_svc = SessionService()
    user_id = None

    try:
        # Authenticate via token query param
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token")
            return

        await manager.connect(websocket, user_id)
        logger.info("WebSocket authenticated", user_id=user_id)

        while True:
            try:
                raw = await websocket.receive_text()
                await manager.handle_message(user_id, raw, session_svc)
            except WebSocketDisconnect:
                break

    except Exception as e:
        logger.error("WebSocket error", user_id=user_id, error=str(e))
        if websocket.client_state != WebSocketState.DISCONNECTED:
            try:
                await websocket.close(code=4000, reason=str(e))
            except Exception:
                pass
    finally:
        if user_id:
            manager.disconnect(user_id)
