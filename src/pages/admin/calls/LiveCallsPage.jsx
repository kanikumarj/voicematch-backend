import { useState, useEffect, useRef } from 'react';
import adminApi from '../../../lib/adminApi';

export default function LiveCallsPage() {
  const [calls, setCalls]     = useState([]);
  const [loading, setLoading] = useState(true);
  const timersRef = useRef({});

  async function fetchCalls() {
    try {
      const res = await adminApi.get('/admin-api/calls/live');
      setCalls(res.data);
    } catch (err) {
      console.error('Live calls fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(fetchCalls, 10000);
    return () => clearInterval(interval);
  }, []);

  function formatElapsed(startedAt) {
    const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  async function forceEnd(sessionId) {
    if (!confirm('Force end this call?')) return;
    try {
      await adminApi.delete(`/admin-api/calls/${sessionId}`);
      fetchCalls();
    } catch (err) {
      console.error('Force end failed:', err);
    }
  }

  // Live timer update
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <div className="admin-empty"><span>⏳</span><p>Loading live calls...</p></div>;

  return (
    <>
      <div style={{ marginBottom: 20, fontSize: 14, color: 'var(--admin-text-sec)' }}>
        {calls.length} active call{calls.length !== 1 ? 's' : ''} right now
      </div>

      {calls.length === 0 ? (
        <div className="admin-empty">
          <span>📞</span>
          <p>No active calls right now</p>
        </div>
      ) : (
        <div className="admin-live-grid">
          {calls.map(c => (
            <div className="admin-call-card" key={c.id}>
              <div className="live-dot" />
              <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                {c.id.slice(0, 8)}...
              </div>

              <div className="admin-call-users">
                <div style={{ textAlign: 'center' }}>
                  <div>👤</div>
                  <div>{c.user_a_name || 'User A'}</div>
                </div>
                <span className="vs">↔</span>
                <div style={{ textAlign: 'center' }}>
                  <div>👤</div>
                  <div>{c.user_b_name || 'User B'}</div>
                </div>
              </div>

              <div className="admin-call-meta">{formatElapsed(c.started_at)}</div>

              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--admin-text-muted)', marginBottom: 12 }}>
                Started {new Date(c.started_at).toLocaleTimeString()}
              </div>

              <div className="admin-call-actions">
                <button className="admin-btn sm danger" onClick={() => forceEnd(c.id)}>
                  🛑 End Call
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
