'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI, setToken, clearToken } from '@/lib/api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          // Normalize email to avoid case issues
          const normalizedEmail = email.trim().toLowerCase();
          const res = await authAPI.login(normalizedEmail, password);
          setToken(res.access_token);
          set({ user: res.user, isAuthenticated: true, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true });
        try {
          const normalizedEmail = email.trim().toLowerCase();
          const res = await authAPI.register(normalizedEmail, password, name);
          setToken(res.access_token);
          set({ user: res.user, isAuthenticated: true, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: () => {
        clearToken();
        set({ user: null, isAuthenticated: false });
        window.location.href = '/login';
      },

      fetchMe: async () => {
        try {
          const user = await authAPI.me();
          set({ user, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
          clearToken();
        }
      },
    }),
    {
      name: 'lifereplay-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);