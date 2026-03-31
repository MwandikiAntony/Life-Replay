'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Video, Clock, TrendingUp, Eye, Award, ArrowRight,
  ChevronRight, Flame, Target,
} from 'lucide-react';
import { sessionsAPI } from '@/lib/api';
import type { DashboardStats, PerformanceTrend } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { MetricBar } from '@/components/ui/MetricBar';
import { SessionCard } from '@/components/sessions/SessionCard';
import { TrendChart } from '@/components/analytics/TrendChart';
import { formatDuration } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<PerformanceTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      sessionsAPI.getDashboard(),
      sessionsAPI.getTrends(14),
    ]).then(([s, t]) => {
      setStats(s);
      setTrends(t);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-text-secondary text-sm mb-1">{greeting},</p>
          <h1 className="font-display text-3xl font-bold text-text-primary">
            {user?.name?.split(' ')[0] || 'Coach'} 👋
          </h1>
          <p className="text-text-secondary text-sm mt-1">Here's your performance overview</p>
        </div>
        <Link href="/session/new" className="btn-primary flex items-center gap-2">
          <Video size={16} />
          Start Session
        </Link>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={<Video size={18} className="text-cyan" />}
              label="Total Sessions"
              value={stats?.total_sessions ?? 0}
              color="cyan"
            />
            <StatCard
              icon={<Clock size={18} className="text-violet-bright" />}
              label="Practice Time"
              value={`${stats?.total_practice_minutes ?? 0}m`}
              color="violet"
            />
            <StatCard
              icon={<TrendingUp size={18} className="text-emerald" />}
              label="Avg Confidence"
              value={`${stats?.avg_confidence_score?.toFixed(0) ?? 0}%`}
              color="emerald"
              trend={stats?.improvement_trend}
            />
            <StatCard
              icon={<Eye size={18} className="text-amber" />}
              label="Eye Contact"
              value={`${stats?.avg_eye_contact_pct?.toFixed(0) ?? 0}%`}
              color="amber"
            />
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trend chart - spans 2 cols */}
            <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-display font-semibold text-text-primary">Performance Trend</h2>
                  <p className="text-xs text-text-tertiary mt-0.5">Last 14 sessions</p>
                </div>
                <Link href="/analytics" className="text-xs text-cyan hover:text-cyan/80 flex items-center gap-1">
                  View all <ArrowRight size={12} />
                </Link>
              </div>
              {trends.length > 0 ? (
                <TrendChart data={trends} height={200} />
              ) : (
                <EmptyTrendPlaceholder />
              )}
            </div>

            {/* Score breakdown */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-display font-semibold text-text-primary mb-6">Current Scores</h2>
              <div className="flex justify-center mb-6">
                <ScoreRing
                  score={stats?.avg_confidence_score ?? 0}
                  size={120}
                  label="Overall"
                />
              </div>
              <div className="space-y-4">
                <MetricBar label="Confidence" value={stats?.avg_confidence_score ?? 0} color="#00d4ff" />
                <MetricBar label="Eye Contact" value={stats?.avg_eye_contact_pct ?? 0} color="#7c3aed" />
              </div>
            </div>
          </div>

          {/* Recent sessions */}
          <div className="mt-6 glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-semibold text-text-primary">Recent Sessions</h2>
              <Link href="/sessions" className="text-xs text-cyan hover:text-cyan/80 flex items-center gap-1">
                All sessions <ChevronRight size={12} />
              </Link>
            </div>
            {stats?.recent_sessions?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {stats.recent_sessions.slice(0, 6).map(s => (
                  <SessionCard key={s.session_id} session={s} />
                ))}
              </div>
            ) : (
              <EmptySessionsPlaceholder />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon, label, value, color, trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'cyan' | 'violet' | 'emerald' | 'amber';
  trend?: number;
}) {
  const colorMap = {
    cyan: 'border-cyan/20 bg-cyan/5',
    violet: 'border-violet/20 bg-violet/5',
    emerald: 'border-emerald/20 bg-emerald/5',
    amber: 'border-amber/20 bg-amber/5',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-panel rounded-2xl p-5 border ${colorMap[color]}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl bg-panel flex items-center justify-center">{icon}</div>
        {trend !== undefined && trend !== 0 && (
          <span className={`text-xs font-mono ${trend > 0 ? 'text-emerald' : 'text-rose'}`}>
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="font-display text-2xl font-bold text-text-primary">{value}</div>
      <div className="text-xs text-text-tertiary mt-1">{label}</div>
    </motion.div>
  );
}

function EmptyTrendPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-center">
      <Target size={32} className="text-text-tertiary mb-3 opacity-40" />
      <p className="text-sm text-text-tertiary">Complete sessions to see your trend</p>
    </div>
  );
}

function EmptySessionsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Flame size={32} className="text-text-tertiary mb-3 opacity-40" />
      <p className="text-sm text-text-secondary mb-1">No sessions yet</p>
      <p className="text-xs text-text-tertiary mb-4">Start your first coaching session to begin</p>
      <Link href="/session/new" className="btn-primary text-sm px-4 py-2">
        Start Now →
      </Link>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-panel rounded-2xl border border-border" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-80 bg-panel rounded-2xl border border-border" />
        <div className="h-80 bg-panel rounded-2xl border border-border" />
      </div>
    </div>
  );
}
