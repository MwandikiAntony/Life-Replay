'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { sessionsAPI } from '@/lib/api';
import type { PerformanceTrend, DashboardStats } from '@/types';
import { TrendChart } from '@/components/analytics/TrendChart';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { MetricBar } from '@/components/ui/MetricBar';

export default function AnalyticsPage() {
  const [trends, setTrends] = useState<PerformanceTrend[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      sessionsAPI.getTrends(days),
      sessionsAPI.getDashboard(),
    ]).then(([t, s]) => {
      setTrends(t);
      setStats(s);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  const latestTrend = trends[trends.length - 1];
  const firstTrend = trends[0];
  const improvement = latestTrend && firstTrend
    ? latestTrend.overall_score - firstTrend.overall_score
    : 0;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary">Analytics</h1>
          <p className="text-text-secondary text-sm mt-1">Track your communication growth over time</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                days === d
                  ? 'bg-cyan/10 border border-cyan/30 text-cyan'
                  : 'border border-border text-text-tertiary hover:text-text-secondary hover:border-border/80'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-panel rounded-2xl" />)}
          </div>
          <div className="h-80 bg-panel rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Sessions', value: stats?.total_sessions ?? 0, suffix: '' },
              { label: 'Practice Time', value: stats?.total_practice_minutes ?? 0, suffix: 'm' },
              { label: 'Overall Improvement', value: improvement.toFixed(1), suffix: 'pts', highlight: improvement > 0 },
              { label: 'Avg Score', value: latestTrend?.overall_score?.toFixed(0) ?? '—', suffix: '' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="glass-panel rounded-2xl p-5"
              >
                <div className={`font-display text-2xl font-bold ${item.highlight ? 'text-emerald' : 'text-text-primary'}`}>
                  {item.value}{item.suffix}
                </div>
                <div className="text-xs text-text-tertiary mt-1">{item.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Main trend chart */}
          {trends.length > 0 ? (
            <div className="glass-panel rounded-2xl p-6 mb-6">
              <h2 className="font-display font-semibold text-text-primary mb-6">Overall Score Trend</h2>
              <TrendChart data={trends} height={280} showAll />
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-12 text-center mb-6">
              <p className="text-text-secondary">No sessions in this period. Complete sessions to see trends.</p>
            </div>
          )}

          {/* Breakdown grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Scores breakdown */}
            <div className="glass-panel rounded-2xl p-6">
              <h3 className="font-display font-semibold text-text-primary mb-5">Latest Scores</h3>
              {latestTrend ? (
                <div className="space-y-4">
                  <MetricBar label="Confidence" value={latestTrend.confidence_score} color="#00d4ff" />
                  <MetricBar label="Eye Contact" value={latestTrend.eye_contact_pct} color="#7c3aed" />
                  <MetricBar label="Posture" value={latestTrend.posture_score} color="#00c896" />
                  <div className="pt-3 flex items-center justify-between text-sm">
                    <span className="text-text-tertiary">Speaking Pace</span>
                    <span className="font-mono text-text-primary">{latestTrend.pace_wpm.toFixed(0)} WPM</span>
                  </div>
                </div>
              ) : (
                <p className="text-text-tertiary text-sm">No data yet</p>
              )}
            </div>

            {/* Score ring */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col items-center justify-center">
              <h3 className="font-display font-semibold text-text-primary mb-6 self-start">Overall Rating</h3>
              <ScoreRing
                score={latestTrend?.overall_score ?? 0}
                size={140}
                label="Latest Score"
              />
              {improvement !== 0 && (
                <p className={`text-sm mt-4 font-medium ${improvement > 0 ? 'text-emerald' : 'text-rose'}`}>
                  {improvement > 0 ? '↑' : '↓'} {Math.abs(improvement).toFixed(1)} pts vs. first session
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
