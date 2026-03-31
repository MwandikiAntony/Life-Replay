'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Zap, AlertTriangle, CheckCircle2, Eye,
  Mic, Activity, Wind, TrendingDown,
} from 'lucide-react';
import type { LiveCoachingMessage, FeedbackType } from '@/types';

const TYPE_CONFIG: Record<FeedbackType, { icon: React.ComponentType<any>; label: string }> = {
  pace:        { icon: Activity,      label: 'Pace' },
  filler:      { icon: Wind,          label: 'Fillers' },
  eye_contact: { icon: Eye,           label: 'Eye Contact' },
  posture:     { icon: TrendingDown,  label: 'Posture' },
  confidence:  { icon: Zap,           label: 'Confidence' },
  volume:      { icon: Mic,           label: 'Volume' },
  clarity:     { icon: Activity,      label: 'Clarity' },
  positive:    { icon: CheckCircle2,  label: 'Great!' },
};

const SEVERITY_STYLES = {
  warning: 'border-amber/30 bg-amber/8',
  info:    'border-cyan/20 bg-cyan/5',
  success: 'border-emerald/30 bg-emerald/8',
};

const SEVERITY_ICON_COLOR = {
  warning: 'text-amber',
  info:    'text-cyan',
  success: 'text-emerald',
};

interface CoachingFeedProps {
  messages: LiveCoachingMessage[];
}

export function CoachingFeed({ messages }: CoachingFeedProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
        Live Coaching
      </h3>

      {messages.length === 0 && (
        <div className="text-center py-8 text-text-tertiary">
          <Zap size={20} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs">Coaching tips will appear here</p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {messages.slice().reverse().map((msg) => {
          const config = TYPE_CONFIG[msg.feedback_type] || TYPE_CONFIG.confidence;
          const Icon = config.icon;

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={clsx(
                'rounded-xl border p-3 flex items-start gap-3',
                SEVERITY_STYLES[msg.severity]
              )}
            >
              <div className={clsx('flex-shrink-0 mt-0.5', SEVERITY_ICON_COLOR[msg.severity])}>
                <Icon size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary leading-tight">
                  {msg.message}
                </p>
                {msg.detail && (
                  <p className="text-xs text-text-tertiary mt-1 leading-snug">{msg.detail}</p>
                )}
                <p className="text-xs text-text-tertiary mt-1 opacity-60">{config.label}</p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
