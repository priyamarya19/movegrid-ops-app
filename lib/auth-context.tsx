import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

import * as api from './api';
import { clearQueryCache } from './queryCache';

const TOKEN_KEY = 'mg_token';
const USER_KEY = 'mg_user';

type AuthUser = {
  name: string;
  role: string;
  email?: string;
  /** Dashboard sections enabled for this user in the hamburger menu. */
  appPages?: string[];
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  /** True until the persisted session has been loaded from secure storage. */
  isLoading: boolean;
  /** Set when the last logout was forced by an expired token (for the login notice). */
  sessionExpired: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-fetch the profile so admin changes to app_pages apply without re-login. */
  refreshAppPages: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  // Guards signOut against re-entrant / concurrent 401s (idempotency).
  const signingOut = useRef(false);

  // Restore a persisted session on launch.
  useEffect(() => {
    (async () => {
      try {
        const [savedToken, savedUser] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        if (savedToken) {
          setToken(savedToken);
          setUser(savedUser ? JSON.parse(savedUser) : null);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await api.login(email.trim(), password);
    const nextUser: AuthUser = { name: res.name, role: res.role, email: email.trim(), appPages: res.app_pages ?? [] };
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, res.token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser)),
    ]);
    signingOut.current = false;
    setSessionExpired(false);
    setToken(res.token);
    setUser(nextUser);
  };

  const signOut = async () => {
    // Idempotent within a single burst: concurrent 401s run the teardown once.
    if (signingOut.current) return;
    signingOut.current = true;
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY),
        SecureStore.deleteItemAsync(USER_KEY),
      ]);
      clearQueryCache();
      setToken(null);
      setUser(null);
    } finally {
      // Reset the latch so a later, genuine expiry-logout isn't swallowed as a
      // no-op. Without this, a forced logout leaves the latch stuck `true`.
      signingOut.current = false;
    }
  };

  const refreshAppPages = async () => {
    if (!token) return;
    try {
      const profile = await api.getMyProfile(token);
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, appPages: profile.app_pages ?? [] };
        void SecureStore.setItemAsync(USER_KEY, JSON.stringify(next));
        return next;
      });
    } catch {
      // Non-fatal — the menu just keeps the last-known page list.
    }
  };

  // Register signOut as the global 401 handler so an expired token anywhere in
  // the API layer bounces the user to /login via the root auth guard.
  useEffect(() => {
    api.setUnauthorizedHandler((code) => {
      if (code === 'token_expired') setSessionExpired(true);
      void signOut();
    });
    return () => api.setUnauthorizedHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isLoading, sessionExpired, signIn, signOut, refreshAppPages }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
