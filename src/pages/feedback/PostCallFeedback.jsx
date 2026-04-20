import { useState, useEffect, useRef } from 'react';
import './PostCallFeedback.css';

const REASONS = [
  { value: 'harassment',   label: 'Harassment' },
  { value: 'hate_speech',  label: 'Hate speech' },
  { value: 'spam',         label: 'Spam / bot' },
  { value: 'inappropriate',label: 'Inappropriate content' },
  { value: 'other',        label: 'Other' },
];

const API = import.meta.env.VITE_API_URL;

export default function PostCallFeedback({ sessionId, partnerId, partnerName, token, onDone }) {
  const [rating,       setRating]       = useState(0);
  const [hovered,      setHovered]      = useState(0);
  const [reporting,    setReporting]    = useState(false);
  const [reason,       setReason]       = useState('');
  const [detail,       setDetail]       = useState('');
  const [loading,      setLoading]      = useState(false);
  const [countdown,    setCountdown]    = useState(5);
  const interactedRef  = useRef(false);

  // Auto-skip countdown (pauses if user interacts)
  useEffect(() => {
    const id = setInterval(() => {
      if (interactedRef.current) return;
      setCountdown(c => {
        if (c <= 1) { clearInterval(id); onDone(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onDone]);

  function handleInteraction() { interactedRef.current = true; }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rating) return;
    setLoading(true);
    try {
      await fetch(`${API}/api/feedback`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          rating,
          wasReported:  reporting,
          reportReason: reporting ? reason : undefined,
          reportDetail: reporting && detail ? detail : undefined,
        }),
      });
    } catch { /* non-critical — continue even if feedback fails */ }
    finally { setLoading(false); onDone(); }
  }

  return (
    <div className="pcf-overlay">
      <div className="pcf-card" onClick={handleInteraction}>
        <h2 className="pcf-title">How was your call?</h2>
        <p className="pcf-sub">with <strong>{partnerName || 'Anonymous'}</strong></p>

        {/* ── Star rating ── */}
        <div className="pcf-stars" role="radiogroup" aria-label="Rate this call">
          {[1,2,3,4,5].map(n => (
            <button
              key={n}
              type="button"
              className={`pcf-star${n <= (hovered || rating) ? ' active' : ''}`}
              aria-label={`${n} star`}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => { setRating(n); handleInteraction(); }}
            >★</button>
          ))}
        </div>

        {/* ── Report toggle ── */}
        <button
          type="button"
          className={`pcf-report-toggle${reporting ? ' active' : ''}`}
          onClick={() => { setReporting(r => !r); handleInteraction(); }}
        >
          {reporting ? '▼ Hide report' : '⚑ Report this user'}
        </button>

        {reporting && (
          <div className="pcf-report-form">
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
              className="pcf-select"
            >
              <option value="">Select a reason…</option>
              {REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <textarea
              value={detail}
              onChange={e => setDetail(e.target.value.slice(0, 500))}
              placeholder="Optional details (500 chars max)"
              className="pcf-detail"
              rows={3}
            />
          </div>
        )}

        {/* ── Actions ── */}
        <button
          id="btn-submit-feedback"
          type="button"
          className="pcf-btn"
          disabled={!rating || loading || (reporting && !reason)}
          onClick={handleSubmit}
        >
          {loading ? <span className="btn-spinner" /> : 'Submit'}
        </button>

        <button
          type="button"
          className="pcf-skip"
          onClick={onDone}
        >
          Skip{!interactedRef.current && countdown > 0 ? ` (${countdown})` : ''}
        </button>
      </div>
    </div>
  );
}
