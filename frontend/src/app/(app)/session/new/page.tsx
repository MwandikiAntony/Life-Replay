'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Video, Mic, MicOff, VideoOff, Square, Play,
  Wifi, WifiOff, AlertCircle, Zap,
} from 'lucide-react';
import { sessionsAPI } from '@/lib/api';
import type { MetricSnapshot, LiveCoachingMessage, SessionSummary } from '@/types';
import { useSessionWS } from '@/hooks/useSessionWS';
import { useMediaCapture } from '@/hooks/useMediaCapture';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { MetricBar } from '@/components/ui/MetricBar';
import { CoachingFeed } from '@/components/session/CoachingFeed';
import { LiveTranscript } from '@/components/session/LiveTranscript';
import { VolumeMeter } from '@/components/session/VolumeMeter';
import { WaveformViz } from '@/components/session/WaveformViz';
import { SessionSummaryModal } from '@/components/session/SessionSummaryModal';
import { v4 as uuidv4 } from 'uuid';

export default function NewSessionPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [sessionId, setSessionId] = useState<string>('');
  const [isStarted, setIsStarted] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [metrics, setMetrics] = useState<MetricSnapshot>({
    timestamp_ms: 0, confidence_score: 0, speaking_pace_wpm: 0,
    filler_word_count: 0, eye_contact_pct: 0, posture_score: 0,
    volume_level: 0, clarity_score: 0,
  });
  const [coachingMessages, setCoachingMessages] = useState<LiveCoachingMessage[]>([]);
  const [transcript, setTranscript] = useState<Array<{ text: string; fillerWords: string[]; ts: number }>>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Coaching messages cleanup
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setCoachingMessages(prev => prev.filter(m => m.expiresAt > now));
    }, 500);
    return () => clearInterval(cleanup);
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (isStarted) {
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isStarted]);

  const { status, connect, disconnect, startSession, stopSession, sendAudioChunk, sendVideoFrame } =
    useSessionWS({
      sessionId,
      onMetrics: setMetrics,
      onTranscript: ({ text, fillerWords, timestampMs }) => {
        setTranscript(prev => [...prev.slice(-30), { text, fillerWords, ts: timestampMs }]);
      },
      onCoaching: (msg) => {
        setCoachingMessages(prev => [...prev.slice(-8), msg]);
      },
      onSummary: setSummary,
      onError: (msg) => toast.error(msg),
    });

  const { state: mediaState, startCapture, stopCapture } = useMediaCapture({
    videoRef,
    onAudioChunk: sendAudioChunk,
    onVideoFrame: sendVideoFrame,
    frameIntervalMs: 2500,
  });

  const handleStart = async () => {
  try {
    const session = await sessionsAPI.create(sessionTitle || undefined);
    const id = session.session_id;
    setSessionId(id);

    await startCapture();

    // Pass sessionId explicitly to connect
    connect(id);

    setTimeout(() => {
      startSession();
      setIsStarted(true);
      toast.success('Session started! AI coaching is active.');
    }, 1000);
  } catch (err: any) {
    toast.error(err?.message || 'Failed to start session');
  }
};

  const handleStop = useCallback(() => {
    stopSession();
    stopCapture();
    setIsStarted(false);
    clearInterval(timerRef.current);
    setTimeout(() => disconnect(), 2000);
  }, [stopSession, stopCapture, disconnect]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen flex flex-col bg-void overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface flex-shrink-0">
        <div className="flex items-center gap-4">
          {isStarted ? (
            <div className="flex items-center gap-2">
              <div className="recording-dot" />
              <span className="text-rose text-sm font-mono font-bold">{formatTime(elapsedSeconds)}</span>
            </div>
          ) : (
            <span className="font-display font-semibold text-text-primary">New Session</span>
          )}
          {isStarted && sessionTitle && (
            <span className="text-text-tertiary text-sm">— {sessionTitle}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* WS Status */}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
            status === 'connected' ? 'text-emerald border-emerald/20 bg-emerald/5' :
            status === 'connecting' ? 'text-amber border-amber/20 bg-amber/5' :
            'text-text-tertiary border-border bg-panel'
          }`}>
            {status === 'connected' ? <Wifi size={11} /> : <WifiOff size={11} />}
            {status === 'connected' ? 'AI Active' : status === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </div>

          {isStarted ? (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 bg-rose/10 border border-rose/30 text-rose px-4 py-2 rounded-xl text-sm font-medium hover:bg-rose/20 transition-all"
            >
              <Square size={14} fill="currentColor" />
              End Session
            </button>
          ) : null}
        </div>
      </header>

      {!isStarted ? (
        /* Pre-session setup */
        <PreSessionSetup
          title={sessionTitle}
          onTitleChange={setSessionTitle}
          onStart={handleStart}
          cameraReady={mediaState.cameraReady}
          micReady={mediaState.micReady}
          error={mediaState.error}
          videoRef={videoRef}
        />
      ) : (
        /* Live session UI */
        <div className="flex-1 flex overflow-hidden">
          {/* Left: video + transcript */}
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
            {/* Video */}
            <div className="relative flex-shrink-0 rounded-2xl overflow-hidden bg-panel border border-border" style={{ aspectRatio: '16/9', maxHeight: '50vh' }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Overlay metrics */}
              <div className="absolute top-3 left-3 flex gap-2">
                <div className="glass-panel rounded-lg px-3 py-1.5 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${metrics.confidence_score > 60 ? 'bg-emerald' : 'bg-amber'}`} />
                  <span className="text-xs font-mono text-text-primary">{metrics.confidence_score.toFixed(0)}% conf</span>
                </div>
              </div>

              <div className="absolute bottom-3 left-3">
                <VolumeMeter volume={mediaState.currentVolume} />
              </div>

              {/* Waveform */}
              <div className="absolute bottom-3 right-3">
                <WaveformViz active={true} volume={mediaState.currentVolume} />
              </div>
            </div>

            {/* Live transcript */}
            <LiveTranscript segments={transcript} className="flex-1 overflow-hidden" />
          </div>

          {/* Right: metrics + coaching */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-4 p-4 border-l border-border overflow-y-auto">
            {/* Score ring */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col items-center">
              <ScoreRing score={metrics.confidence_score} size={100} label="Confidence" />
            </div>

            {/* Metrics */}
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Live Metrics</h3>
              <MetricBar label="Eye Contact" value={metrics.eye_contact_pct} color="#00d4ff" />
              <MetricBar label="Posture" value={metrics.posture_score} color="#7c3aed" />
              <MetricBar label="Clarity" value={metrics.clarity_score} color="#00c896" />
              <MetricBar label="Pace" value={Math.min(100, (metrics.speaking_pace_wpm / 200) * 100)} color="#f59e0b"
                label2={`${metrics.speaking_pace_wpm.toFixed(0)} WPM`} />
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between text-xs">
                  <span className="text-text-tertiary">Filler Words</span>
                  <span className="font-mono text-amber">{metrics.filler_word_count}</span>
                </div>
              </div>
            </div>

            {/* Coaching feed */}
            <div className="flex-1">
              <CoachingFeed messages={coachingMessages} />
            </div>
          </div>
        </div>
      )}

      {/* Summary modal */}
      {summary && (
        <SessionSummaryModal
          summary={summary}
          sessionId={sessionId}
          onClose={() => {
            setSummary(null);
            router.push(`/sessions/${sessionId}`);
          }}
        />
      )}
    </div>
  );
}

