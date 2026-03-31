'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Zap } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-void bg-grid flex items-center justify-center px-4">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-violet/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-cyan/10 border border-cyan/30 flex items-center justify-center glow-cyan">
              <Zap size={16} className="text-cyan" />
            </div>
            <span className="font-display font-bold text-xl text-text-primary">LifeReplay</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Welcome back</h1>
          <p className="text-text-secondary text-sm">Sign in to continue your coaching journey</p>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="input-field"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="input-field pr-12"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-text-tertiary">
            Don't have an account?{' '}
            <Link href="/register" className="text-cyan hover:text-cyan/80 transition-colors font-medium">
              Create one
            </Link>
          </div>
        </div>

        {/* Demo hint */}
        <p className="text-center text-xs text-text-tertiary mt-4">
          Demo: use any email/password to explore
        </p>
      </motion.div>
    </div>
  );
}
