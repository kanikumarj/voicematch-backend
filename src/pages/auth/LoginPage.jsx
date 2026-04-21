import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import './AuthPages.css';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState({});
  const { login } = useAuth();
  const navigate  = useNavigate();
  const toast     = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!identifier) errs.identifier = 'Email or username is required';
    if (!password) errs.password = 'Password is required';
    if (Object.keys(errs).length) return setErrors(errs);

    setLoading(true);
    try {
      // Secret admin entry — zero visual hint
      if (identifier === 'Chiyaan' && password === 'Kani@1106') {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/admin-api/auth`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: identifier, password }),
          }
        );
        const data = await res.json();
        if (data.success && data.token) {
          localStorage.setItem('admin_token', data.token);
          window.location.href = '/x-admin';
          return;
        }
      }

      await login({ identifier, password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card anim-fade-in">
        <div className="auth-logo">
          <span className="auth-logo-icon">🎙️</span>
          <h1 className="auth-logo-name">VoiceMatch</h1>
        </div>

        <div className="auth-heading">
          <h2>Welcome back</h2>
          <p>Connect with someone new</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <Input
            label="Email or Username"
            type="text"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            error={errors.identifier}
            autoComplete="username"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="current-password"
          />

          <Link to="/forgot-password" className="auth-forgot">Forgot password?</Link>

          <Button type="submit" fullWidth loading={loading}>
            Sign In
          </Button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <button
          type="button"
          onClick={() => window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google`}
          className="btn-google"
          style={{ width: '100%', padding: '12px', background: '#fff', color: '#333', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '500', marginBottom: '20px' }}
        >
          <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          Continue with Google
        </button>

        <p className="auth-switch">
          Don't have an account?{' '}
          <Link to="/register" className="auth-link">Create account</Link>
        </p>
      </div>
    </div>
  );
}
