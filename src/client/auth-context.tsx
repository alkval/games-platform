import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface SignedInUser {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
}

interface AuthState {
  user: SignedInUser | null;
  gameToken: string | null;
  googleIsConfigured: boolean;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [gameToken, setGameToken] = useState<string | null>(null);
  const [googleIsConfigured, setGoogleIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => response.json())
      .then((data: { user: SignedInUser | null; gameToken: string | null; googleIsConfigured: boolean }) => {
        setUser(data.user);
        setGameToken(data.gameToken);
        setGoogleIsConfigured(data.googleIsConfigured);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      gameToken,
      googleIsConfigured,
      loading,
      logout: async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        setUser(null);
        setGameToken(null);
      },
    }),
    [gameToken, googleIsConfigured, loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
