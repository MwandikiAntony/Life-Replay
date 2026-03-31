'use client';

interface MetricBarProps {
  label: string;
  label2?: string;
  value: number; // 0–100
  color?: string;
  showValue?: boolean;
}

export function MetricBar({
  label,
  label2,
  value,
  color = '#00d4ff',
  showValue = true,
}: MetricBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="font-mono text-text-primary">
          {label2 ?? `${clamped.toFixed(0)}%`}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full metric-bar-fill"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
    </div>
  );
}
