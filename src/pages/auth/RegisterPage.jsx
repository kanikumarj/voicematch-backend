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

          <label className="auth-terms">
            <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} />
            <span>I agree to the <a href="#" className="auth-link">Terms of Service</a></span>
          </label>
          {errors.terms && <span className="auth-err">{errors.terms}</span>}

          <Button type="submit" fullWidth loading={loading}>Create Account</Button>
        </form>

        <div className="auth-divider"><span>or</span></div>
        <p className="auth-switch">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
