import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AccessRole, Session } from '../types';
import * as api from '../services/api';
import { signInWithGoogle } from '../services/firebase';

interface AuthValue {
  session: Session | null;
  /** True until the refresh cookie has been checked on startup. */
  isRestoring: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string; workspaceName: string }) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  /** Convenience for permission checks in the UI. */
  can: (action: 'manageTeam' | 'createMeeting' | 'editAnyTask' | 'deleteTask' | 'deleteMeeting') => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

const ALLOWED: Record<string, AccessRole[]> = {
  manageTeam: ['owner', 'admin'],
  createMeeting: ['owner', 'admin', 'member'],
  editAnyTask: ['owner', 'admin'],
  deleteTask: ['owner', 'admin', 'member'],
  // The API restricts this to owner and admin; mirror it so the UI does not
  // offer an action that will come back as 403.
  deleteMeeting: ['owner', 'admin'],
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // The access token lives in memory, so every fresh page load asks the server
  // to restore the session from its httpOnly refresh cookie. Do not gate this
  // request on localStorage: that value is only a UI hint and may be cleared
  // independently while the secure cookie is still valid.
  //
  // If the API cannot be reached (e.g. the dev server reloaded the page while
  // the backend was still starting) keep retrying for a while instead of
  // treating the user as signed out; only an explicit 401 means "no session".
  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const started = Date.now();
    const attempt = (delay: number) => {
      api
        .refresh()
        .then((restored) => {
          if (cancelled) return;
          setSession(restored);
          setIsRestoring(false);
        })
        .catch((error) => {
          if (cancelled) return;
          if (api.isTransientError(error) && Date.now() - started < 15_000) {
            timer = window.setTimeout(() => attempt(Math.min(delay * 2, 3000)), delay);
            return;
          }
          /* the cookie expired or was cleared; the login screen handles it */
          setIsRestoring(false);
        });
    };
    attempt(400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  // A refresh that fails mid-session must drop the user back to the login screen.
  useEffect(() => {
    api.onUnauthenticated(() => setSession(null));
    return () => api.onUnauthenticated(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setSession(await api.login(email, password));
  }, []);

  const register = useCallback<AuthValue['register']>(async (input) => {
    setSession(await api.register(input));
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setSession(await api.loginWithGoogle(await signInWithGoogle()));
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setSession(null);
  }, []);

  const can = useCallback<AuthValue['can']>(
    (action) => (session ? ALLOWED[action].includes(session.accessRole) : false),
    [session],
  );

  const value = useMemo<AuthValue>(
    () => ({ session, isRestoring, login, register, loginWithGoogle, logout, can }),
    [session, isRestoring, login, register, loginWithGoogle, logout, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
