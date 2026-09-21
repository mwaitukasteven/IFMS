import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/auth/password-reset/', { email });
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.detail || 'Request failed');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Reset Password</h2>
        <p className="muted">Enter your registered email to receive a reset link.</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
          <button className="btn" type="submit">
            Send reset link
          </button>
          <Link to="/login" className="link-muted">
            Back to login
          </Link>
        </form>
      </div>
    </div>
  );
}
