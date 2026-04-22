// NEW: [Feature 3 — Dare Mode UI]

import { useState, useRef, useEffect, useCallback } from 'react';

const CATEGORY_COLORS = {
  voice:     '#7C3AED',
  challenge: '#F59E0B',
  funny:     '#EF4444',
  deep:      '#3B82F6',
  wild:      '#10B981',
};

export default function DareMode({ socket, partner, sessionId, userName, isCallConnected }) {
  const [dareState, setDareState] = useState('idle');
  // idle | waiting | invite | active | ended

  const [currentDare, setCurrentDare] = useState(null);
  const [timeLeft, setTimeLeft]       = useState(0);
  const timerRef = useRef(null);

  const startTimer = useCallback((duration) => {
    clearInterval(timerRef.current);
    setTimeLeft(duration);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setDareState('ended');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleDareRequest = () => {
    if (!socket || dareState !== 'idle') return;
    socket.emit('dare_request', { fromUser: userName, sessionId });
    setDareState('waiting');
  };

  const handleAccept = () => {
    socket.emit('dare_accept', { sessionId });
  };

  const handleDecline = () => {
    socket.emit('dare_decline', { sessionId });
    setDareState('idle');
  };

  const handleNext = () => {
    clearInterval(timerRef.current);
    socket.emit('dare_next', { sessionId });
  };

  const handleExit = () => {
    clearInterval(timerRef.current);
    socket.emit('dare_exit', { sessionId });
    setDareState('idle');
    setCurrentDare(null);
  };

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const onRequestSent = () => setDareState('waiting');
    const onInvite      = () => setDareState('invite');
    const onDeclined    = () => setDareState('idle');
    const onStarted     = ({ dare }) => {
      setCurrentDare(dare);
      setDareState('active');
      startTimer(dare.duration);
    };
    const onNew = ({ dare }) => {
      setCurrentDare(dare);
      setDareState('active');
      startTimer(dare.duration);
    };
    const onEnded = () => {
      clearInterval(timerRef.current);
      setDareState('idle');
      setCurrentDare(null);
    };
    const onError = () => {
      setDareState('idle');
    };

    socket.on('dare_request_sent', onRequestSent);
    socket.on('dare_invite',       onInvite);
    socket.on('dare_declined',     onDeclined);
    socket.on('dare_started',      onStarted);
    socket.on('dare_new',          onNew);
    socket.on('dare_ended',        onEnded);
    socket.on('dare_error',        onError);

    return () => {
      socket.off('dare_request_sent', onRequestSent);
      socket.off('dare_invite',       onInvite);
      socket.off('dare_declined',     onDeclined);
      socket.off('dare_started',      onStarted);
      socket.off('dare_new',          onNew);
      socket.off('dare_ended',        onEnded);
      socket.off('dare_error',        onError);
      clearInterval(timerRef.current);
    };
  }, [socket, startTimer]);

  if (!isCallConnected) return null;

  // Dare button (idle state)
  if (dareState === 'idle') {
    return (
      <button onClick={handleDareRequest} className="call-ctrl">
        <span style={{ fontSize: '20px' }}>🎲</span>
        <span>Dare</span>
      </button>
    );
  }

  if (dareState === 'waiting') {
    return (
      <button disabled className="call-ctrl" style={{ opacity: 0.6 }}>
        <span style={{ fontSize: '16px' }}>⏳</span>
        <span>Waiting</span>
      </button>
    );
  }

  // Full screen overlays
  const overlayStyle = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.85)',
    zIndex: 200,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '24px',
  };

  // Invite overlay
  if (dareState === 'invite') {
    return (
      <div style={overlayStyle}>
        <div style={{
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-xl, 20px)',
          padding: '32px', maxWidth: '340px', width: '100%', textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎲</div>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
            Dare Mode!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
            {partner?.name || partner?.displayName || 'Your match'} wants to play Dare Mode. Random challenges for both of you!
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleDecline} style={{
              flex: 1, padding: '14px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '15px', fontWeight: 600,
            }}>❌ No Thanks</button>
            <button onClick={handleAccept} style={{
              flex: 1, padding: '14px', background: 'var(--accent-primary)',
              border: 'none', borderRadius: 'var(--radius-md)',
              color: 'white', cursor: 'pointer', fontSize: '15px', fontWeight: 700,
            }}>✅ Let's Go!</button>
          </div>
        </div>
      </div>
    );
  }

  // Active / Ended overlays
  if (dareState === 'active' || dareState === 'ended') {
    const categoryColor = CATEGORY_COLORS[currentDare?.category] || 'var(--accent-primary)';
    const progress = currentDare ? (timeLeft / currentDare.duration) * 100 : 0;

    return (
      <div style={overlayStyle}>
        <div style={{
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-xl, 20px)',
          padding: '32px', maxWidth: '380px', width: '100%', textAlign: 'center',
        }}>
          {/* Category badge */}
          <div style={{
            display: 'inline-block', padding: '4px 12px',
            background: `${categoryColor}22`, border: `1px solid ${categoryColor}44`,
            borderRadius: '999px', color: categoryColor,
            fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: '16px',
          }}>
            🎲 {currentDare?.category || 'dare'}
          </div>

          {/* Dare text */}
          <p style={{
            color: 'var(--text-primary)', fontSize: '20px', fontWeight: 700,
            lineHeight: 1.4, marginBottom: '24px', minHeight: '80px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {currentDare?.text}
          </p>

          {/* Timer */}
          {dareState === 'active' ? (
            <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 20px' }}>
              <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg-secondary)" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke={categoryColor} strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, fontFamily: 'monospace',
              }}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </div>
            </div>
          ) : (
            <div style={{ color: '#F59E0B', fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>
              ⏱ Time's up!
            </div>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleExit} style={{
              flex: 1, padding: '14px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
            }}>🚪 Exit</button>
            <button onClick={handleNext} style={{
              flex: 1, padding: '14px', background: categoryColor,
              border: 'none', borderRadius: 'var(--radius-md)',
              color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 700,
            }}>⏭ Next Dare</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
