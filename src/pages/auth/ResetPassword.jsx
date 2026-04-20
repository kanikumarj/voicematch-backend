import { useState, useEffect } from 'react';
import './AuthPages.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function ResetPassword() {
  const [token, setToken]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (!t) setError('Invalid reset link. Please request a new one.');
    else setToken(t);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/auth/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, newPassword: password }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error || 'Reset failed.'); return; }
      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="verify-icon success">🔐</div>
          <h1 className="auth-title">Password Updated</h1>
          <p className="auth-subtitle">Your password has been reset successfully.</p>
          <a href="/login" className="auth-btn" id="btn-login-after-reset">Login with new password</a>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Set New Password</h1>
        <p className="auth-subtitle">Choose a strong password for your account.</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field-group">
            <label htmlFor="rp-password">New password</label>
            <input
              id="rp-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          <div className="field-group">
            <label htmlFor="rp-confirm">Confirm password</label>
            <input
              id="rp-confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat password"
              required
              autoComplete="new-password"
            />
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button
            id="btn-reset-submit"
            type="submit"
            className="auth-btn"
            disabled={loading || !token}
          >
            {loading ? <span className="btn-spinner" /> : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
