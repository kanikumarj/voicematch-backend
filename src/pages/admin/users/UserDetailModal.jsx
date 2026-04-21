import { useState, useEffect } from 'react';
import adminApi from '../../../lib/adminApi';

export default function UserDetailModal({ userId, onClose, onRefresh }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.get(`/admin-api/users/${userId}`)
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={e => e.stopPropagation()}>
        <p style={{ color: 'var(--admin-text-muted)', padding: 40, textAlign: 'center' }}>Loading...</p>
      </div>
    </div>
  );

  if (!data) return null;
  const { user, calls, reports, friends } = data;

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={e => e.stopPropagation()}>
        <div className="admin-panel-header">
          <h2>{user.display_name || 'Unknown User'}</h2>
          <button className="admin-panel-close" onClick={onClose}>✕</button>
        </div>

        {/* Profile */}
        <div className="admin-panel-section">
          <h4>Profile</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: 13 }}>
            <div><span style={{ color: 'var(--admin-text-muted)' }}>Email</span><br />{user.email}</div>
            <div><span style={{ color: 'var(--admin-text-muted)' }}>Gender</span><br />{user.gender || '—'}</div>
            <div><span style={{ color: 'var(--admin-text-muted)' }}>Age</span><br />{user.age || '—'}</div>
            <div><span style={{ color: 'var(--admin-text-muted)' }}>Status</span><br /><span className={`admin-badge ${user.status}`}>{user.status}</span></div>
            <div><span style={{ color: 'var(--admin-text-muted)' }}>Role</span><br />{user.role}</div>
            <div><span style={{ color: 'var(--admin-text-muted)' }}>Verified</span><br />{user.email_verified ? '✅ Yes' : '❌ No'}</div>
            <div><span style={{ color: 'var(--admin-text-muted)' }}>Joined</span><br />{new Date(user.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="admin-panel-section">
          <h4>Stats</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center' }}>
            <div className="admin-stat-card" style={{ padding: 12 }}>
              <div className="stat-value" style={{ fontSize: 22 }}>{user.total_calls || 0}</div>
              <div className="stat-sub">Calls</div>
            </div>
            <div className="admin-stat-card" style={{ padding: 12 }}>
              <div className="stat-value" style={{ fontSize: 22 }}>{user.total_minutes || 0}</div>
              <div className="stat-sub">Minutes</div>
            </div>
            <div className="admin-stat-card" style={{ padding: 12 }}>
              <div className="stat-value" style={{ fontSize: 22 }}>{user.streak_count || 0}</div>
              <div className="stat-sub">Streak</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', marginBottom: 4 }}>Trust Score: {user.trust_score}</div>
            <div className="admin-trust-bar">
              <div className="admin-trust-fill" style={{
                width: `${user.trust_score || 0}%`,
                background: user.trust_score <= 30 ? 'var(--admin-danger)' : user.trust_score <= 60 ? 'var(--admin-warning)' : 'var(--admin-success)'
              }} />
            </div>
          </div>
        </div>

        {/* Call History */}
        <div className="admin-panel-section">
          <h4>Recent Calls ({calls.length})</h4>
          {calls.length === 0 ? <p style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>No calls yet</p> : (
            <table className="admin-table" style={{ fontSize: 12 }}>
              <thead><tr><th>Partner</th><th>Duration</th><th>Reason</th><th>Date</th></tr></thead>
              <tbody>
                {calls.map(c => (
                  <tr key={c.id}>
                    <td>{c.partner_name || '—'}</td>
                    <td>{c.duration_seconds ? `${Math.floor(c.duration_seconds / 60)}m ${c.duration_seconds % 60}s` : '—'}</td>
                    <td>{c.end_reason || '—'}</td>
                    <td>{new Date(c.started_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Reports */}
        <div className="admin-panel-section">
          <h4>Reports Received ({reports.length})</h4>
          {reports.length === 0 ? <p style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>No reports</p> : (
            <table className="admin-table" style={{ fontSize: 12 }}>
              <thead><tr><th>Reporter</th><th>Reason</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id}>
                    <td>{r.reporter_name || '—'}</td>
                    <td>{r.reason}</td>
                    <td><span className={`admin-badge ${r.status}`}>{r.status}</span></td>
                    <td>{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Friends */}
        <div className="admin-panel-section">
          <h4>Friends ({friends.length})</h4>
          {friends.length === 0 ? <p style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>No friends yet</p> : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {friends.map(f => (
                <span key={f.friend_id} className="admin-badge" style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)' }}>
                  {f.friend_name || 'Unknown'}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
