import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth, roleHome } from '../context/AuthContext';

export default function Login() {
  const { login, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Navigate to={roleHome(role)} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/login/', form);
      login(data);
      const destination = data.must_change_password ? '/change-password' : (roleHome(data.role) || '/dashboard');
      navigate(destination);
    } catch (err) {
      const data = err.response?.data;
      setError(
        data?.non_field_errors?.[0]
          || (Array.isArray(data) ? data[0] : null)
          || data?.detail
          || 'Login failed',
      );
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Financial Management System</h2>
        <p className="muted">Lease Management & Budget Planning</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Username or email
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              autoComplete="current-password"
            />
          </label>
          {/* <p className="muted login-hint">Tenants: use your username or email. Default password is your surname in UPPERCASE.</p> */}
          {error && <p className="error">{error}</p>}
          <button className="btn" type="submit">Sign in</button>
          <Link to="/forgot-password" className="link-muted">Forgot password?</Link>
          <Link to="/" className="link-muted">← Back to home</Link>
        </form>
      </div>
    </div>
  );
}
