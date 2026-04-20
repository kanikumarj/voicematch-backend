import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import './AdminDashboard.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const RANGES = ['24h', '7d', '30d'];
const PIE_COLORS = ['#7c6af7', '#48b0f7', '#f76a6a', '#f7c06a'];

export default function AdminDashboard({ token }) {
  const [range, setRange]       = useState('24h');
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API}/api/admin/analytics?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) { setError('Admin access required'); return; }
      if (!res.ok)            { setError('Failed to load analytics'); return; }
      setData(await res.json());
      setLastRefresh(new Date().toLocaleTimeString());
    } catch {
      setError('Network error — retrying…');
    } finally {
      setLoading(false);
    }
  }, [range, token]);

  // Initial load + 30s auto-refresh
  useEffect(() => {
    setLoading(true);
    fetchMetrics();
    const id = setInterval(fetchMetrics, 30_000);
    return () => clearInterval(id);
  }, [fetchMetrics]);

  function fmtDuration(secs) {
    if (!secs) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  const disconnectPieData = data
    ? Object.entries(data.disconnectReasons).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>📊 Admin Dashboard</h1>
        <div className="admin-controls">
          <div className="range-tabs" role="tablist">
            {RANGES.map(r => (
              <button
                key={r}
                role="tab"
                aria-selected={range === r}
                className={`range-tab${range === r ? ' active' : ''}`}
                onClick={() => setRange(r)}
              >{r}</button>
            ))}
          </div>
          <button className="refresh-btn" onClick={fetchMetrics} aria-label="Refresh">↻ Refresh</button>
        </div>
        {lastRefresh && <p className="last-refresh">Last updated: {lastRefresh}</p>}
      </header>

      {loading && <div className="admin-loading"><div className="spinner" />Loading analytics…</div>}
      {error   && <div className="admin-error">{error}</div>}

      {data && !loading && (
        <div className="admin-grid">
          {/* ── Live stats ───────────────────────────────────────────── */}
          <section className="stat-cards">
            {[
              { label: 'Total Sessions',    value: data.totalSessions,              icon: '📞' },
              { label: 'Avg Call Duration', value: fmtDuration(data.avgCallDuration), icon: '⏱' },
              { label: 'Live Connected',    value: data.activeNow.connected,         icon: '🟢' },
              { label: 'Currently In Call', value: data.activeNow.inCall,            icon: '🎙' },
              { label: 'Searching',         value: data.activeNow.searching,         icon: '🔍' },
              { label: 'Retention Rate',    value: `${data.retention.rate_percent}%`, icon: '🔄' },
            ].map(({ label, value, icon }) => (
              <div key={label} className="stat-card">
                <span className="stat-icon">{icon}</span>
                <p className="stat-value">{value}</p>
                <p className="stat-label">{label}</p>
              </div>
            ))}
          </section>

          {/* ── Peak hours bar chart ─────────────────────────────────── */}
          <section className="chart-card">
            <h2>Peak Hours</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.peakHours} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="hour" tick={{ fill: '#9090b0', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9090b0', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                  labelStyle={{ color: '#e8e8f0' }}
                />
                <Bar dataKey="session_count" fill="#7c6af7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* ── Disconnect reasons pie ───────────────────────────────── */}
          <section className="chart-card">
            <h2>Disconnect Reasons</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={disconnectPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {disconnectPieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </section>

          {/* ── Retention detail ─────────────────────────────────────── */}
          <section className="stat-card retention-card">
            <h2>Retention ({range})</h2>
            <p>{data.retention.retained_users} / {data.retention.total_users} users returned</p>
            <div className="retention-bar">
              <div className="retention-fill" style={{ width: `${data.retention.rate_percent}%` }} />
            </div>
            <p className="retention-rate">{data.retention.rate_percent}%</p>
          </section>
        </div>
      )}
    </div>
  );
}
