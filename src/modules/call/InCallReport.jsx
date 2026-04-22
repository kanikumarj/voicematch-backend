// NEW: [Feature 1 — In-Call Report UI]

import { useState, useEffect } from 'react';
import { getSocket } from '../../lib/socket';

const REPORT_REASONS = [
  { id: 'inappropriate', label: '🔞 Inappropriate content' },
  { id: 'harassment',    label: '😤 Harassment' },
  { id: 'hate_speech',   label: '🤬 Hate speech' },
  { id: 'spam',          label: '🤖 Spam or bot' },
  { id: 'other',         label: '⚠️ Other' },
];

export default function InCallReport({ partner, sessionId, onReported }) {
  const [status, setStatus] = useState('idle');
  // idle | open | submitting | done

  let socket;
  try { socket = getSocket(); } catch { socket = null; }

  useEffect(() => {
    if (!socket) return;

    const handleSubmitted = () => {
      setStatus('done');
      onReported?.();
    };

    const handleError = ({ message }) => {
      setStatus('idle');
      alert(message || 'Failed to report');
    };

    socket.on('report_submitted', handleSubmitted);
    socket.on('report_error', handleError);

    return () => {
      socket.off('report_submitted', handleSubmitted);
      socket.off('report_error', handleError);
    };
  }, [socket, onReported]);

  const handleSelectReason = (reason) => {
    if (!socket || status === 'submitting') return;
    setStatus('submitting');

    socket.emit('report_during_call', {
      sessionId,
      reason,
      reportedUserId: partner?.id || partner,
    });
  };

  // Idle state — show flag button
  if (status === 'idle') {
    return (
      <button
        onClick={() => setStatus('open')}
        title="Report this user"
        className="incall-report-btn"
        style={{
          background: 'rgba(239,68,68,0.15)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#EF4444',
          padding: '8px 12px',
          cursor: 'pointer',
          fontSize: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        🚩
        <span style={{ fontSize: '12px', fontWeight: 600 }}>Report</span>
      </button>
    );
  }

  // Done state
  if (status === 'done') {
    return (
      <div style={{
        background: 'rgba(16,185,129,0.15)',
        border: '1px solid rgba(16,185,129,0.3)',
        borderRadius: 'var(--radius-md)',
        color: '#10B981',
        padding: '8px 12px',
        fontSize: '13px',
        fontWeight: 600,
      }}>
        ✅ Reported
      </div>
    );
  }

  // Open / submitting state — reason selector
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setStatus('idle')}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 100,
        }}
      />

      {/* Bottom sheet */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        background: 'var(--bg-elevated)',
        borderRadius: '20px 20px 0 0',
        padding: '24px',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        zIndex: 101,
        maxWidth: '480px',
        margin: '0 auto',
      }}>
        {/* Handle */}
        <div style={{
          width: '40px', height: '4px',
          background: 'var(--border-default)',
          borderRadius: '2px',
          margin: '0 auto 20px',
        }} />

        <h3 style={{
          color: 'var(--text-primary)',
          fontSize: '17px', fontWeight: 700,
          marginBottom: '6px',
        }}>
          Report {partner?.name || partner?.displayName || 'this user'}
        </h3>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '13px', marginBottom: '20px',
        }}>
          Your call will continue. Select a reason:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {REPORT_REASONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleSelectReason(id)}
              disabled={status === 'submitting'}
              style={{
                padding: '14px 16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '15px',
                textAlign: 'left',
                cursor: 'pointer',
                fontWeight: 500,
                opacity: status === 'submitting' ? 0.6 : 1,
              }}
            >
              {status === 'submitting' ? '⏳ Submitting...' : label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setStatus('idle')}
          style={{
            marginTop: '16px', width: '100%',
            padding: '12px', background: 'transparent',
            border: 'none', color: 'var(--text-secondary)',
            fontSize: '14px', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </>
  );
}
