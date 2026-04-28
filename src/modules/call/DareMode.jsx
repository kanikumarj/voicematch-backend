// FIX: [Area 3] Dare Mode — complete redesign with category picker, Tamil content, hint text

import { useState, useRef, useEffect, useCallback } from 'react';

// FIX: [Area 3] Category colors and metadata
const CATEGORY_COLORS = {
  music:     '#7C3AED',
  movies:    '#EF4444',
  cricket:   '#10B981',
  anime:     '#F59E0B',
  series:    '#3B82F6',
  funny:     '#EC4899',
  deep:      '#6366F1',
  challenge: '#F97316',
  wild:      '#14B8A6',
};

// FIX: [Area 3] Category selector data
const CATEGORIES = [
  { id: 'music',     label: '🎵', name: 'Music' },
  { id: 'movies',    label: '🎬', name: 'Movies' },
  { id: 'cricket',   label: '🏏', name: 'Cricket' },
  { id: 'anime',     label: '🎌', name: 'Anime' },
  { id: 'series',    label: '📺', name: 'Series' },
  { id: 'funny',     label: '😄', name: 'Funny' },
  { id: 'deep',      label: '💭', name: 'Deep' },
  { id: 'challenge', label: '🎯', name: 'Challenge' },
  { id: null,        label: '🎲', name: 'Random' }
];

export default function DareMode({ socket, partner, sessionId, userName, isCallConnected }) {
  const [dareState, setDareState] = useState('idle');
  // idle | waiting | invite | category_pick | active | ended

  const [currentDare, setCurrentDare] = useState(null);
  const [timeLeft, setTimeLeft]       = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(null);
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

  // FIX: [Area 3] Accept now sends category preference
  const handleAccept = (category = null) => {
    const cat = category || selectedCategory;
    socket.emit('dare_accept', { sessionId, preferredCategory: cat });
  };

  const handleDecline = () => {
    socket.emit('dare_decline', { sessionId });
    setDareState('idle');
  };

  // FIX: [Area 3] Next dare with optional category change
  const handleNext = (newCategory = null) => {
    clearInterval(timerRef.current);
    socket.emit('dare_next', { sessionId, preferredCategory: newCategory || selectedCategory });
  };

  const handleExit = () => {
    clearInterval(timerRef.current);
    socket.emit('dare_exit', { sessionId });
    setDareState('idle');
    setCurrentDare(null);
    setSelectedCategory(null);
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
      setSelectedCategory(null);
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

  // FIX: [Area 1] Fixed overlay style — doesn't cover audio element
  const overlayStyle = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 30, // FIX: [Area 1] Dare overlay z-index
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '24px',
  };

  // FIX: [Area 1] Call active indicator in dare overlay
  const callActiveIndicator = (
    <div style={{
      position: 'fixed', top: '16px', right: '16px',
      zIndex: 31,
      background: 'rgba(34,197,94,0.2)',
      border: '1px solid rgba(34,197,94,0.4)',
      borderRadius: 'var(--radius-full, 999px)',
      padding: '6px 12px',
      display: 'flex', alignItems: 'center', gap: '6px',
      fontSize: '12px', color: '#22C55E', fontWeight: 600,
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', animation: 'pulse-ring 2s infinite' }} />
      🎙️ Call active
    </div>
  );

  // FIX: [Area 3] Invite overlay with category picker
  if (dareState === 'invite') {
    return (
      <div style={overlayStyle}>
        {callActiveIndicator}
        <div style={{
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-xl, 20px)',
          padding: '28px', maxWidth: '380px', width: '100%', textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎲</div>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
            Dare Mode!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
            {partner?.name || partner?.displayName || 'Your match'} wants to play Dare Mode!
          </p>

          {/* FIX: [Area 3] Category picker grid */}
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Choose a category
          </p>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px', marginBottom: '20px',
          }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id || 'random'}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '10px 6px',
                  background: selectedCategory === cat.id
                    ? `${CATEGORY_COLORS[cat.id] || 'var(--accent-primary)'}22`
                    : 'var(--bg-secondary)',
                  border: `1.5px solid ${selectedCategory === cat.id
                    ? CATEGORY_COLORS[cat.id] || 'var(--accent-primary)'
                    : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '20px' }}>{cat.label}</span>
                <span style={{
                  fontSize: '10px', fontWeight: 600,
                  color: selectedCategory === cat.id
                    ? CATEGORY_COLORS[cat.id] || 'var(--accent-primary)'
                    : 'var(--text-muted)',
                }}>
                  {cat.name}
                </span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleDecline} style={{
              flex: 1, padding: '14px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '15px', fontWeight: 600,
            }}>❌ No Thanks</button>
            <button onClick={() => handleAccept()} style={{
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
        {callActiveIndicator}
        <div style={{
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-xl, 20px)',
          padding: '28px', maxWidth: '380px', width: '100%', textAlign: 'center',
        }}>
          {/* FIX: [Area 3] Category badge with emoji and color */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '5px 14px',
            background: `${categoryColor}22`, border: `1px solid ${categoryColor}44`,
            borderRadius: '999px', color: categoryColor,
            fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: '16px',
          }}>
            {currentDare?.icon || '🎲'} {currentDare?.category || 'dare'}
          </div>

          {/* Dare text */}
          <p style={{
            color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700,
            lineHeight: 1.5, marginBottom: '8px', minHeight: '70px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {currentDare?.text}
          </p>

          {/* FIX: [Area 3] Hint text */}
          {currentDare?.hint && (
            <p style={{
              color: 'var(--text-muted)',
              fontSize: '13px',
              fontStyle: 'italic',
              marginBottom: '20px',
            }}>
              💡 {currentDare.hint}
            </p>
          )}

          {/* Timer ring */}
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
            <button onClick={() => handleNext()} style={{
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
