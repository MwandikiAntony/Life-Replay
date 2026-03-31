import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI, setToken, clearToken, getToken } from '@/lib/api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      // ✅ LOGIN
      login: async (email, password) => {
        set({ isLoading: true });

        try {
          const res = await authAPI.login(email, password);

          // ✅ Save token globally (localStorage + axios header)
          setToken(res.access_token);

          set({
            user: res.user ?? null,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      // ✅ REGISTER
      register: async (name, email, password) => {
        set({ isLoading: true });

        try {
          const res = await authAPI.register(email, password, name);

          // ✅ Save token
          setToken(res.access_token);

          set({
            user: res.user ?? null,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      // ✅ LOGOUT
      logout: () => {
        clearToken();

        set({
          user: null,
          isAuthenticated: false,
        });

        // Redirect safely
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      },

      // ✅ FETCH CURRENT USER (IMPORTANT FOR REFRESH)
      fetchMe: async () => {
        const token = getToken();

        // 🚫 No token → not authenticated
        if (!token) {
          set({ user: null, isAuthenticated: false });
          return;
        }

        try {
          // Ensure token is applied to API client
          setToken(token);

          const user = await authAPI.me();

          set({
            user,
            isAuthenticated: true,
          });
        } catch (err) {
          // Token invalid or expired
          clearToken();

          set({
            user: null,
            isAuthenticated: false,
          });
        }
      },
    }),
    {
      name: 'lifereplay-auth',

      // ✅ Only persist safe fields
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),

      // ✅ Rehydrate: restore token → avoid auth errors on reload
      onRehydrateStorage: () => (state) => {
        if (state) {
          const token = getToken();
          if (token) {
            setToken(token);
          }
        }
      },
    }
  )
);