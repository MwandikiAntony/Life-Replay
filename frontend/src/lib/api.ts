import axios, { AxiosInstance, AxiosError } from 'axios';
import Cookies from 'js-cookie';
import type {
  AuthResponse, User, Session, SessionSummary,
  MetricSnapshot, FeedbackItem, TranscriptSegment,
  DashboardStats, PerformanceTrend, UserSettings,
} from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── Axios instance ────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('lr_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      Cookies.remove('lr_token');
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const getToken = () => Cookies.get('lr_token') || '';
export const setToken = (token: string) => Cookies.set('lr_token', token, { expires: 7 });
export const clearToken = () => Cookies.remove('lr_token');

// ─── Auth ──────────────────────────────────────────────────────────────────

export const authAPI = {
  register: async (email: string, password: string, name: string): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/register', { email, password, name });
    return data;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },

  me: async (): Promise<User> => {
    const { data } = await api.get('/auth/me');
    return data;
  },

  getSettings: async (): Promise<UserSettings> => {
    const { data } = await api.get('/auth/settings');
    return data;
  },

  updateSettings: async (updates: Partial<UserSettings>): Promise<UserSettings> => {
    const { data } = await api.put('/auth/settings', updates);
    return data;
  },
};

// ─── Sessions ──────────────────────────────────────────────────────────────

export const sessionsAPI = {
  create: async (title?: string, description?: string): Promise<Session> => {
    const { data } = await api.post('/sessions', { title, description });
    return data;
  },

  list: async (limit = 20): Promise<Session[]> => {
    const { data } = await api.get(`/sessions?limit=${limit}`);
    return data;
  },

  get: async (sessionId: string): Promise<Session> => {
    const { data } = await api.get(`/sessions/${sessionId}`);
    return data;
  },

  delete: async (sessionId: string): Promise<void> => {
    await api.delete(`/sessions/${sessionId}`);
  },

  getMetrics: async (sessionId: string): Promise<MetricSnapshot[]> => {
    const { data } = await api.get(`/sessions/${sessionId}/metrics`);
    return data;
  },

  getFeedback: async (sessionId: string): Promise<FeedbackItem[]> => {
    const { data } = await api.get(`/sessions/${sessionId}/feedback`);
    return data;
  },

  getTranscript: async (sessionId: string): Promise<TranscriptSegment[]> => {
    const { data } = await api.get(`/sessions/${sessionId}/transcript`);
    return data;
  },

  getDashboard: async (): Promise<DashboardStats> => {
    const { data } = await api.get('/sessions/dashboard');
    return data;
  },

  getTrends: async (days = 14): Promise<PerformanceTrend[]> => {
    const { data } = await api.get(`/sessions/trends?days=${days}`);
    return data;
  },
};

export default api;
