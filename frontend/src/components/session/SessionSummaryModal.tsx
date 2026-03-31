'use client';
import { motion } from 'framer-motion';
import { Award, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import type { SessionSummary } from '@/types';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { MetricBar } from '@/components/ui/MetricBar';

interface SessionSummaryModalProps {
  summary: SessionSummary;
  sessionId: string;
  onClose: () => void;
}

export function SessionSummaryModal({ summary, sessionId, onClose }: SessionSummaryModalProps) {
  return (
    <div className="fixed inset-0 bg-void/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        className="glass-panel rounded-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-cyan/10 to-violet/10 p-8 text-center border-b border-border">
          <div className="flex justify-center mb-4">
            <ScoreRing score={summary.overall_score} size={110} label="Overall Score" />
          </div>
          <h2 className="font-display text-2xl font-bold text-text-primary mb-1">Session Complete!</h2>
          <p className="text-text-secondary text-sm">
            {Math.floor(summary.duration_seconds / 60)}m {summary.duration_seconds % 60}s · {summary.total_words} words
          </p>
        </div>

        {/* Metrics */}
        <div className="p-6 space-y-4 border-b border-border">
          <MetricBar label="Avg Confidence" value={summary.avg_confidence} color="#00d4ff" />
          <MetricBar label="Avg Eye Contact" value={summary.avg_eye_contact_pct} color="#7c3aed" />
          <MetricBar label="Avg Posture" value={summary.avg_posture_score} color="#00c896" />
          <div className="flex justify-between text-sm pt-1">
            <span className="text-text-tertiary">Avg Speaking Pace</span>
            <span className="font-mono text-text-primary">{summary.avg_pace_wpm.toFixed(0)} WPM</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-tertiary">Filler Words Used</span>
            <span className={`font-mono ${summary.total_filler_words > 10 ? 'text-amber' : 'text-emerald'}`}>
              {summary.total_filler_words}
            </span>
          </div>
        </div>

        {/* Insights */}
        <div className="p-6 space-y-4">
          {summary.strengths.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs text-emerald font-semibold uppercase tracking-wider mb-2">
                <CheckCircle2 size={12} />
                Strengths
              </div>
              {summary.strengths.map((s, i) => (
                <p key={i} className="text-sm text-text-secondary py-1">✓ {s}</p>
              ))}
            </div>
          )}
          {summary.top_issues.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs text-amber font-semibold uppercase tracking-wider mb-2">
                <AlertTriangle size={12} />
                Areas to Improve
              </div>
              {summary.top_issues.map((issue, i) => (
                <p key={i} className="text-sm text-text-secondary py-1">→ {issue}</p>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            className="flex-1 btn-primary flex items-center justify-center gap-2"
          >
            View Full Replay <ArrowRight size={14} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
