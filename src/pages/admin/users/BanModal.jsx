import { useState } from 'react';
import adminApi from '../../../lib/adminApi';

export default function BanModal({ user, onClose, onBanned }) {
  const [banType, setBanType]   = useState('soft');
  const [reason, setReason]     = useState('');
  const [hours, setHours]       = useState(48);
  const [loading, setLoading]   = useState(false);

  async function handleBan() {
    setLoading(true);
    try {
      const expiresAt = banType === 'soft'
        ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
        : null;

      await adminApi.post(`/admin-api/users/${user.id}/ban`, {
        banType,
        reason: reason || 'Admin action',
        expiresAt,
      });
      onBanned();
    } catch (err) {
      console.error('Ban failed:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-panel" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
        <div className="admin-panel-header">
          <h2>Ban User</h2>
          <button className="admin-panel-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 14, margin: 0 }}>
            Banning <strong>{user.display_name || user.email}</strong>
          </p>
        </div>

        {/* Ban Type */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--admin-text-muted)', display: 'block', marginBottom: 8 }}>Ban Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`admin-filter-pill ${banType === 'soft' ? 'active' : ''}`}
              onClick={() => setBanType('soft')}
            >Soft (Temporary)</button>
            <button
              className={`admin-filter-pill ${banType === 'hard' ? 'active' : ''}`}
              onClick={() => setBanType('hard')}
              style={banType === 'hard' ? { background: 'rgba(248,81,73,0.15)', borderColor: 'var(--admin-danger)', color: 'var(--admin-danger)' } : {}}
            >Hard (Permanent)</button>
          </div>
        </div>

        {/* Duration (soft only) */}
        {banType === 'soft' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--admin-text-muted)', display: 'block', marginBottom: 8 }}>Duration (hours)</label>
            <input
              type="number"
              className="admin-input"
              value={hours}
              onChange={e => setHours(Number(e.target.value))}
              min={1} max={720}
            />
          </div>
        )}

        {/* Reason */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, color: 'var(--admin-text-muted)', display: 'block', marginBottom: 8 }}>Reason</label>
          <input
            className="admin-input"
            placeholder="e.g. Repeated harassment"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="admin-btn" onClick={onClose}>Cancel</button>
          <button className="admin-btn danger" onClick={handleBan} disabled={loading}>
            {loading ? 'Banning...' : `${banType === 'hard' ? '🔒 Permanent Ban' : '⏱ Temp Ban'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