function PreSessionSetup({
  title, onTitleChange, onStart, cameraReady, micReady, error, videoRef,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  onStart: () => void;
  cameraReady: boolean;
  micReady: boolean;
  error?: string;
  videoRef: React.RefObject<HTMLVideoElement>;
}) {
  const [previewing, setPreviewing] = useState(false);

  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPreviewing(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h2 className="font-display text-2xl font-bold text-text-primary mb-2">Set Up Your Session</h2>
          <p className="text-text-secondary text-sm">Configure your session and start AI-powered coaching</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Camera preview */}
          <div className="space-y-3">
            <div
              className="relative rounded-2xl overflow-hidden bg-panel border border-border"
              style={{ aspectRatio: '4/3' }}
            >
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {!previewing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Video size={32} className="text-text-tertiary opacity-40" />
                  <button
                    onClick={startPreview}
                    className="text-sm text-cyan hover:underline"
                  >
                    Enable camera preview
                  </button>
                </div>
              )}
            </div>
            {error && (
              <div className="flex items-center gap-2 text-xs text-rose bg-rose/10 border border-rose/20 rounded-xl px-3 py-2">
                <AlertCircle size={13} />
                {error}
              </div>
            )}
          </div>

          {/* Session config */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Session Title</label>
              <input
                type="text"
                value={title}
                onChange={e => onTitleChange(e.target.value)}
                placeholder="e.g., Presentation Practice"
                className="input-field"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-text-secondary">What you'll get:</p>
              {[
                'Real-time confidence scoring',
                'Live speech transcription',
                'Eye contact & posture feedback',
                'Filler word detection',
                'Personalized coaching tips',
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>

            <button
              onClick={onStart}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-4"
            >
              <Play size={16} fill="currentColor" />
              Start Coaching Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
