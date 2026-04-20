import { useState } from 'react';
import './AuthPages.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error || 'Request failed'); return; }
      setSent(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="verify-icon success">📬</div>
          <h1 className="auth-title">Check your inbox</h1>
          <p className="auth-subtitle">
            If an account with <strong>{email}</strong> exists, we've sent a reset link.
            It expires in 1 hour.
          </p>
          <a href="/login" className="auth-btn" id="btn-back-login">Back to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Forgot Password</h1>
        <p className="auth-subtitle">Enter your email and we'll send a reset link.</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field-group">
            <label htmlFor="fp-email">Email address</label>
            <input
              id="fp-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button id="btn-send-reset" type="submit" className="auth-btn" disabled={loading}>
            {loading ? <span className="btn-spinner" /> : 'Send Reset Link'}
          </button>
        </form>
        <p className="auth-link">
          <a href="/login">Back to Login</a>
        </p>
      </div>
    </div>
  );
}
