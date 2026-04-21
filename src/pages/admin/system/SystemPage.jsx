import { useState, useEffect } from 'react';
import adminApi from '../../../lib/adminApi';

export default function SystemPage() {
  const [health, setHealth]       = useState(null);
  const [auditLog, setAuditLog]   = useState([]);
  const [broadcast, setBroadcast] = useState('');
  const [confirm1, setConfirm1]   = useState('');
  const [confirm2, setConfirm2]   = useState('');
  const [confirm3, setConfirm3]   = useState('');
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.get('/admin-api/system/health').then(r => setHealth(r.data)),
      adminApi.get('/admin-api/audit-log').then(r => setAuditLog(r.data || [])),
    ]).finally(() => setLoading(false));
  }, []);

  async function handleClearPool() {
    if (confirm1 !== 'CONFIRM') return alert('Type CONFIRM to proceed');
    await adminApi.post('/admin-api/system/clear-pool');
    setConfirm1('');
    alert('Pool cleared');
  }

  async function handleResetStatuses() {
    if (confirm2 !== 'CONFIRM') return alert('Type CONFIRM to proceed');
    await adminApi.post('/admin-api/system/reset-statuses');
    setConfirm2('');
    alert('All statuses reset to offline');
  }

  async function handleBroadcast() {
    if (confirm3 !== 'CONFIRM') return alert('Type CONFIRM to proceed');
    if (!broadcast.trim()) return alert('Message required');
    await adminApi.post('/admin-api/system/broadcast', { message: broadcast });
    setBroadcast('');
    setConfirm3('');
    alert('Broadcast sent');
  }

  if (loading) return <div className="admin-empty"><span>⏳</span><p>Loading system status...</p></div>;

  return (
    <>
      {/* Health Monitor */}
      <div className="admin-health-grid">
        <div className="admin-health-card">
          <div className="health-status">{health?.database?.connected ? '🟢' : '🔴'}</div>
          <h4>Database</h4>
          <p>{health?.database?.connected ? 'Connected' : 'Disconnected'}</p>
          <p>{health?.database?.type || 'PostgreSQL'}</p>
        </div>
        <div className="admin-health-card">
          <div className="health-status">{health?.redis?.connected ? '🟢' : '🟡'}</div>
          <h4>Redis</h4>
          <p>{health?.redis?.connected ? 'Connected' : 'Offline (fallback)'}</p>
          <p>{health?.redis?.type || 'Redis'}</p>
        </div>
        <div className="admin-health-card">
          <div className="health-status">🟢</div>
          <h4>API Server</h4>
          <p>Healthy</p>
          <p>Uptime: {health?.uptime ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m` : '—'}</p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="admin-danger-zone" style={{ marginBottom: 24 }}>
        <h3>⚠️ Danger Zone</h3>

        <div className="admin-danger-action">
          <div>
            <p style={{ fontWeight: 600, color: 'var(--admin-text)' }}>Clear Searching Pool</p>
            <p>Remove all users from matchmaking queue</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="admin-input" style={{ width: 100, fontSize: 12 }} placeholder="CONFIRM" value={confirm1} onChange={e => setConfirm1(e.target.value)} />
            <button className="admin-btn sm danger" onClick={handleClearPool}>Execute</button>
          </div>
        </div>

        <div className="admin-danger-action">
          <div>
            <p style={{ fontWeight: 600, color: 'var(--admin-text)' }}>Reset All User Statuses</p>
            <p>Set everyone to offline (emergency)</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="admin-input" style={{ width: 100, fontSize: 12 }} placeholder="CONFIRM" value={confirm2} onChange={e => setConfirm2(e.target.value)} />
            <button className="admin-btn sm danger" onClick={handleResetStatuses}>Execute</button>
          </div>
        </div>

        <div className="admin-danger-action">
          <div>
            <p style={{ fontWeight: 600, color: 'var(--admin-text)' }}>Broadcast Message</p>
            <p>Send system toast to all online users</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input className="admin-input" style={{ width: 240, fontSize: 12 }} placeholder="Message text" value={broadcast} onChange={e => setBroadcast(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="admin-input" style={{ width: 100, fontSize: 12 }} placeholder="CONFIRM" value={confirm3} onChange={e => setConfirm3(e.target.value)} />
              <button className="admin-btn sm primary" onClick={handleBroadcast}>Send</button>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log */}
      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <h3>📋 Admin Audit Log</h3>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Target</th>
              <th>Detail</th>
              <th>IP</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {auditLog.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-text-muted)' }}>No admin actions logged yet</td></tr>
            ) : auditLog.map(a => (
              <tr key={a.id}>
                <td><span className="admin-badge actioned">{a.action}</span></td>
                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                  {a.target_type ? `${a.target_type}: ${(a.target_id || '').slice(0, 8)}` : '—'}
                </td>
                <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.detail ? JSON.stringify(a.detail).slice(0, 60) : '—'}
                </td>
                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{a.admin_ip || '—'}</td>
                <td style={{ fontSize: 12 }}>{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
