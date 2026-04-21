import { useState, useEffect } from 'react';
import adminApi from '../../../lib/adminApi';

export default function BannedPage() {
  const [bans, setBans]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);

  async function fetchBanned() {
    setLoading(true);
    try {
      const res = await adminApi.get('/admin-api/banned', { params: { page, limit: 20 } });
      setBans(res.data.bans);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Banned fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchBanned(); }, [page]);

  async function handleUnban(userId) {
    if (!confirm('Unban this user?')) return;
    try {
      await adminApi.delete(`/admin-api/users/${userId}/ban`);
      fetchBanned();
    } catch (err) {
      console.error('Unban failed:', err);
    }
  }

  return (
    <>
      {/* Stats */}
      <div className="admin-stats-row" style={{ marginBottom: 20 }}>
        <div className="admin-stat-card">
          <div className="stat-label">🔇 Total Banned</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">⏱ Soft Bans</div>
          <div className="stat-value">{bans.filter(b => b.ban_type === 'soft').length}</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">🔒 Hard Bans</div>
          <div className="stat-value">{bans.filter(b => b.ban_type === 'hard').length}</div>
        </div>
      </div>

      {/* Table */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Type</th>
              <th>Reason</th>
              <th>Banned At</th>
              <th>Expires</th>
              <th>By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-text-muted)' }}>Loading...</td></tr>
            ) : bans.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-text-muted)' }}>No banned users</td></tr>
            ) : bans.map(b => (
              <tr key={b.id}>
                <td style={{ fontWeight: 600 }}>{b.display_name || '—'}</td>
                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{b.email}</td>
                <td><span className={`admin-badge ${b.ban_type}`}>{b.ban_type}</span></td>
                <td>{b.reason || '—'}</td>
                <td style={{ fontSize: 12 }}>{new Date(b.banned_at).toLocaleDateString()}</td>
                <td style={{ fontSize: 12 }}>
                  {b.expires_at ? new Date(b.expires_at).toLocaleString() : 'Never'}
                </td>
                <td>{b.banned_by}</td>
                <td>
                  <button className="admin-btn sm success" onClick={() => handleUnban(b.user_id)}>
                    ✅ Unban
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="admin-pagination">
          <button className="admin-btn sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>Page {page}</span>
          <button className="admin-btn sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </>
  );
}
