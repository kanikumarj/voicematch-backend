import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import './AuthPages.css';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState({});
  const { login } = useAuth();
  const navigate  = useNavigate();
  const toast     = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!email)    errs.email    = 'Email is required';
    if (!password) errs.password = 'Password is required';
    if (Object.keys(errs).length) return setErrors(errs);

    setLoading(true);
    try {
      await login(email, password);
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
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            error={errors.email}
            autoComplete="email"
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

        <p className="auth-switch">
          Don't have an account?{' '}
          <Link to="/register" className="auth-link">Create account</Link>
        </p>
      </div>
    </div>
  );
}
