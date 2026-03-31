'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Video, History, BarChart3,
  Settings, LogOut, Zap, User,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/session/new', icon: Video, label: 'New Session' },
  { href: '/sessions', icon: History, label: 'Sessions' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, logout, fetchMe } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchMe();
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-void">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-border bg-surface">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan/10 border border-cyan/30 flex items-center justify-center glow-cyan">
              <Zap size={18} className="text-cyan" />
            </div>
            <div>
              <div className="font-display font-bold text-text-primary text-lg leading-none">LifeReplay</div>
              <div className="text-xs text-text-tertiary mt-0.5">AI Coach</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-cyan/10 text-cyan border border-cyan/20'
                    : 'text-text-secondary hover:text-text-primary hover:bg-panel'
                }`}
              >
                <item.icon
                  size={17}
                  className={`transition-colors ${isActive ? 'text-cyan' : 'text-text-tertiary group-hover:text-text-secondary'}`}
                />
                {item.label}
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-violet/20 border border-violet/30 flex items-center justify-center flex-shrink-0">
              <User size={14} className="text-violet-bright" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{user?.name}</p>
              <p className="text-xs text-text-tertiary truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm text-text-tertiary hover:text-rose hover:bg-rose/5 transition-all duration-150"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="page-enter">
          {children}
        </div>
      </main>
    </div>
  );
}
