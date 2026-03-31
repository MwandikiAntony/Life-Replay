'use client';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText } from 'lucide-react';
import { clsx } from 'clsx';

interface TranscriptEntry {
  text: string;
  fillerWords: string[];
  ts: number;
}

interface LiveTranscriptProps {
  segments: TranscriptEntry[];
  className?: string;
}

export function LiveTranscript({ segments, className }: LiveTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments.length]);

  return (
    <div className={clsx('glass-panel rounded-2xl p-5 overflow-hidden flex flex-col', className)}>
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <FileText size={14} className="text-text-tertiary" />
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Live Transcript</h3>
        {segments.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
            <span className="text-xs text-emerald">Live</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {segments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <FileText size={24} className="text-text-tertiary opacity-30 mb-2" />
            <p className="text-xs text-text-tertiary">Your speech will appear here in real-time</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {segments.map((seg, i) => (
              <motion.div
                key={seg.ts}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm leading-relaxed"
              >
                {renderWithFillers(seg.text, seg.fillerWords)}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function renderWithFillers(text: string, fillerWords: string[]) {
  if (!fillerWords.length) {
    return <span className="text-text-primary">{text}</span>;
  }
  const fillerSet = new Set(fillerWords.map(w => w.toLowerCase()));
  const words = text.split(' ');
  return (
    <span>
      {words.map((word, i) => {
        const clean = word.toLowerCase().replace(/[^a-z]/g, '');
        const isFiller = fillerSet.has(clean);
        return (
          <span key={i}>
            <span className={isFiller
              ? 'bg-amber/20 text-amber px-0.5 rounded'
              : 'text-text-primary'
            }>
              {word}
            </span>
            {i < words.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </span>
  );
}
