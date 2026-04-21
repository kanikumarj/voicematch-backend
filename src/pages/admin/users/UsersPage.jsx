import { useState, useEffect } from 'react';
import adminApi from '../../../lib/adminApi';
import UserDetailModal from './UserDetailModal';
import BanModal from './BanModal';

const FILTERS = ['all', 'online', 'offline', 'in_call', 'searching', 'banned', 'unverified'];

export default function UsersPage() {
  const [users, setUsers]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [banTarget, setBanTarget]       = useState(null);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await adminApi.get('/admin-api/users', {
        params: { page, limit: 20, search, filter }
      });
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Users fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, [page, search, filter]);

  function getTrustColor(score) {
    if (score <= 30) return 'var(--admin-danger)';
    if (score <= 60) return 'var(--admin-warning)';
    return 'var(--admin-success)';
  }

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="admin-search">
          <span>🔍</span>
          <input
            placeholder="Search by email, name, or ID..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>
          {total} users total
        </div>
      </div>

      {/* Filters */}
      <div className="admin-filters" style={{ marginBottom: 16 }}>
        {FILTERS.map(f => (
          <button
            key={f}
            className={`admin-filter-pill ${filter === f ? 'active' : ''}`}
            onClick={() => { setFilter(f); setPage(1); }}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Gender</th>
              <th>Age</th>
              <th>Status</th>
              <th>Trust</th>
              <th>Calls</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-text-muted)' }}>Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-text-muted)' }}>No users found</td></tr>
            ) : users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.display_name || '—'}</td>
                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{u.email}</td>
                <td>{u.gender || '—'}</td>
                <td>{u.age || '—'}</td>
                <td><span className={`admin-badge ${u.status}`}>{u.status}</span></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="admin-trust-bar" style={{ width: 60 }}>
                      <div className="admin-trust-fill" style={{
                        width: `${u.trust_score || 0}%`,
                        background: getTrustColor(u.trust_score)
                      }} />
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{u.trust_score}</span>
                  </div>
                </td>
                <td>{u.total_calls || 0}</td>
                <td style={{ fontSize: 12, color: 'var(--admin-text-sec)' }}>
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="admin-btn sm" onClick={() => setSelectedUser(u.id)}>👁️</button>
                    {u.status === 'banned' ? (
                      <button className="admin-btn sm success" onClick={async () => {
                        await adminApi.delete(`/admin-api/users/${u.id}/ban`);
                        fetchUsers();
                      }}>✅</button>
                    ) : (
                      <button className="admin-btn sm danger" onClick={() => setBanTarget(u)}>🔇</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="admin-pagination">
          <button className="admin-btn sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>Page {page} of {Math.ceil(total / 20)}</span>
          <button className="admin-btn sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {/* Modals */}
      {selectedUser && (
        <UserDetailModal userId={selectedUser} onClose={() => setSelectedUser(null)} onRefresh={fetchUsers} />
      )}
      {banTarget && (
        <BanModal user={banTarget} onClose={() => setBanTarget(null)} onBanned={() => { setBanTarget(null); fetchUsers(); }} />
      )}
    </>
  );
}
