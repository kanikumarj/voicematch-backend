import { useState, useEffect } from 'react';
import StreakBadge from '../../components/ui/StreakBadge';
import { toast }  from '../../components/ui/Toast';
import './ProfilePage.css';

const API = import.meta.env.VITE_API_URL;

const GENDER_OPTIONS = [
  { value: 'any',    label: 'Any' },
  { value: 'male',   label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other',  label: 'Other' },
];

export default function ProfilePage({ token, onBack }) {
  const [profile,   setProfile]   = useState(null);
  const [blocked,   setBlocked]   = useState([]);
  const [editing,   setEditing]   = useState(false);
  const [form,      setForm]      = useState({});
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  // NEW: [Feature 4] Profile sharing
  const [username, setUsername]       = useState(null);
  const [generatingUsername, setGeneratingUsername] = useState(false);
  const [copied, setCopied]           = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  async function fetchProfile() {
    setLoading(true);
    try {
      const [pr, br] = await Promise.all([
        fetch(`${API}/api/users/me`, { headers }).then(r => r.json()),
        fetch(`${API}/api/users/blocks`, { headers }).then(r => r.json()),
      ]);
      setProfile(pr);
      setBlocked(br.blockedUsers ?? []);
      setForm({
        displayName:     pr.display_name,
        age:             pr.age,
        gender:          pr.gender ?? 'other',
        genderFilter:    pr.gender_filter ?? 'any',
        preferredGender: pr.preferred_gender ?? 'any',
      });
    } catch { toast.error('Failed to load profile.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchProfile(); }, []);

  // NEW: [Feature 4] Check if user already has username
  useEffect(() => {
    if (profile?.username) setUsername(profile.username);
  }, [profile]);

  async function saveProfile() {
    setSaving(true);
    try {
      const res  = await fetch(`${API}/api/users/me`, {
        method:  'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) { toast.error(body.error || 'Update failed'); return; }
      setProfile(p => ({ ...p, ...body.user }));
      setEditing(false);
      toast.success('Profile updated!');
    } catch { toast.error('Network error.'); }
    finally { setSaving(false); }
  }

  async function handleUnblock(userId) {
    try {
      await fetch(`${API}/api/users/block/${userId}`, { method: 'DELETE', headers });
      setBlocked(b => b.filter(u => u.id !== userId));
      toast.success('User unblocked.');
    } catch { toast.error('Failed to unblock.'); }
  }

  async function handleDeleteAccount() {
    try {
      await fetch(`${API}/api/users/me`, { method: 'DELETE', headers });
      window.location.href = '/login';
    } catch { toast.error('Failed to delete account.'); }
  }

  if (loading) return (
    <div className="profile-loading">
      <div className="pp-spinner" />
    </div>
  );

  if (!profile) return null;

  const initials = (profile.display_name || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="profile-page">
      <header className="pp-header">
        <button className="pp-back" onClick={onBack} aria-label="Back">← Back</button>
        <h1 className="pp-heading">My Profile</h1>
      </header>

      <div className="pp-body">
        {/* ── Avatar + name ── */}
        <div className="pp-hero">
          <div className="pp-avatar">{initials}</div>
          {editing ? (
            <input
              className="pp-name-input"
              value={form.displayName}
              onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
              maxLength={50}
              placeholder="Display name"
            />
          ) : (
            <h2 className="pp-name">{profile.display_name}</h2>
          )}
          <StreakBadge streak={profile.streak_count} />
        </div>

        {/* ── Stats row ── */}
        <div className="pp-stats">
          {[
            { label: 'Total Calls',   value: profile.total_calls  ?? 0 },
            { label: 'Minutes',       value: profile.total_minutes ?? 0 },
            { label: 'Avg Rating',    value: profile.avg_rating ? `${profile.avg_rating}★` : '—' },
          ].map(s => (
            <div key={s.label} className="pp-stat">
              <span className="pp-stat-value">{s.value}</span>
              <span className="pp-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* NEW: [Feature 4] Share Profile Section */}
        <section className="pp-section">
          <h3>📎 Share Profile</h3>
          {username ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                padding: '12px', background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)', fontSize: '13px',
                color: 'var(--text-primary)', wordBreak: 'break-all',
                border: '1px solid var(--border-subtle)',
              }}>
                {window.location.origin}/u/{username}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="pp-edit-btn"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(`${window.location.origin}/u/${username}`);
                      setCopied(true);
                      toast.success('Link copied!');
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      prompt('Copy:', `${window.location.origin}/u/${username}`);
                    }
                  }}
                >
                  {copied ? '✅ Copied!' : '📋 Copy Link'}
                </button>
                <button
                  className="pp-edit-btn"
                  onClick={() => window.open(`${window.location.origin}/u/${username}`, '_blank')}
                >
                  🔗 View Public
                </button>
              </div>
            </div>
          ) : (
            <button
              className="pp-edit-btn"
              onClick={async () => {
                setGeneratingUsername(true);
                try {
                  const res = await fetch(`${API}/api/public/generate-username`, {
                    method: 'POST', headers,
                  });
                  const data = await res.json();
                  if (data.success) {
                    setUsername(data.data.username);
                    toast.success('Username generated!');
                  } else {
                    toast.error(data.message || 'Failed');
                  }
                } catch { toast.error('Failed to generate username'); }
                finally { setGeneratingUsername(false); }
              }}
              disabled={generatingUsername}
            >
              {generatingUsername ? '⏳ Generating...' : '🔗 Create Shareable Link'}
            </button>
          )}
        </section>


        {/* ── Preferences ── */}
        <section className="pp-section">
          <div className="pp-section-header">
            <h3>Preferences</h3>
            <button
              className="pp-edit-btn"
              onClick={() => editing ? saveProfile() : setEditing(true)}
              disabled={saving}
            >
              {saving ? '…' : editing ? 'Save' : 'Edit'}
            </button>
            {editing && (
              <button className="pp-cancel-btn" onClick={() => setEditing(false)}>Cancel</button>
            )}
          </div>

          <div className="pp-prefs">
            {[
              { label: 'My gender',       key: 'gender' },
              { label: 'Match filter',    key: 'genderFilter' },
              { label: 'Prefer to meet',  key: 'preferredGender' },
            ].map(({ label, key }) => (
              <div key={key} className="pp-pref-row">
                <span className="pp-pref-label">{label}</span>
                {editing ? (
                  <select
                    className="pp-pref-select"
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  >
                    {GENDER_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <span className="pp-pref-value">
                    {GENDER_OPTIONS.find(o => o.value === form[key])?.label ?? '—'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Blocked users ── */}
        <section className="pp-section">
          <h3>Blocked Users ({blocked.length})</h3>
          {blocked.length === 0 ? (
            <p className="pp-empty">No blocked users.</p>
          ) : (
            <ul className="pp-blocked-list">
              {blocked.map(u => (
                <li key={u.id} className="pp-blocked-item">
                  <span>{u.display_name || 'Anonymous'}</span>
                  <button
                    className="pp-unblock-btn"
                    onClick={() => handleUnblock(u.id)}
                  >Unblock</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Danger zone ── */}
        <section className="pp-section pp-danger">
          <h3>Danger Zone</h3>
          {!showDelete ? (
            <button className="pp-delete-btn" onClick={() => setShowDelete(true)}>
              Delete Account
            </button>
          ) : (
            <div className="pp-confirm-delete">
              <p>This cannot be undone. All your data will be deleted.</p>
              <div className="pp-confirm-actions">
                <button className="pp-delete-btn" onClick={handleDeleteAccount}>Yes, delete</button>
                <button className="pp-cancel-btn" onClick={() => setShowDelete(false)}>Cancel</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
