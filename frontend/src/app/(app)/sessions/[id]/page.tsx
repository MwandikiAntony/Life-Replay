'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Play, Pause, SkipBack, SkipForward,
  MessageSquare, BarChart3, FileText, Award,
} from 'lucide-react';
import { sessionsAPI } from '@/lib/api';
import type {
  Session, MetricSnapshot, FeedbackItem, TranscriptSegment,
} from '@/types';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { MetricBar } from '@/components/ui/MetricBar';
import { TrendChart } from '@/components/analytics/TrendChart';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';

type ReplayTab = 'feedback' | 'transcript' | 'metrics' | 'summary';

export default function SessionReplayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [metrics, setMetrics] = useState<MetricSnapshot[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ReplayTab>('feedback');

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const playTimerRef = useRef<ReturnType<typeof setInterval>>();
  const playbackSpeedRef = useRef(1);

  useEffect(() => {
    Promise.all([
      sessionsAPI.get(id),
      sessionsAPI.getMetrics(id),
      sessionsAPI.getFeedback(id),
      sessionsAPI.getTranscript(id),
    ]).then(([s, m, fb, tr]) => {
      setSession(s);
      setMetrics(m);
      setFeedback(fb);
      setTranscript(tr);
      const dur = (s.duration_seconds || 0) * 1000;
      setTotalMs(dur || (m.length > 0 ? m[m.length - 1].timestamp_ms + 2000 : 60000));
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // Playback engine
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setCurrentMs(prev => {
          const next = prev + 200 * playbackSpeedRef.current;
          if (next >= totalMs) {
            setIsPlaying(false);
            return totalMs;
          }
          return next;
        });
      }, 200);
    } else {
      clearInterval(playTimerRef.current);
    }
    return () => clearInterval(playTimerRef.current);
  }, [isPlaying, totalMs]);

  const currentMetric = metrics.reduce<MetricSnapshot | null>((acc, m) => {
    if (m.timestamp_ms <= currentMs) return m;
    return acc;
  }, null) || metrics[0];

  const visibleFeedback = feedback.filter(f => f.timestamp_ms <= currentMs);
  const visibleTranscript = transcript.filter(t => t.timestamp_ms <= currentMs);

  const progressPct = totalMs > 0 ? (currentMs / totalMs) * 100 : 0;

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCurrentMs(pct * totalMs);
  }, [totalMs]);

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  if (loading) return <ReplaySkeleton />;
  if (!session) return <div className="p-8 text-text-secondary">Session not found</div>;

  return (
    <div className="flex flex-col h-screen bg-void overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-border bg-surface flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="text-text-tertiary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-semibold text-text-primary truncate">{session.title}</h1>
          <p className="text-xs text-text-tertiary">
            {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
            {session.duration_seconds && ` · ${Math.floor(session.duration_seconds / 60)}m ${session.duration_seconds % 60}s`}
          </p>
        </div>
        {session.summary && (
          <div className="flex items-center gap-2 bg-cyan/10 border border-cyan/20 rounded-xl px-4 py-2">
            <Award size={14} className="text-cyan" />
            <span className="text-sm font-mono font-bold text-cyan">
              {session.summary.overall_score.toFixed(0)}/100
            </span>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Playback + metrics */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden gap-4">
          {/* Score display */}
          <div className="grid grid-cols-4 gap-3 flex-shrink-0">
            {[
              { label: 'Confidence', value: currentMetric?.confidence_score ?? 0, color: '#00d4ff' },
              { label: 'Eye Contact', value: currentMetric?.eye_contact_pct ?? 0, color: '#7c3aed' },
              { label: 'Posture', value: currentMetric?.posture_score ?? 0, color: '#00c896' },
              { label: 'Clarity', value: currentMetric?.clarity_score ?? 0, color: '#f59e0b' },
            ].map(m => (
              <div key={m.label} className="glass-panel rounded-2xl p-4 text-center">
                <div className="font-display text-2xl font-bold text-text-primary">
                  {m.value.toFixed(0)}
                  <span className="text-sm text-text-tertiary font-normal">%</span>
                </div>
                <div className="text-xs text-text-tertiary mt-1">{m.label}</div>
                <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${m.value}%`, background: m.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Timeline chart */}
          <div className="glass-panel rounded-2xl p-4 flex-1 overflow-hidden flex flex-col">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Performance Timeline
            </h3>
            <div className="flex-1 overflow-hidden">
              <ReplayMetricChart metrics={metrics} currentMs={currentMs} />
            </div>
          </div>

          {/* Playback controls */}
          <div className="glass-panel rounded-2xl p-4 flex-shrink-0">
            {/* Progress bar */}
            <div
              className="relative h-2 bg-muted rounded-full cursor-pointer mb-4 group"
              onClick={handleSeek}
            >
              <div
                className="absolute inset-y-0 left-0 bg-cyan rounded-full transition-all duration-100"
                style={{ width: `${progressPct}%` }}
              />
              {/* Feedback markers */}
              {feedback.map(f => (
                <div
                  key={f.id}
                  className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                  style={{
                    left: `${(f.timestamp_ms / totalMs) * 100}%`,
                    background: f.severity === 'warning' ? '#f59e0b' :
                      f.severity === 'success' ? '#00c896' : '#8888aa',
                  }}
                />
              ))}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-cyan rounded-full -ml-1.5 shadow-glow-cyan group-hover:scale-125 transition-transform"
                style={{ left: `${progressPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-text-tertiary">{formatMs(currentMs)}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentMs(Math.max(0, currentMs - 10000))}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  <SkipBack size={16} />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 rounded-full bg-cyan flex items-center justify-center glow-cyan hover:bg-cyan/90 transition-colors"
                >
                  {isPlaying
                    ? <Pause size={16} className="text-void" fill="currentColor" />
                    : <Play size={16} className="text-void" fill="currentColor" />
                  }
                </button>
                <button
                  onClick={() => setCurrentMs(Math.min(totalMs, currentMs + 10000))}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  <SkipForward size={16} />
                </button>
              </div>
              <span className="text-xs font-mono text-text-tertiary">{formatMs(totalMs)}</span>
            </div>
          </div>
        </div>

        {/* Right: tabs panel */}
        <div className="w-80 border-l border-border flex flex-col bg-surface overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border flex-shrink-0">
            {([
              { id: 'feedback', icon: MessageSquare, label: 'Coaching' },
              { id: 'transcript', icon: FileText, label: 'Transcript' },
              { id: 'summary', icon: Award, label: 'Summary' },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors border-b-2',
                  tab === t.id
                    ? 'text-cyan border-cyan'
                    : 'text-text-tertiary border-transparent hover:text-text-secondary'
                )}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'feedback' && (
              <div className="space-y-3">
                <p className="text-xs text-text-tertiary mb-3">
                  {visibleFeedback.length} coaching moments at this point
                </p>
                <AnimatePresence>
                  {visibleFeedback.slice().reverse().map(f => (
                    <motion.div
                      key={f.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={clsx(
                        'rounded-xl p-3 border text-sm',
                        f.severity === 'warning' ? 'bg-amber/5 border-amber/20 text-amber' :
                        f.severity === 'success' ? 'bg-emerald/5 border-emerald/20 text-emerald' :
                        'bg-panel border-border text-text-secondary'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-text-primary text-sm">{f.message}</p>
                          {f.detail && <p className="text-xs opacity-70 mt-0.5">{f.detail}</p>}
                        </div>
                        <span className="text-xs font-mono opacity-50 flex-shrink-0">
                          {formatMs(f.timestamp_ms)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {tab === 'transcript' && (
              <div className="space-y-3">
                {visibleTranscript.map(seg => (
                  <div key={seg.id} className="text-sm">
                    <span className="text-xs font-mono text-text-tertiary mr-2">
                      {formatMs(seg.timestamp_ms)}
                    </span>
                    {seg.text.split(' ').map((word, wi) => {
                      const isFiller = seg.filler_words.includes(word.toLowerCase().replace(/[^a-z]/g, ''));
                      return (
                        <span
                          key={wi}
                          className={isFiller ? 'bg-amber/20 text-amber rounded px-0.5 mx-0.5' : 'text-text-primary'}
                        >
                          {word}{' '}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {tab === 'summary' && session.summary && (
              <div className="space-y-5">
                <div className="text-center py-4">
                  <ScoreRing score={session.summary.overall_score} size={100} label="Overall Score" />
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Key Metrics</h4>
                  <MetricBar label="Avg Confidence" value={session.summary.avg_confidence} color="#00d4ff" />
                  <MetricBar label="Avg Eye Contact" value={session.summary.avg_eye_contact_pct} color="#7c3aed" />
                  <MetricBar label="Avg Posture" value={session.summary.avg_posture_score} color="#00c896" />
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-text-tertiary">Avg Pace</span>
                    <span className="font-mono text-text-primary">{session.summary.avg_pace_wpm.toFixed(0)} WPM</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-tertiary">Filler Words</span>
                    <span className="font-mono text-amber">{session.summary.total_filler_words}</span>
                  </div>
                </div>

                {session.summary.top_issues.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Areas to Improve</h4>
                    {session.summary.top_issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-text-secondary py-1.5 border-b border-border/50">
                        <span className="text-amber mt-0.5">→</span>
                        {issue}
                      </div>
                    ))}
                  </div>
                )}

                {session.summary.strengths.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Strengths</h4>
                    {session.summary.strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-text-secondary py-1.5 border-b border-border/50">
                        <span className="text-emerald mt-0.5">✓</span>
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReplayMetricChart({ metrics, currentMs }: { metrics: MetricSnapshot[]; currentMs: number }) {
  if (metrics.length === 0) {
    return <div className="flex items-center justify-center h-full text-text-tertiary text-sm">No metric data</div>;
  }

  const width = 600;
  const height = 140;
  const maxMs = metrics[metrics.length - 1]?.timestamp_ms || 1;

  const toX = (ms: number) => (ms / maxMs) * width;
  const toY = (val: number) => height - (val / 100) * height;

  const makePath = (values: number[]) => {
    return metrics.map((m, i) => {
      const x = toX(m.timestamp_ms);
      const y = toY(values[i]);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const confPath = makePath(metrics.map(m => m.confidence_score));
  const eyePath = makePath(metrics.map(m => m.eye_contact_pct));
  const cursorX = toX(Math.min(currentMs, maxMs));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      {/* Grid lines */}
      {[25, 50, 75].map(v => (
        <line key={v} x1={0} y1={toY(v)} x2={width} y2={toY(v)}
          stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
      ))}

      {/* Confidence line */}
      <path d={confPath} fill="none" stroke="#00d4ff" strokeWidth={2} opacity={0.8} />
      {/* Eye contact line */}
      <path d={eyePath} fill="none" stroke="#7c3aed" strokeWidth={2} opacity={0.8} />

      {/* Playhead */}
      <line x1={cursorX} y1={0} x2={cursorX} y2={height}
        stroke="#00d4ff" strokeWidth={1.5} opacity={0.6} strokeDasharray="3,3" />
    </svg>
  );
}

function ReplaySkeleton() {
  return (
    <div className="p-8 space-y-4 animate-pulse">
      <div className="h-8 w-64 bg-panel rounded-xl" />
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-panel rounded-2xl" />)}
      </div>
      <div className="h-64 bg-panel rounded-2xl" />
    </div>
  );
}
