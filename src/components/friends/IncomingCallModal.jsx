import { useEffect, useRef } from 'react';
import Avatar from '../ui/Avatar';
import './IncomingCallModal.css';

export default function IncomingCallModal({ call, onAccept, onReject }) {
  const ringRef = useRef(null);

  useEffect(() => {
    if (!call) return;

    // Vibration on mobile
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);

    // Ringtone (Web Audio API)
    let ctx, oscillator, gain;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      oscillator = ctx.createOscillator();
      gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      oscillator.start();
    } catch {}

    const autoTimer = setTimeout(() => { onReject(); }, 30000);

    return () => {
      clearTimeout(autoTimer);
      try { oscillator?.stop(); ctx?.close(); } catch {}
      navigator.vibrate?.(0);
    };
  }, [call, onReject]);

  if (!call) return null;

  return (
    <div className="incoming-overlay" role="dialog" aria-modal="true">
      {/* Pulsing rings */}
      <div className="incoming-rings">
        <div className="ring" /><div className="ring ring-2" /><div className="ring ring-3" />
      </div>

      <div className="incoming-content">
        <Avatar name={call.fromUser?.displayName} size="xl" status="in_call" className="incoming-avatar" />
        <span className="incoming-label">Incoming Voice Call</span>
        <h2 className="incoming-name">{call.fromUser?.displayName}</h2>

        <div className="incoming-btns">
          <button className="incoming-btn reject" onClick={onReject} aria-label="Decline call">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.24h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 5.95 5.95l.87-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
            <span>Decline</span>
          </button>

          <button className="incoming-btn accept" onClick={onAccept} aria-label="Accept call" ref={ringRef}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.24h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 5.95 5.95l.87-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}
