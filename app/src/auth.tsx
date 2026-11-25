import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken as setApiToken } from './api';
import { readToken, saveToken } from './storage';
import type { User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, displayName: string) => Promise<User>;
  signInWithGoogle: (idToken: string) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<User | null>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readToken();
      if (!stored) {
        if (!cancelled) setLoading(false);
        return;
      }
      setApiToken(stored);
      try {
        const payload = await api.get<{ user: User }>('/auth/me');
        if (!cancelled) setUser(payload.user);
      } catch {
        setApiToken(null);
        await saveToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applySession = useCallback(async (payload: { token: string; user: User }) => {
    setApiToken(payload.token);
    await saveToken(payload.token);
    setUser(payload.user);
    return payload.user;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) =>
      applySession(await api.post<{ token: string; user: User }>('/auth/login', { email, password })),
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string) =>
      applySession(
        await api.post<{ token: string; user: User }>('/auth/register', { email, password, displayName }),
      ),
    [applySession],
  );

  const signInWithGoogle = useCallback(
    async (idToken: string) =>
      applySession(await api.post<{ token: string; user: User }>('/auth/google', { idToken })),
    [applySession],
  );

  const signOut = useCallback(async () => {
    setApiToken(null);
    await saveToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const payload = await api.get<{ user: User }>('/auth/me');
      setUser(payload.user);
      return payload.user;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, register, signInWithGoogle, signOut, refresh, setUser }),
    [user, loading, signIn, register, signInWithGoogle, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
