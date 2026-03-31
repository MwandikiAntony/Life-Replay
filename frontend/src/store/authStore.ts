import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI, setToken, clearToken } from '@/lib/api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>; // corrected order
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await authAPI.login(email, password);
          setToken(res.access_token);
          set({ user: res.user, isAuthenticated: true, isLoading: false });
        } catch (err: any) {
          set({ isLoading: false });
          throw err;
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true });
        try {
          const res = await authAPI.register(email, password, name);
          setToken(res.access_token);
          set({ user: res.user, isAuthenticated: true, isLoading: false });
        } catch (err: any) {
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