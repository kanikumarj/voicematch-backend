import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { getSocket }        from '../../socket/socketClient';
import CallScreen           from '../../modules/call/CallScreen';
import { toast }            from '../../components/ui/Toast';
import './MatchScreen.css';

const API = import.meta.env.VITE_API_URL;

// ─── States ───────────────────────────────────────────────────────────────────
//  idle → searching → matched → connected → ended → idle
export default function MatchScreen({ token, user, onLogout }) {
  const location = useLocation();
  
  const [appState, setAppState]     = useState(location.state?.directCallAccepted ? 'connecting' : 'idle');
  const [partner, setPartner]       = useState(null);
  const [isInitiator, setIsInitiator] = useState(location.state?.initiator || false);
  const [reconnecting, setReconnecting] = useState(false);
  const [unverified, setUnverified] = useState(false);

  // ── Socket event handlers ─────────────────────────────────────────────────────
  const handleEndCall = useCallback((reason = 'user_end') => {
    setPartner(null);
    setAppState('idle');
  }, []);

  useEffect(() => {
    const socket = getSocket();

    // FIXED: named handlers passed to .off() so only this component's
    // listeners are removed on cleanup, not all listeners for that event.
    function onSessionRestored({ state }) {
      setReconnecting(false);
      if (state === 'in_call')   setAppState('connected');
      if (state === 'searching') setAppState('searching');
    }
    function onVerificationRequired() {
      setUnverified(true);
      setAppState('idle');
      toast.warning('Please verify your email before joining a call.');
    }
    function onMatchFound({ partnerId, partnerName }) {
      setPartner({ id: partnerId, name: partnerName });
      setAppState('matched');
      toast.info(`Matched with ${partnerName}!`);
    }
    function onBothReady({ initiator }) {
      setIsInitiator(initiator);
      setAppState('connecting');
    }
    function onDirectCallAccepted({ initiator }) {
      setIsInitiator(initiator);
      setAppState('connecting');
      toast.success('Direct call connected!');
    }
    function onPartnerDisconnected() {
      setPartner(null);
      setAppState('idle');
      toast.error('Partner disconnected. Finding a new match…');
    }
    function onPartnerReconnected() { toast.success('Partner reconnected.'); }
    function onQueuePosition() { /* still waiting — state already 'searching' */ }
    function onDisconnect()   { setReconnecting(true);  }
    function onConnect()      { setReconnecting(false); }

    socket.on('session_restored',       onSessionRestored);
    socket.on('verification_required',  onVerificationRequired);
    socket.on('match_found',            onMatchFound);
    socket.on('both_ready',             onBothReady);
    socket.on('direct_call_accepted',   onDirectCallAccepted);
    socket.on('partner_disconnected',   onPartnerDisconnected);
    socket.on('partner_reconnected',    onPartnerReconnected);
    socket.on('queue_position',         onQueuePosition);
    socket.on('disconnect',             onDisconnect);
    socket.on('connect',                onConnect);

    return () => {
      // FIXED: pass handler ref so we only remove THIS component's listener
      socket.off('session_restored',       onSessionRestored);
      socket.off('verification_required',  onVerificationRequired);
      socket.off('match_found',            onMatchFound);
      socket.off('both_ready',             onBothReady);
      socket.off('direct_call_accepted',   onDirectCallAccepted);
      socket.off('partner_disconnected',   onPartnerDisconnected);
      socket.off('partner_reconnected',    onPartnerReconnected);
      socket.off('queue_position',         onQueuePosition);
      socket.off('disconnect',             onDisconnect);
      socket.off('connect',               onConnect);
    };
  }, [handleEndCall]);

  // FIXED: 4C — Searching state timeout fallback so it can never hang forever
  useEffect(() => {
    if (appState !== 'searching') return;
    const timeout = setTimeout(() => {
      setAppState('idle');
      getSocket().emit('leave_pool');
      toast.warning('No match found after 2 minutes. Please try again.');
    }, 120_000); // 2 minutes
    return () => clearTimeout(timeout);
  }, [appState]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  function joinPool() {
    getSocket().emit('join_pool');
    setAppState('searching');
  }

  function leavePool() {
    getSocket().emit('leave_pool');
    setAppState('idle');
  }

  function confirmReady() {
    getSocket().emit('ready_confirm');
  }

  function skipCall() {
    getSocket().emit('skip');
    setPartner(null);
    setAppState('searching');
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (appState === 'connected' || appState === 'connecting') {
    return (
      <>
        {reconnecting && (
          <div className="reconnecting-overlay" role="status">
            ↻ Reconnecting…
          </div>
        )}
        <CallScreen
          socket={getSocket()}
          token={token}
          partnerName={partner?.name}
          partnerId={partner?.id}
          isInitiator={isInitiator}
          onCallEnd={() => handleEndCall('user_end')}
        />
      </>
    );
  }

  return (
    <div className="match-screen">
      {reconnecting && (
        <div className="reconnecting-overlay" role="status">↻ Reconnecting…</div>
      )}

      {/* ── Main card ── */}
      <main className="ms-main">
        {appState === 'idle' && (
          <div className="ms-card fadeIn">
            <div className="ms-icon">🌐</div>
            <h1 className="ms-title">Ready to connect?</h1>
            <p className="ms-subtitle">
              Match with a random stranger for a real-time voice conversation.
            </p>
            {unverified && (
              <div className="ms-verify-banner">
                ⚠️ Verify your email to start calling.{' '}
                <a href="/resend" onClick={async (e) => {
                  e.preventDefault();
                  try {
                    const res = await fetch(`${API}/api/auth/resend-verification`, {
                      method: 'POST', headers: { Authorization: `Bearer ${token}` },
                    });
                    if (!res.ok) throw new Error('Failed to send');
                    toast.success('Verification email sent!');
                  } catch { toast.error('Failed to send. Please try again.'); }
                }}>Resend email</a>
              </div>
            )}
            <button
              id="btn-find-match"
              className="ms-btn"
              onClick={joinPool}
              disabled={unverified}
            >
              Find a Match
            </button>
          </div>
        )}

        {appState === 'searching' && (
          <div className="ms-card fadeIn">
            <div className="ms-icon searching-pulse">🔍</div>
            <h1 className="ms-title">Searching…</h1>
            <p className="ms-subtitle">Looking for someone to connect with.</p>
            <div className="connecting-dots">
              <span /><span /><span />
            </div>
            <button id="btn-cancel-search" className="ms-btn ms-btn-ghost" onClick={leavePool}>
              Cancel
            </button>
          </div>
        )}

        {appState === 'matched' && (
          <div className="ms-card match-found-card">
            <div className="ms-icon">🤝</div>
            <h1 className="ms-title">Match Found!</h1>
            <p className="ms-subtitle">
              Connected with <strong>{partner?.name || 'someone'}</strong>
            </p>
            <button id="btn-ready" className="ms-btn" onClick={confirmReady}>
              Ready to Talk
            </button>
            <button id="btn-decline" className="ms-btn ms-btn-ghost" onClick={skipCall}>
              Skip
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
