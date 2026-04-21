import { useState } from 'react';
import { generateAnonymousName } from '../../utils/nameGenerator';
import Button from './Button';
import Input from './Input';

export default function IdentityChooser({ user, onConfirm, onCancel }) {
  const savedPref = localStorage.getItem('vm_identity_pref') || 'real';
  const savedCustom = localStorage.getItem('vm_custom_name') || '';

  const [identity, setIdentity] = useState(savedPref);
  const [customName, setCustomName] = useState(savedCustom);
  const [anonymousName, setAnonymousName] = useState(generateAnonymousName());
  const [remember, setRemember] = useState(true);

  const handleConfirm = () => {
    let sessionName = '';
    if (identity === 'real') {
      sessionName = user.displayName;
    } else if (identity === 'anonymous') {
      sessionName = anonymousName;
    } else {
      sessionName = customName.trim() || anonymousName;
    }

    if (remember) {
      localStorage.setItem('vm_identity_pref', identity);
      if (identity === 'custom') {
        localStorage.setItem('vm_custom_name', customName);
      }
    } else {
      localStorage.removeItem('vm_identity_pref');
      localStorage.removeItem('vm_custom_name');
    }

    onConfirm(sessionName);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="auth-card" style={{ maxWidth: 400, width: '90%', padding: '24px', background: 'var(--surface)', borderRadius: '16px' }}>
        <h2 style={{ marginBottom: 16 }}>Who will you be today?</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px', border: `1px solid ${identity === 'real' ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 8 }}>
            <input type="radio" name="identity" checked={identity === 'real'} onChange={() => setIdentity('real')} style={{ accentColor: 'var(--primary)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold' }}>{user.displayName} (your name)</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Connect as yourself</div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px', border: `1px solid ${identity === 'anonymous' ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 8 }}>
            <input type="radio" name="identity" checked={identity === 'anonymous'} onChange={() => setIdentity('anonymous')} style={{ accentColor: 'var(--primary)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold' }}>{anonymousName}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stay anonymous</div>
            </div>
            <button type="button" onClick={(e) => { e.preventDefault(); setAnonymousName(generateAnonymousName()); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>🔄</button>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px', border: `1px solid ${identity === 'custom' ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 8 }}>
            <input type="radio" name="identity" checked={identity === 'custom'} onChange={() => setIdentity('custom')} style={{ accentColor: 'var(--primary)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold' }}>Custom name...</div>
              {identity === 'custom' && (
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Enter a name"
                  style={{ marginTop: 8 }}
                />
              )}
            </div>
          </label>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, cursor: 'pointer', fontSize: 14 }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
          Remember my choice
        </label>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <Button variant="secondary" onClick={onCancel} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleConfirm} style={{ flex: 2 }}>Start Connecting</Button>
        </div>
      </div>
    </div>
  );
}
