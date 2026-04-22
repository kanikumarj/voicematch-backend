// NEW: [Feature 5 — Announcements Admin Page]

import { useState, useEffect, useCallback } from 'react';
import adminApi from '../../../lib/adminApi';

const SEGMENT_OPTIONS = [
  { value: 'all',          label: '📢 All users' },
  { value: 'inactive_7d', label: '😴 Inactive 7+ days' },
  { value: 'no_friends',  label: '👤 Users with 0 friends' },
  { value: 'new_users',   label: '🆕 New users (< 3 days)' },
  { value: 'high_trust',  label: '⭐ High trust score (80+)' },
  { value: 'specific_user', label: '🎯 Specific user' },
];

const TYPE_OPTIONS = [
  { value: 'info',    label: '💙 Info',    color: '#3B82F6' },
  { value: 'success', label: '💚 Success', color: '#10B981' },
  { value: 'warning', label: '💛 Warning', color: '#F59E0B' },
];

export default function AnnouncementsPage() {
  const [title, setTitle]         = useState('');
  const [message, setMessage]     = useState('');
  const [type, setType]           = useState('info');
  const [segment, setSegment]     = useState('all');
  const [targetUserId, setTargetUserId] = useState('');
  const [scheduledAt, setScheduledAt]   = useState('');
  const [estimated, setEstimated] = useState(null);
  const [sending, setSending]     = useState(false);
  const [sent, setSent]           = useState(false);
  const [history, setHistory]     = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await adminApi.get('/admin-api/announcements');
      setHistory(res?.data?.announcements || []);
    } catch {
      // silent
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Fetch estimated recipients when segment changes
  useEffect(() => {
    const fetchEstimate = async () => {
      try {
        const params = new URLSearchParams({ segment });
        if (segment === 'specific_user' && targetUserId) {
          params.append('targetUserId', targetUserId);
        }
        const res = await adminApi.get(`/admin-api/announcements/estimate?${params}`);
        setEstimated(res?.data?.count ?? null);
      } catch {
        setEstimated(null);
      }
    };
    fetchEstimate();
  }, [segment, targetUserId]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    try {
      await adminApi.post('/admin-api/announcements', {
        title: title.trim(),
        message: message.trim(),
        type,
        segment,
        targetUserId: segment === 'specific_user' ? targetUserId : null,
        scheduledAt: scheduledAt || null,
        sendNow: !scheduledAt,
      });

      setSent(true);
      setTitle('');
      setMessage('');
      setSegment('all');
      setScheduledAt('');
      fetchHistory();
      setTimeout(() => setSent(false), 3000);
    } catch {
      alert('Failed to send announcement');
    } finally {
      setSending(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this announcement?')) return;
    try {
      await adminApi.delete(`/admin-api/announcements/${id}`);
      fetchHistory();
    } catch {
      alert('Failed to cancel');
    }
  };

  const selectedType = TYPE_OPTIONS.find(t => t.value === type);

  const s = {
    container: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '24px', height: '100%' },
    card: { background: '#1C2128', borderRadius: '12px', border: '1px solid #30363D', padding: '24px' },
    label: { display: 'block', color: '#9CA3AF', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' },
    input: { width: '100%', padding: '10px 12px', background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', color: '#E6EDF3', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
    textarea: { width: '100%', padding: '10px 12px', background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', color: '#E6EDF3', fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' },
  };

  return (
    <div style={s.container}>
      {/* Composer */}
      <div style={s.card}>
        <h2 style={{ color: '#E6EDF3', fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>
          📣 New Announcement
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={s.label}>Title</label>
          <input style={s.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Announcement title..." maxLength={200} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={s.label}>Message ({message.length}/200)</label>
          <textarea style={s.textarea} value={message} onChange={e => setMessage(e.target.value.slice(0, 200))} placeholder="Write your announcement..." />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={s.label}>Type</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {TYPE_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setType(opt.value)} style={{
                flex: 1, padding: '8px',
                background: type === opt.value ? `${opt.color}22` : '#0D1117',
                border: `1px solid ${type === opt.value ? opt.color : '#30363D'}`,
                borderRadius: '8px', color: type === opt.value ? opt.color : '#9CA3AF',
                cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={s.label}>Send To</label>
          <select style={{ ...s.input, cursor: 'pointer' }} value={segment} onChange={e => setSegment(e.target.value)}>
            {SEGMENT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {estimated !== null && (
            <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '6px' }}>
              Estimated recipients: {estimated} users
            </p>
          )}
        </div>

        {segment === 'specific_user' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={s.label}>User ID</label>
            <input style={s.input} value={targetUserId} onChange={e => setTargetUserId(e.target.value)} placeholder="Paste user UUID..." />
          </div>
        )}

        <div style={{ marginBottom: '24px' }}>
          <label style={s.label}>Schedule (optional)</label>
          <input type="datetime-local" style={s.input} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          {scheduledAt && <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '6px' }}>Will send at: {new Date(scheduledAt).toLocaleString()}</p>}
        </div>

        {previewMode && title && message && (
          <div style={{
            padding: '14px', background: `${selectedType?.color}15`,
            border: `1px solid ${selectedType?.color}33`, borderRadius: '10px', marginBottom: '16px',
          }}>
            <p style={{ color: selectedType?.color, fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>{title}</p>
            <p style={{ color: '#E6EDF3', fontSize: '13px' }}>{message}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setPreviewMode(!previewMode)} style={{
            padding: '12px 16px', background: '#0D1117', border: '1px solid #30363D',
            borderRadius: '8px', color: '#9CA3AF', cursor: 'pointer', fontSize: '14px',
          }}>
            {previewMode ? '✕ Hide Preview' : '👁️ Preview'}
          </button>

          <button onClick={handleSend} disabled={sending || !title || !message} style={{
            flex: 1, padding: '12px',
            background: sent ? '#10B981' : (sending || !title || !message) ? '#374151' : '#F78166',
            border: 'none', borderRadius: '8px', color: 'white',
            cursor: sending ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 700,
          }}>
            {sent ? '✅ Sent!' : sending ? '⏳ Sending...' : scheduledAt ? '📅 Schedule' : '📣 Send Now'}
          </button>
        </div>
      </div>

      {/* History */}
      <div style={s.card}>
        <h2 style={{ color: '#E6EDF3', fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>
          📋 History
        </h2>

        {loadingHistory ? (
          <p style={{ color: '#9CA3AF' }}>Loading...</p>
        ) : history.length === 0 ? (
          <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '40px 0' }}>No announcements yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '600px', overflowY: 'auto' }}>
            {history.map(ann => {
              const tc = TYPE_OPTIONS.find(t => t.value === ann.type);
              return (
                <div key={ann.id} style={{
                  padding: '14px', background: '#0D1117', borderRadius: '10px',
                  border: `1px solid ${tc?.color || '#30363D'}33`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <span style={{ color: '#E6EDF3', fontSize: '14px', fontWeight: 700 }}>{ann.title}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                      background: ann.status === 'sent' ? 'rgba(16,185,129,0.15)' : ann.status === 'scheduled' ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)',
                      color: ann.status === 'sent' ? '#10B981' : ann.status === 'scheduled' ? '#F59E0B' : '#6B7280',
                    }}>
                      {ann.status}
                    </span>
                  </div>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', marginBottom: '8px' }}>
                    {ann.message?.substring(0, 80)}{ann.message?.length > 80 ? '...' : ''}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#6B7280', fontSize: '11px' }}>
                      {ann.status === 'sent' ? `✓ ${ann.sent_count} delivered` : ann.status === 'scheduled' ? `📅 ${new Date(ann.scheduled_at).toLocaleString()}` : ''}
                    </span>
                    {ann.status === 'scheduled' && (
                      <button onClick={() => handleCancel(ann.id)} style={{
                        padding: '4px 8px', background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px',
                        color: '#EF4444', cursor: 'pointer', fontSize: '11px',
                      }}>Cancel</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
