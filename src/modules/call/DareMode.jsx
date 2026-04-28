// FIX: DareMode — buttonOnly / panelOnly props, anime dares in English/Romaji

import { useState, useRef, useEffect, useCallback } from 'react';

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

export default function DareMode({
  socket, partner, sessionId, userName, isCallConnected,
  buttonOnly = false,
  panelOnly = false
}) {
  const [dareState, setDareState] = useState('idle');
  // idle | waiting | invite | active | ended
  const [currentDare, setCurrentDare] = useState(null);
  const [timeLeft, setTimeLeft]       = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showPanel, setShowPanel]     = useState(false);
  const timerRef = useRef(null);

  const dareActive = dareState === 'active' || dareState === 'invite';

  const startTimer = useCallback((duration) => {
    clearInterval(timerRef.current);
    setTimeLeft(duration);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); setDareState('ended'); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleDareRequest = () => {
    if (!socket || dareState !== 'idle') return;
    socket.emit('dare_request', { fromUser: userName, sessionId });
    setDareState('waiting');
    setShowPanel(true);
  };

  const handleAccept = (category = null) => {
    socket.emit('dare_accept', { sessionId, preferredCategory: category || selectedCategory });
  };

  const handleDecline = () => {
    socket.emit('dare_decline', { sessionId });
    setDareState('idle');
    setShowPanel(false);
  };

  const handleNext = () => {
    clearInterval(timerRef.current);
    socket.emit('dare_next', { sessionId, preferredCategory: selectedCategory });
  };

  const handleExit = () => {
    clearInterval(timerRef.current);
    socket.emit('dare_exit', { sessionId });
    setDareState('idle');
    setCurrentDare(null);
    setSelectedCategory(null);
    setShowPanel(false);
  };

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const onRequestSent = () => setDareState('waiting');
    const onInvite = () => { setDareState('invite'); setShowPanel(true); };
    const onDeclined = () => { setDareState('idle'); setShowPanel(false); };
    const onStarted = ({ dare }) => { setCurrentDare(dare); setDareState('active'); startTimer(dare.duration); };
    const onNew = ({ dare }) => { setCurrentDare(dare); setDareState('active'); startTimer(dare.duration); };
    const onEnded = () => {
      clearInterval(timerRef.current);
      setDareState('idle'); setCurrentDare(null); setSelectedCategory(null); setShowPanel(false);
    };
    const onError = () => setDareState('idle');

    socket.on('dare_request_sent', onRequestSent);
    socket.on('dare_invite', onInvite);
    socket.on('dare_declined', onDeclined);
    socket.on('dare_started', onStarted);
    socket.on('dare_new', onNew);
    socket.on('dare_ended', onEnded);
    socket.on('dare_error', onError);

    return () => {
      socket.off('dare_request_sent', onRequestSent);
      socket.off('dare_invite', onInvite);
      socket.off('dare_declined', onDeclined);
      socket.off('dare_started', onStarted);
      socket.off('dare_new', onNew);
      socket.off('dare_ended', onEnded);
      socket.off('dare_error', onError);
      clearInterval(timerRef.current);
    };
  }, [socket, startTimer]);

  if (!isCallConnected) return null;

  // ── BUTTON ONLY mode ──
  if (buttonOnly) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
        <button
          onClick={handleDareRequest}
          disabled={dareState !== 'idle'}
          style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: dareActive ? 'rgba(124,58,237,0.2)' : 'var(--bg-tertiary)',
            color: dareActive ? 'var(--accent-primary)' : 'var(--text-primary)',
            fontSize: '22px', cursor: dareState === 'idle' ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: dareActive ? '1px solid rgba(124,58,237,0.3)' : '1px solid var(--border-default)',
            position: 'relative', transition: 'all 0.2s'
          }}
        >
          🎲
          {dareActive && (
            <div style={{
              position: 'absolute', top: '2px', right: '2px',
              width: '10px', height: '10px', borderRadius: '50%',
              background: '#10B981', border: '2px solid var(--bg-primary)'
            }} />
          )}
        </button>
        <span style={{
          color: dareActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
          fontSize: '11px', fontWeight: 500
        }}>
          {dareState === 'waiting' ? 'Wait...' : 'Dare'}
        </span>
      </div>
    );
  }

  // ── PANEL ONLY mode — renders overlay when active ──
  if (panelOnly) {
    if (dareState === 'idle' || !showPanel) return null;
  }

  // No overlay needed for idle/waiting in panelOnly
  if (dareState === 'idle' && !panelOnly) {
    return (
      <button onClick={handleDareRequest} className="call-ctrl">
        <span style={{ fontSize: '20px' }}>🎲</span>
        <span>Dare</span>
      </button>
    );
  }

  if (dareState === 'waiting' && !panelOnly) return null;
  if (dareState === 'idle') return null;
  if (dareState === 'waiting') return null;

  // Overlay styles
  const overlayStyle = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    zIndex: 30,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '24px',
  };

  const callBadge = (
    <div style={{
      position: 'fixed', top: '16px', right: '16px', zIndex: 31,
      background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)',
      borderRadius: '999px', padding: '6px 12px',
      display: 'flex', alignItems: 'center', gap: '6px',
      fontSize: '12px', color: '#22C55E', fontWeight: 600,
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', animation: 'pulse-dot 2s infinite' }} />
      🎙️ Call active
    </div>
  );

  // ── INVITE state — category picker ──
  if (dareState === 'invite') {
    return (
      <div style={overlayStyle}>
        {callBadge}
        <div style={{
          background: 'var(--bg-elevated)', borderRadius: '20px',
          padding: '28px', maxWidth: '380px', width: '100%', textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎲</div>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
            Dare Mode!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
            {partner?.name || partner?.displayName || 'Your match'} wants to play!
          </p>

          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Choose a category
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id || 'random'} onClick={() => setSelectedCategory(cat.id)} style={{
                padding: '10px 6px',
                background: selectedCategory === cat.id ? `${CATEGORY_COLORS[cat.id] || 'var(--accent-primary)'}22` : 'var(--bg-secondary)',
                border: `1.5px solid ${selectedCategory === cat.id ? CATEGORY_COLORS[cat.id] || 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: '20px' }}>{cat.label}</span>
                <span style={{
                  fontSize: '10px', fontWeight: 600,
                  color: selectedCategory === cat.id ? CATEGORY_COLORS[cat.id] || 'var(--accent-primary)' : 'var(--text-muted)',
                }}>{cat.name}</span>
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

  // ── ACTIVE / ENDED state ──
  if (dareState === 'active' || dareState === 'ended') {
    const categoryColor = CATEGORY_COLORS[currentDare?.category] || 'var(--accent-primary)';
    const progress = currentDare ? (timeLeft / currentDare.duration) * 100 : 0;

    return (
      <div style={overlayStyle}>
        {callBadge}
        <div style={{
          background: 'var(--bg-elevated)', borderRadius: '20px',
          padding: '28px', maxWidth: '380px', width: '100%', textAlign: 'center',
        }}>
          {/* Category badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '5px 14px', background: `${categoryColor}22`,
            border: `1px solid ${categoryColor}44`, borderRadius: '999px',
            color: categoryColor, fontSize: '12px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px',
          }}>
            {currentDare?.icon || '🎲'} {currentDare?.category || 'dare'}
          </div>

          {/* Dare text */}
          <p style={{
            color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700,
            lineHeight: 1.5, marginBottom: '8px', minHeight: '70px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{currentDare?.text}</p>

          {/* Hint */}
          {currentDare?.hint && (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', marginBottom: '20px' }}>
              💡 {currentDare.hint}
            </p>
          )}

          {/* Timer */}
          {dareState === 'active' ? (
            <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 20px' }}>
              <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg-secondary)" strokeWidth="6" />
                <circle cx="40" cy="40" r="34" fill="none" stroke={categoryColor} strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
                  strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, fontFamily: 'monospace',
              }}>{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</div>
            </div>
          ) : (
            <div style={{ color: '#F59E0B', fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>⏱ Time's up!</div>
          )}

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
