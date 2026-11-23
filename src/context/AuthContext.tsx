import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiRequest, getAccessToken, setAccessToken, setOnUnauthorized } from '../lib/api.ts';
import type { HealthResponse, User } from '../types/index.ts';

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  health: HealthResponse | null;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    city?: string;
    bio?: string;
    skills?: string[];
    interests?: string[];
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setUserDirect: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const syncToken = useCallback((nextToken: string | null) => {
    setAccessToken(nextToken);
    setToken(nextToken);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      syncToken(null);
      setUser(null);
    });
    return () => setOnUnauthorized(null);
  }, [syncToken]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const healthData = await apiRequest<HealthResponse>('/api/health', { skipAuth: true });
        if (active) setHealth(healthData);

        if (healthData.database.state === 'connected') {
          try {
            const refreshed = await apiRequest<{ accessToken: string; user: User }>('/api/auth/refresh', {
              method: 'POST',
              skipAuth: true,
              retryOn401: false,
            });
            if (active && refreshed.accessToken) {
              syncToken(refreshed.accessToken);
              setUser(refreshed.user);
            }
          } catch {
            // No valid refresh session cookie yet; user starts signed out
          }
        }
      } catch {
        // Server unreachable
      } finally {
        if (active) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [syncToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiRequest<{ accessToken: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
        skipAuth: true,
      });
      syncToken(data.accessToken);
      setUser(data.user);
      return data.user;
    },
    [syncToken]
  );

  const register = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      city?: string;
      bio?: string;
      skills?: string[];
      interests?: string[];
    }) => {
      const data = await apiRequest<{ accessToken: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: payload,
        skipAuth: true,
      });
      syncToken(data.accessToken);
      setUser(data.user);
      return data.user;
    },
    [syncToken]
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', skipAuth: true });
    } catch {
      // Clear local session regardless
    }
    syncToken(null);
    setUser(null);
  }, [syncToken]);

  const refreshProfile = useCallback(async () => {
    if (!getAccessToken()) return;
    const data = await apiRequest<{ user: User }>('/api/auth/me');
    setUser(data.user);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken: token,
        loading,
        health,
        login,
        register,
        logout,
        refreshProfile,
        setUserDirect: setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
