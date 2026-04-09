import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use raw fetch here, NOT api.get, because api.get redirects on 401
    // which causes an infinite reload loop for unauthenticated users
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email) => {
    await api.post('/api/auth/magic-link', { email });
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/api/auth/logout'); } catch {}
    setUser(null);
    window.location.hash = '#/';
  }, []);

  return { user, loading, login, logout, setUser };
}