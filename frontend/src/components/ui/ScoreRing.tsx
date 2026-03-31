'use client';
import { useEffect, useRef } from 'react';
import { clsx } from 'clsx';

interface ScoreRingProps {
  score: number; // 0–100
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 8,
  label = 'Score',
  className,
}: ScoreRingProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 75 ? '#00c896' :
    score >= 50 ? '#00d4ff' :
    score >= 30 ? '#f59e0b' :
    '#f43f5e';

  const glowId = `glow-${Math.random().toString(36).slice(2)}`;

  return (
    <div className={clsx('flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          <defs>
            <filter id={glowId}>
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />

          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="score-arc"
            filter={`url(#${glowId})`}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-display font-bold leading-none"
            style={{ fontSize: size * 0.22, color }}
          >
            {score.toFixed(0)}
          </span>
          <span
            className="text-text-tertiary leading-none mt-1"
            style={{ fontSize: size * 0.09 }}
          >
            / 100
          </span>
        </div>
      </div>

      {label && (
        <span className="text-xs text-text-tertiary font-medium">{label}</span>
      )}
    </div>
  );
}
