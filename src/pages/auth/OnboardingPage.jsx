import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import './AuthPages.css';

const STEPS = 3;
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

export default function OnboardingPage() {
  const [step, setStep]  = useState(1);
  const [name, setName]  = useState('');
  const [age,  setAge]   = useState(22);
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);
  const { updateProfile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  async function handleFinish() {
    if (!name.trim()) return toast.error('Please enter your name');
    if (!gender)      return toast.error('Please select your gender');
    setLoading(true);
    try {
      await updateProfile({ displayName: name.trim(), age, gender });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Setup failed');
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

        {/* Progress dots */}
        <div className="onboarding-progress">
          {Array.from({ length: STEPS }, (_, i) => (
            <div key={i} className={`progress-dot ${i + 1 === step ? 'active' : ''}`} />
          ))}
        </div>

        {/* Step 1 — Name */}
        {step === 1 && (
          <div className="onboarding-step auth-form">
            <h2 style={{ marginBottom: 8 }}>What's your name?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 24 }}>
              This is how others will see you
            </p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your display name"
              maxLength={32}
              autoFocus
              style={{
                width: '100%', padding: '14px 16px', fontSize: 'var(--text-base)',
                background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
            />
            <Button fullWidth onClick={() => name.trim() ? setStep(2) : toast.error('Enter your name')}>
              Next →
            </Button>
          </div>
        )}

        {/* Step 2 — Age */}
        {step === 2 && (
          <div className="onboarding-step auth-form">
            <h2 style={{ marginBottom: 8 }}>How old are you?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 24 }}>
              You must be 18+ to use VoiceMatch
            </p>
            <div className="age-display">{age}</div>
            <input type="range" min={18} max={65} value={age} onChange={e => setAge(+e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
              <span>18</span><span>65</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
              <Button fullWidth onClick={() => setStep(3)}>Next →</Button>
            </div>
          </div>
        )}

        {/* Step 3 — Gender */}
        {step === 3 && (
          <div className="onboarding-step auth-form">
            <h2 style={{ marginBottom: 8 }}>Your gender</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 16 }}>
              Helps with matching preferences
            </p>
            <div className="gender-pills">
              {GENDERS.map(g => (
                <button
                  key={g}
                  type="button"
                  className={`gender-pill ${gender === g ? 'selected' : ''}`}
                  onClick={() => setGender(g)}
                >
                  {g}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <Button variant="ghost" onClick={() => setStep(2)}>← Back</Button>
              <Button fullWidth loading={loading} onClick={handleFinish}>
                Let's go! 🎙️
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
