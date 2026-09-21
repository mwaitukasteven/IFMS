import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => ({
    access: localStorage.getItem('access_token'),
    refresh: localStorage.getItem('refresh_token'),
    role: localStorage.getItem('user_role'),
    username: localStorage.getItem('username'),
    mustChangePassword: localStorage.getItem('must_change_password') === 'true',
  }));

  const login = (payload) => {
    localStorage.setItem('access_token', payload.access);
    localStorage.setItem('refresh_token', payload.refresh);
    localStorage.setItem('user_role', payload.role || '');
    localStorage.setItem('username', payload.username || '');
    localStorage.setItem(
      'must_change_password',
      payload.must_change_password ? 'true' : 'false',
    );
    setAuth({
      access: payload.access,
      refresh: payload.refresh,
      role: payload.role || '',
      username: payload.username || '',
      mustChangePassword: Boolean(payload.must_change_password),
    });
  };

  const clearMustChangePassword = () => {
    localStorage.setItem('must_change_password', 'false');
    setAuth((prev) => ({ ...prev, mustChangePassword: false }));
  };

  const logout = () => {
    localStorage.clear();
    setAuth({
      access: null,
      refresh: null,
      role: null,
      username: null,
      mustChangePassword: false,
    });
  };

  const value = useMemo(
    () => ({
      ...auth,
      isAuthenticated: Boolean(auth.access),
      login,
      logout,
      clearMustChangePassword,
    }),
    [auth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

function roleHome(role) {
  if (role === 'admin') return '/admin';
  if (role === 'asset_manager') return '/asset-manager';
  if (role === 'finance_officer') return '/budgets';
  if (role === 'lease_officer') return '/lease';
  if (role === 'tenant') return '/tenant';
  return '/dashboard';
}

export { roleHome };
