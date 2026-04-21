import { useState, useEffect } from 'react';
import adminApi from '../../../lib/adminApi';

const RANGES = [
  { key: '7d',  label: '7 Days' },
  { key: '30d', label: '30 Days' },
];

export default function AnalyticsPage() {
  const [range, setRange]     = useState('7d');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const res = await adminApi.get('/admin-api/analytics', { params: { range } });
      setData(res.data);
    } catch (err) {
      console.error('Analytics fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAnalytics(); }, [range]);

  if (loading) return <div className="admin-empty"><span>⏳</span><p>Loading analytics...</p></div>;
  if (!data) return <div className="admin-empty"><span>⚠️</span><p>Failed to load analytics</p></div>;

  const maxCalls = Math.max(...(data.callsByHour.map(h => h.count) || [1]), 1);

  return (
    <>
      {/* Range Picker */}
      <div className="admin-filters" style={{ marginBottom: 24 }}>
        {RANGES.map(r => (
          <button
            key={r.key}
            className={`admin-filter-pill ${range === r.key ? 'active' : ''}`}
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Daily Registrations */}
      <div className="admin-chart-card" style={{ marginBottom: 24 }}>
        <h3>📈 Daily New Registrations</h3>
        {data.dailyUsers.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>No data</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
            {data.dailyUsers.map((d, i) => {
              const max = Math.max(...data.dailyUsers.map(x => x.count), 1);
              const h = Math.max((d.count / max) * 100, 4);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--admin-text-muted)' }}>
                    {d.count}
                  </span>
                  <div style={{
                    width: '100%', maxWidth: 40, height: `${h}%`,
                    background: 'var(--admin-accent)', borderRadius: 4, minHeight: 4
                  }} />
                  <span style={{ fontSize: 9, color: 'var(--admin-text-muted)' }}>
                    {new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Calls by Hour */}
      <div className="admin-chart-card" style={{ marginBottom: 24 }}>
        <h3>📞 Calls by Hour of Day</h3>
        {data.callsByHour.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>No data</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
            {Array.from({ length: 24 }, (_, h) => {
              const entry = data.callsByHour.find(x => x.hour === h);
              const count = entry ? entry.count : 0;
              const barH = Math.max((count / maxCalls) * 100, 2);
              return (
                <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: 'var(--admin-text-muted)' }}>
                    {count > 0 ? count : ''}
                  </span>
                  <div style={{
                    width: '100%', height: `${barH}%`,
                    background: count > 0 ? 'var(--admin-info)' : 'var(--admin-border)',
                    borderRadius: 2, minHeight: 2
                  }} />
                  <span style={{ fontSize: 8, color: 'var(--admin-text-muted)' }}>{h}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* End Reasons */}
      <div className="admin-chart-card">
        <h3>🔚 Call End Reasons</h3>
        {data.endReasons.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>No data</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {data.endReasons.map(r => {
              const colors = {
                user_disconnect: 'var(--admin-warning)',
                skip: 'var(--admin-info)',
                error: 'var(--admin-danger)',
                mutual_end: 'var(--admin-success)',
                unknown: 'var(--admin-text-muted)',
              };
              return (
                <div key={r.reason} className="admin-stat-card" style={{ padding: 14, textAlign: 'center', minWidth: 120 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: colors[r.reason] || 'var(--admin-text-muted)', margin: '0 auto 8px' }} />
                  <div className="stat-value" style={{ fontSize: 20 }}>{r.count}</div>
                  <div className="stat-sub">{r.reason}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
