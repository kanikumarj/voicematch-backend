import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

const AuthContext = createContext(null);

function getStoredAuth() {
  try {
    const token = localStorage.getItem('vm_token');
    const user  = JSON.parse(localStorage.getItem('vm_user') || 'null');
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }) {
  const stored = getStoredAuth();
  const [user,      setUser]      = useState(stored.user);
  const [token,     setToken]     = useState(stored.token);
  const [isLoading, setIsLoading] = useState(Boolean(stored.token)); // loading if we need to revalidate

  // ── Helpers ───────────────────────────────────────────────────────────────
  function persist(newToken, newUser) {
    localStorage.setItem('vm_token', newToken);
    localStorage.setItem('vm_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function clear() {
    localStorage.removeItem('vm_token');
    localStorage.removeItem('vm_user');
    setToken(null);
    setUser(null);
    disconnectSocket();
  }

  // ── Revalidate token on mount (catches expired tokens) ───────────────────
  useEffect(() => {
    if (!stored.token) { setIsLoading(false); return; }

    api.get('/api/auth/me')
      .then((data) => {
        persist(stored.token, data.user ?? data);
        connectSocket(stored.token);
      })
      .catch(() => clear())
      .finally(() => setIsLoading(false));
  }, []);

  // ── Listen for 401 from api.js ────────────────────────────────────────────
  useEffect(() => {
    const handler = () => clear();
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  // ── Public methods ────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const data = await api.post('/api/auth/login', { email, password });
    persist(data.token, data.user);
    connectSocket(data.token);
    return data.user;
  }, []);

  const register = useCallback(async (email, password) => {
    const data = await api.post('/api/auth/register', { email, password });
    persist(data.token, data.user);
    connectSocket(data.token);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clear();
    // FIXED: redirect to login after clearing session
    window.location.href = '/login';
  }, []);

  const updateUser = useCallback((patch) => {
    setUser(prev => {
      const updated = { ...prev, ...patch };
      localStorage.setItem('vm_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    const data = await api.get('/api/auth/me');
    const freshUser = data.user ?? data;
    setUser(freshUser);
    localStorage.setItem('vm_user', JSON.stringify(freshUser));
    return freshUser;
  }, []);

  const updateProfile = useCallback(async (patch) => {
    const data = await api.post('/api/auth/onboarding', patch); // FIXED: Correct onboarding endpoint
    const freshUser = data.user ?? data;
    setUser(freshUser);
    localStorage.setItem('vm_user', JSON.stringify(freshUser));
    return freshUser;
  }, []);

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    logout,
    updateUser,
    updateProfile,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
