'use client';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import type { PerformanceTrend } from '@/types';
import { format, parseISO } from 'date-fns';

interface TrendChartProps {
  data: PerformanceTrend[];
  height?: number;
  showAll?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel rounded-xl p-3 text-xs border border-border shadow-xl">
      <p className="text-text-tertiary mb-2 font-medium">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-text-secondary capitalize">{p.name}:</span>
          <span className="text-text-primary font-mono">{p.value?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
};

export function TrendChart({ data, height = 220, showAll = false }: TrendChartProps) {
  const chartData = data.map(d => ({
    ...d,
    date: format(parseISO(d.date), 'MMM d'),
  }));

  const lines = showAll
    ? [
        { key: 'overall_score', color: '#00d4ff', name: 'Overall' },
        { key: 'confidence_score', color: '#9f6ef7', name: 'Confidence' },
        { key: 'eye_contact_pct', color: '#00c896', name: 'Eye Contact' },
        { key: 'posture_score', color: '#f59e0b', name: 'Posture' },
      ]
    : [
        { key: 'overall_score', color: '#00d4ff', name: 'Overall Score' },
        { key: 'confidence_score', color: '#7c3aed', name: 'Confidence' },
      ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.04)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: '#555570', fontSize: 11, fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: '#555570', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        {showAll && (
          <Legend
            wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-body)' }}
            iconType="circle"
            iconSize={6}
          />
        )}
        {lines.map(l => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.name}
            stroke={l.color}
            strokeWidth={2}
            dot={{ fill: l.color, r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
