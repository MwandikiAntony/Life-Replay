// ─── Auth ──────────────────────────────────────────────────────────────────

export interface User {
  user_id: string;
  email: string;
  name: string;
  created_at: string;
  avatar_url?: string;
  total_sessions: number;
  total_practice_minutes: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ─── Sessions ──────────────────────────────────────────────────────────────

export type SessionStatus = 'pending' | 'live' | 'processing' | 'completed' | 'failed';

export interface SessionSummary {
  avg_confidence: number;
  avg_pace_wpm: number;
  avg_eye_contact_pct: number;
  avg_posture_score: number;
  total_filler_words: number;
  total_words: number;
  top_issues: string[];
  strengths: string[];
  overall_score: number;
  duration_seconds: number;
}

export interface Session {
  session_id: string;
  user_id: string;
  title: string;
  description?: string;
  status: SessionStatus;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  thumbnail_url?: string;
  recording_url?: string;
  summary?: SessionSummary;
  metrics_count: number;
  transcript_count: number;
  feedback_count: number;
}

// ─── Metrics ───────────────────────────────────────────────────────────────

export interface MetricSnapshot {
  timestamp_ms: number;
  confidence_score: number;
  speaking_pace_wpm: number;
  filler_word_count: number;
  eye_contact_pct: number;
  posture_score: number;
  volume_level: number;
  clarity_score: number;
}

// ─── Feedback ──────────────────────────────────────────────────────────────

export type FeedbackType = 'pace' | 'filler' | 'eye_contact' | 'posture' | 'confidence' | 'volume' | 'clarity' | 'positive';
export type FeedbackSeverity = 'info' | 'warning' | 'success';

export interface FeedbackItem {
  id: string;
  timestamp_ms: number;
  feedback_type: FeedbackType;
  severity: FeedbackSeverity;
  message: string;
  detail?: string;
  score?: number;
}

// ─── Transcripts ───────────────────────────────────────────────────────────

export interface TranscriptSegment {
  id: string;
  timestamp_ms: number;
  duration_ms: number;
  text: string;
  filler_words: string[];
  word_count: number;
  confidence: number;
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_sessions: number;
  total_practice_minutes: number;
  avg_confidence_score: number;
  avg_eye_contact_pct: number;
  improvement_trend: number;
  recent_sessions: Session[];
}

export interface PerformanceTrend {
  date: string;
  confidence_score: number;
  pace_wpm: number;
  eye_contact_pct: number;
  posture_score: number;
  overall_score: number;
}

// ─── Settings ──────────────────────────────────────────────────────────────

export interface UserSettings {
  user_id: string;
  camera_device_id?: string;
  microphone_device_id?: string;
  coaching_sensitivity: 'low' | 'medium' | 'high';
  show_live_transcript: boolean;
  show_confidence_meter: boolean;
  auto_start_recording: boolean;
  notification_feedback: boolean;
}

// ─── WebSocket ─────────────────────────────────────────────────────────────

export type WSMessageType =
  | 'start_session' | 'stop_session' | 'audio_chunk' | 'video_frame' | 'ping'
  | 'session_started' | 'session_stopped' | 'transcript' | 'feedback'
  | 'metrics' | 'error' | 'pong' | 'coaching' | 'session_summary';

export interface WSMessage {
  type: WSMessageType;
  session_id?: string;
  data?: Record<string, unknown>;
  timestamp_ms?: number;
}

export interface LiveCoachingMessage {
  id: string;
  feedback_type: FeedbackType;
  severity: FeedbackSeverity;
  message: string;
  detail?: string;
  timestamp_ms: number;
  expiresAt: number;
}

// ─── Media Devices ─────────────────────────────────────────────────────────

export interface MediaDeviceOption {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}
