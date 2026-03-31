'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plus, Search, Trash2 } from 'lucide-react';
import { sessionsAPI } from '@/lib/api';
import type { Session } from '@/types';
import { SessionCard } from '@/components/sessions/SessionCard';
import toast from 'react-hot-toast';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    sessionsAPI.list(50)
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = sessions.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Delete this session?')) return;
    try {
      await sessionsAPI.delete(sessionId);
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
      toast.success('Session deleted');
    } catch {
      toast.error('Failed to delete session');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary">Sessions</h1>
          <p className="text-text-secondary text-sm mt-1">{sessions.length} total sessions</p>
        </div>
        <Link href="/session/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          New Session
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search sessions..."
          className="input-field pl-10"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 bg-panel rounded-2xl border border-border animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-text-secondary mb-2">No sessions found</p>
          <Link href="/session/new" className="text-cyan text-sm hover:underline">
            Start your first session →
          </Link>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {filtered.map((session, i) => (
            <motion.div
              key={session.session_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <SessionCard
                session={session}
                onDelete={() => handleDelete(session.session_id)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
