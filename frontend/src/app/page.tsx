'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
  useAuthStore.getState().fetchMe();
}, []);

  return (
    <div className="min-h-screen bg-void flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-cyan animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-cyan animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-cyan animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
