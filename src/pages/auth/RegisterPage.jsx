import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import './AuthPages.css';

function PasswordStrength({ password }) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const labels = ['', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = ['', '#EF4444', '#F59E0B', '#10B981', '#059669'];

  if (!password) return null;

  return (
    <div className="pw-strength">
      <div className="pw-bars">
        {[1,2,3,4].map(i => (
          <div
            key={i}
            className="pw-bar"
            style={{ background: i <= score ? colors[score] : 'var(--bg-tertiary)' }}
          />
        ))}
      </div>
      <span style={{ color: colors[score], fontSize: 11 }}>{labels[score]}</span>
    </div>
  );
}

export default function RegisterPage() {
  const [email, setEmail]    = useState('');
  const [pass,  setPass]     = useState('');
  const [pass2, setPass2]    = useState('');
  const [terms, setTerms]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]  = useState({});
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast    = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!email)          errs.email    = 'Email is required';
    if (pass.length < 8) errs.pass     = 'Minimum 8 characters';
    if (pass !== pass2)  errs.pass2    = 'Passwords do not match';
    if (!terms)          errs.terms    = 'You must accept the terms';
    if (Object.keys(errs).length) return setErrors(errs);

    setLoading(true);
    try {
      await register(email, pass);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Registration failed');
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
          <h2>Create account</h2>
          <p>Join thousands of people connecting by voice</p>
        </div>

        {/* FIX: Google Sign Up button */}
        <button
          type="button"
          onClick={() => window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google`}
          className="btn-google"
          style={{
            width: '100%', padding: '12px', background: '#fff',
            color: '#333', border: '1px solid #ddd', borderRadius: '8px',
            cursor: 'pointer', display: 'flex', justifyContent: 'center',
            alignItems: 'center', gap: '8px', fontSize: '15px',
            fontWeight: '500', marginBottom: '16px'
          }}
        >
          <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-divider"><span>or</span></div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <Input label="Email" type="email" value={email}
            onChange={e => setEmail(e.target.value)} error={errors.email} autoComplete="email" />
          <div>
            <Input label="Password" type="password" value={pass}
              onChange={e => setPass(e.target.value)} error={errors.pass} autoComplete="new-password" />
            <PasswordStrength password={pass} />
          </div>
          <Input label="Confirm password" type="password" value={pass2}
            onChange={e => setPass2(e.target.value)} error={errors.pass2} autoComplete="new-password" />

          {/* FIX: Checkbox — larger, clearly visible, accent color */}
          <div style={{
            display: 'flex', alignItems: 'flex-start',
            gap: '10px', margin: '8px 0'
          }}>
            <input
              type="checkbox"
              id="terms-agree"
              checked={terms}
              onChange={e => setTerms(e.target.checked)}
              style={{
                width: '18px', height: '18px',
                marginTop: '2px', cursor: 'pointer',
                accentColor: 'var(--accent-primary)',
                flexShrink: 0
              }}
            />
            <label
              htmlFor="terms-agree"
              style={{
                color: 'var(--text-secondary)',
                fontSize: '13px', cursor: 'pointer',
                lineHeight: '1.4'
              }}
            >
              I agree to the{' '}
              <a href="/terms" className="auth-link">Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" className="auth-link">Privacy Policy</a>
            </label>
          </div>
          {errors.terms && <span className="auth-err">{errors.terms}</span>}

          {/* FIX: Disable submit if terms not checked */}
          <Button
            type="submit"
            fullWidth
            loading={loading}
            disabled={!terms || loading}
            style={{
              opacity: (!terms || loading) ? 0.6 : 1,
              cursor: (!terms || loading) ? 'not-allowed' : 'pointer'
            }}
          >
            Create Account
          </Button>
        </form>

        <p className="auth-switch" style={{ marginTop: '16px' }}>
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
