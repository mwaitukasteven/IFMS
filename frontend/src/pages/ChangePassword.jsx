import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth, roleHome } from '../context/AuthContext';

export default function ChangePassword() {
  const { clearMustChangePassword, role } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.new_password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    try {
      await api.post('/auth/change-password/', {
        old_password: form.old_password,
        new_password: form.new_password,
      });
      clearMustChangePassword();
      setMessage('Password updated. Redirecting...');
      setTimeout(() => navigate(roleHome(role)), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change password');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Change Password</h2>
        <p className="muted">You must set a new password before continuing.</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Current password
            <input
              type="password"
              value={form.old_password}
              onChange={(e) => setForm({ ...form, old_password: e.target.value })}
              required
            />
          </label>
          <p className="muted">password must be at least 8 characters long, password must contain numbers and letters, password must contain at least one special character</p>
          <label>
            New password
            <input
              type="password"
              value={form.new_password}
              onChange={(e) => setForm({ ...form, new_password: e.target.value })}
              minLength={8}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              minLength={8}
              required
            />
          </label>
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
          <button className="btn" type="submit">
            Update password
          </button>
        </form>
      </div>
    </div>
  );
}
