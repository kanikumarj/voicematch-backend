import { useState, useEffect } from 'react';
import adminApi from '../../../lib/adminApi';

export default function OverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const res = await adminApi.get('/admin-api/overview');
      setData(res.data);
    } catch (err) {
      console.error('Overview fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="admin-empty"><span>⏳</span><p>Loading overview...</p></div>;
  if (!data) return <div className="admin-empty"><span>⚠️</span><p>Failed to load overview</p></div>;

  const formatDuration = (s) => {
    if (!s) return '0s';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <>
      {/* Row 1: Live Counters */}
      <div className="admin-stats-row">
        <div className="admin-stat-card">
          <div className="stat-label">🟢 Online</div>
          <div className="stat-value">{data.live.online}</div>
          <div className="stat-sub">Live now</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">🎙️ In Call</div>
          <div className="stat-value">{data.live.in_call}</div>
          <div className="stat-sub">Active calls</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">🔍 Searching</div>
          <div className="stat-value">{data.live.searching}</div>
          <div className="stat-sub">In queue</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">👥 Total Users</div>
          <div className="stat-value">{data.totalUsers}</div>
          <div className="stat-sub">All time</div>
        </div>
      </div>

      {/* Row 2: Today Stats */}
      <div className="admin-stats-row">
        <div className="admin-stat-card">
          <div className="stat-label">📞 Calls Today</div>
          <div className="stat-value">{data.todayCalls}</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">⏱ Avg Duration</div>
          <div className="stat-value">{formatDuration(data.avgDuration)}</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">🆕 New Users Today</div>
          <div className="stat-value">{data.todayNewUsers}</div>
        </div>
      </div>
    </>
  );
}
