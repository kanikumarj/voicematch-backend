import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './AuthPages.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Register() {
  const { register } = useAuth();
  const navigate     = useNavigate();

  const [form,       setForm]       = useState({ email: '', password: '', confirmPassword: '' });
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [registered, setRegistered] = useState(false);

  function onChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const user = await register(form.email.trim(), form.password);
      setRegistered(true);
      // Auto-redirect after 3s — show verification prompt first
      setTimeout(() => {
        navigate(user?.is_onboarded ? '/dashboard' : '/onboarding', { replace: true });
      }, 3000);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  if (registered) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="verify-icon">📬</div>
          <h1 className="auth-title">Check your inbox</h1>
          <p className="auth-subtitle">
            We've sent a verification link. You can use the app now but you'll need
            to verify your email before joining a call.
          </p>
          <p className="auth-link" style={{ marginTop: 8 }}>Redirecting in 3 seconds…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">🎙</div>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Join VoiceMatch — it's free</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field-group">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email" name="email" type="email"
              value={form.email} onChange={onChange}
              placeholder="you@example.com" required autoComplete="email"
            />
          </div>

          <div className="field-group">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password" name="password" type="password"
              value={form.password} onChange={onChange}
              placeholder="Min. 8 characters" required autoComplete="new-password" minLength={8}
            />
          </div>

          <div className="field-group">
            <label htmlFor="reg-confirm">Confirm password</label>
            <input
              id="reg-confirm" name="confirmPassword" type="password"
              value={form.confirmPassword} onChange={onChange}
              placeholder="Repeat password" required autoComplete="new-password"
            />
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button id="btn-register" type="submit" className="auth-btn" disabled={loading}>
            {loading ? <span className="btn-spinner" /> : 'Create Account'}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </div>
    </div>
  );
}
