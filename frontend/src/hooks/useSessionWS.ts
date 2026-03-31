import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '@/lib/api';
import type {
  WSMessage, WSMessageType, MetricSnapshot,
  TranscriptSegment, FeedbackItem, LiveCoachingMessage, SessionSummary,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
const COACHING_DISPLAY_MS = 6000;

export type WSStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseSessionWSOptions {
  sessionId: string;
  onMetrics?: (m: MetricSnapshot) => void;
  onTranscript?: (t: { text: string; fillerWords: string[]; timestampMs: number }) => void;
  onCoaching?: (fb: LiveCoachingMessage) => void;
  onSummary?: (s: SessionSummary) => void;
  onError?: (msg: string) => void;
}

export function useSessionWS({
  sessionId,
  onMetrics,
  onTranscript,
  onCoaching,
  onSummary,
  onError,
}: UseSessionWSOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const [isSessionLive, setIsSessionLive] = useState(false);

  const handleMessage = useCallback((msg: WSMessage) => {
  switch (msg.type) {
    case 'session_started':
      setIsSessionLive(true);
      break;
    case 'session_stopped':
      setIsSessionLive(false);
      break;
    case 'metrics':
      onMetrics?.(msg.data as unknown as MetricSnapshot);
      break;
    case 'transcript':
      if (msg.data && onTranscript) {
        onTranscript({
          text: msg.data.text as string,
          fillerWords: (msg.data.filler_words as string[]) || [],
          timestampMs: msg.data.timestamp_ms as number,
        });
      }
      break;
    case 'coaching':
      if (msg.data && onCoaching) {
        const coaching: LiveCoachingMessage = {
          id: (msg.data.id as string) || uuidv4(),
          feedback_type: msg.data.feedback_type as any,
          severity: msg.data.severity as any,
          message: msg.data.message as string,
          detail: msg.data.detail as string | undefined,
          timestamp_ms: msg.data.timestamp_ms as number,
          expiresAt: Date.now() + COACHING_DISPLAY_MS,
        };
        onCoaching(coaching);
      }
      break;
    case 'session_summary':
      if (msg.data && onSummary) {
        onSummary(msg.data as unknown as SessionSummary);
      }
      break;
    case 'error':
      onError?.(msg.data?.message as string || 'Unknown error');
      break;
    case 'pong':
      break;
  }
}, [onMetrics, onTranscript, onCoaching, onSummary, onError]);

const connect = useCallback((id?: string) => {
  const token = getToken();
  if (!token) {
    onError?.('Not authenticated');
    return;
  }

  const wsSessionId = id || sessionId;
  if (!wsSessionId) {
    onError?.('session_id is required before connecting');
    return;
  }

  setStatus('connecting');

  const ws = new WebSocket(`${WS_URL}/ws/session?token=${token}&session_id=${wsSessionId}`);
  wsRef.current = ws;

  ws.onopen = () => {
    setStatus('connected');
    pingIntervalRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 20000);
  };

  ws.onmessage = (event) => {
    try {
      const msg: WSMessage = JSON.parse(event.data);
      handleMessage(msg); // ✅ now valid
    } catch (e) {
      console.error('WS parse error', e);
    }
  };

  ws.onerror = () => {
    setStatus('error');
    onError?.('WebSocket connection error');
  };

  ws.onclose = () => {
    setStatus('disconnected');
    setIsSessionLive(false);
    clearInterval(pingIntervalRef.current);
  };
}, [sessionId, onError, handleMessage]);



  const send = useCallback((type: WSMessageType, data?: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, session_id: sessionId, data, timestamp_ms: Date.now() }));
    }
  }, [sessionId]);

  const startSession = useCallback(() => {
    send('start_session');
  }, [send]);

  const stopSession = useCallback(() => {
    send('stop_session');
    setIsSessionLive(false);
  }, [send]);

  const sendAudioChunk = useCallback((transcript: string, durationS: number, volume: number) => {
    send('audio_chunk', { transcript, duration_s: durationS, volume });
  }, [send]);

  const sendVideoFrame = useCallback((frameB64: string) => {
    send('video_frame', { frame: frameB64 });
  }, [send]);

  const disconnect = useCallback(() => {
    clearInterval(pingIntervalRef.current);
    clearTimeout(reconnectTimerRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
    setIsSessionLive(false);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    isSessionLive,
    connect,
    disconnect,
    startSession,
    stopSession,
    sendAudioChunk,
    sendVideoFrame,
  };
}
