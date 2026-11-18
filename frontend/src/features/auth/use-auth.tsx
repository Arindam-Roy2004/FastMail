import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { refreshSession, setAccessToken, setSessionLostHandler } from '@/lib/api';
import { authApi } from './api';
import type { User } from './types';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: User }
  | { status: 'anonymous'; user: null; reason?: 'expired' | 'signed-out' };

type AuthContextValue = AuthState & {
  loginWithCode: (code: string) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  useEffect(() => {
    let active = true;
    refreshSession<User>().then((result) => {
      if (!active) return;
      setState(result ? { status: 'authenticated', user: result.user } : { status: 'anonymous', user: null });
    });
    setSessionLostHandler(() => setState({ status: 'anonymous', user: null, reason: 'expired' }));
    return () => {
      active = false;
      setSessionLostHandler(null);
    };
  }, []);

  const loginWithCode = useCallback(async (code: string) => {
    const session = await authApi.loginWithGoogle(code);
    setAccessToken(session.accessToken);
    setState({ status: 'authenticated', user: session.user });
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    // Clear locally even if the call fails: the user asked to leave.
    await authApi.logout().catch(() => undefined);
    setAccessToken(null);
    setState({ status: 'anonymous', user: null, reason: 'signed-out' });
  }, []);

  const value = useMemo(() => ({ ...state, loginWithCode, logout }), [state, loginWithCode, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function useCurrentUser() {
  const auth = useAuth();
  if (auth.status !== 'authenticated') throw new Error('useCurrentUser needs a signed-in user');
  return auth.user;
}
