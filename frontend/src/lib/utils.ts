import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

export function scoreColor(score: number): string {
  if (score >= 75) return '#00c896';
  if (score >= 50) return '#00d4ff';
  if (score >= 30) return '#f59e0b';
  return '#f43f5e';
}

export function clampScore(v: number): number {
  return Math.max(0, Math.min(100, v));
}
