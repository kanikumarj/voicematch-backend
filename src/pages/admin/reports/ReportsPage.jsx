import { useState, useEffect } from 'react';
import adminApi from '../../../lib/adminApi';

const TABS = ['pending', 'actioned', 'dismissed'];

export default function ReportsPage() {
  const [tab, setTab]         = useState('pending');
  const [reports, setReports] = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);

  async function fetchReports() {
    setLoading(true);
    try {
      const res = await adminApi.get('/admin-api/reports', {
        params: { status: tab, page, limit: 20 }
      });
      setReports(res.data.reports);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Reports fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchReports(); }, [tab, page]);

  async function handleAction(reportId, newStatus) {
    try {
      await adminApi.patch(`/admin-api/reports/${reportId}`, { status: newStatus });
      fetchReports();
    } catch (err) {
      console.error('Report action failed:', err);
    }
  }

  return (
    <>
      {/* Tabs */}
      <div className="admin-filters" style={{ marginBottom: 20 }}>
        {TABS.map(t => (
          <button
            key={t}
            className={`admin-filter-pill ${tab === t ? 'active' : ''}`}
            onClick={() => { setTab(t); setPage(1); }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--admin-text-muted)' }}>
          {total} report{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Reporter</th>
              <th>Reported</th>
              <th>Reason</th>
              <th>Detail</th>
              <th>Date</th>
              {tab === 'pending' && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-text-muted)' }}>Loading...</td></tr>
            ) : reports.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-text-muted)' }}>No {tab} reports</td></tr>
            ) : reports.map(r => (
              <tr key={r.id}>
                <td>{r.reporter_name || r.reporter_email}</td>
                <td>{r.reported_name || r.reported_email}</td>
                <td><span className="admin-badge pending">{r.reason}</span></td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.detail || '—'}
                </td>
                <td style={{ fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString()}</td>
                {tab === 'pending' && (
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="admin-btn sm success" onClick={() => handleAction(r.id, 'dismissed')}>✅ Dismiss</button>
                      <button className="admin-btn sm danger" onClick={() => handleAction(r.id, 'actioned')}>⚠️ Action</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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
