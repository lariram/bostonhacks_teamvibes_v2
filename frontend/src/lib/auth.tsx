import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, UNAUTHORIZED_EVENT } from './api';
import type { Me, Meta, SelfUser } from './types';

interface AuthState {
  meta: Meta | null;
  me: Me | null;
  loading: boolean;
  /** Where to go right after logging in / signing up */
  landing: string;
  /** Store a fresh session and load the profile */
  signIn: (token: string, landing?: string) => Promise<void>;
  signOut: () => void;
  refresh: () => Promise<void>;
  setUser: (u: SelfUser) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [landing, setLanding] = useState('/discover');

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      return;
    }
    try {
      setMe(await api<Me>('/me'));
    } catch {
      setToken(null);
      setMe(null);
    }
  }, []);

  useEffect(() => {
    Promise.all([api<Meta>('/meta').then(setMeta).catch(() => undefined), refresh()]).finally(() => setLoading(false));
    const onUnauthorized = () => {
      setToken(null);
      setMe(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [refresh]);

  const signIn = useCallback(
    async (token: string, next = '/discover') => {
      setLanding(next);
      setToken(token);
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(() => {
    api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setToken(null);
    setMe(null);
    sessionStorage.clear();
  }, []);

  const setUser = useCallback((user: SelfUser) => setMe((m) => (m ? { ...m, user } : m)), []);

  return (
    <AuthContext.Provider value={{ meta, me, loading, landing, signIn, signOut, refresh, setUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
