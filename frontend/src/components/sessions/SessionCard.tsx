'use client';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Clock, Award, Play, Trash2, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { Session } from '@/types';

const STATUS_STYLES = {
  pending:    'bg-muted/50 text-text-tertiary border-border',
  live:       'bg-rose/10 text-rose border-rose/30 animate-pulse',
  processing: 'bg-amber/10 text-amber border-amber/30',
  completed:  'bg-emerald/10 text-emerald border-emerald/30',
  failed:     'bg-rose/10 text-rose border-rose/20',
};

interface SessionCardProps {
  session: Session;
  onDelete?: () => void;
}

export function SessionCard({ session, onDelete }: SessionCardProps) {
  const score = session.summary?.overall_score;

  return (
    <div className="glass-panel rounded-2xl p-5 hover:border-cyan/20 transition-all duration-200 group flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-text-primary text-sm truncate">{session.title}</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
          </p>
        </div>
        <div className={clsx('text-xs px-2.5 py-1 rounded-full border capitalize flex-shrink-0', STATUS_STYLES[session.status])}>
          {session.status === 'processing' && <Loader2 size={10} className="inline mr-1 animate-spin" />}
          {session.status}
        </div>
      </div>

      {/* Score */}
      {score !== undefined && (
        <div className="flex items-center gap-2">
          <Award size={14} className="text-cyan" />
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan transition-all"
              style={{ width: `${score}%` }}
            />
          </div>
          <span className="text-xs font-mono text-cyan">{score.toFixed(0)}</span>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-text-tertiary">
        {session.duration_seconds && (
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {Math.floor(session.duration_seconds / 60)}m {session.duration_seconds % 60}s
          </span>
        )}
        {session.transcript_count > 0 && (
          <span>{session.transcript_count} segments</span>
        )}
        {session.feedback_count > 0 && (
          <span>{session.feedback_count} tips</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
        {session.status === 'completed' ? (
          <Link
            href={`/sessions/${session.session_id}`}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-cyan hover:text-cyan/80 py-2 rounded-xl hover:bg-cyan/5 transition-colors"
          >
            <Play size={12} fill="currentColor" />
            Replay
          </Link>
        ) : (
          <div className="flex-1" />
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-2 rounded-xl text-text-tertiary hover:text-rose hover:bg-rose/5 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
