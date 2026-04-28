// FIX: CallScreen — WhatsApp-style layout
// Report: top-right, Primary row: Mute + End + More, Secondary row: Dare + Music + Add

import { useEffect, useState } from 'react';
import { useWebRTC } from './useWebRTC';
import useCallTimer from '../../hooks/useCallTimer';
import useOnlineStats from '../../hooks/useOnlineStats';
import { useAuth } from '../../context/AuthContext';
import InCallReport from './InCallReport';
import DareMode from './DareMode';
import MusicSync from './MusicSync';
import FriendRequestButton from '../friends/FriendRequestButton';
import api from '../../lib/api';
import './CallScreen.css';

export default function CallScreen({ socket, token, partnerName, isInitiator, partnerId, sessionId, onCallEnd }) {
  const { user } = useAuth();
  const [localCallStatus, setLocalCallStatus] = useState(null);
  const [hasReported, setHasReported] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [callEndedReason, setCallEndedReason] = useState(null);
  const [ratingVal, setRatingVal] = useState(0);

  const {
    callStatus, isMuted, remoteAudioRef,
    startCall, answerCall, handleRemoteIce, handleRemoteAnswer,
    toggleMute, endCall, closePeer,
  } = useWebRTC(socket, token);

  const { seconds, formatted } = useCallTimer(callStatus === 'connected');
  const onlineStats = useOnlineStats();

  const partnerDisplay = partnerName || 'Anonymous';

  const interceptEnd = (reason) => {
    endCall();
    if (seconds > 10 && partnerId) {
      setCallEndedReason(reason);
      setShowRating(true);
    } else {
      onCallEnd(reason);
    }
  };

  // Handle partner disconnect
  useEffect(() => {
    if (!socket) return;

    const handlePartnerDisconnected = ({ reason }) => {
      closePeer('partner_disconnected');
      setLocalCallStatus('partner_left');
      setTimeout(() => onCallEnd(reason || 'partner_left'), 3000);
    };

    const handleForceEnd = ({ reason }) => {
      closePeer('force_end');
      onCallEnd(reason || 'force_ended');
    };

    socket.on('partner_disconnected', handlePartnerDisconnected);
    socket.on('call_force_ended', handleForceEnd);

    return () => {
      socket.off('partner_disconnected', handlePartnerDisconnected);
      socket.off('call_force_ended', handleForceEnd);
    };
  }, [socket, closePeer, onCallEnd]);

  // WebRTC signaling events
  useEffect(() => {
    if (!socket) return;

    const onOffer  = async ({ offer })     => await answerCall(offer);
    const onAnswer = async ({ answer })    => await handleRemoteAnswer(answer);
    const onIce    = async ({ candidate }) => await handleRemoteIce(candidate);
    const onEnded  = ()                    => interceptEnd('partner_ended');

    socket.on('webrtc_offer', onOffer);
    socket.on('webrtc_answer', onAnswer);
    socket.on('webrtc_ice_candidate', onIce);
    socket.on('call_ended', onEnded);

    return () => {
      socket.off('webrtc_offer', onOffer);
      socket.off('webrtc_answer', onAnswer);
      socket.off('webrtc_ice_candidate', onIce);
      socket.off('call_ended', onEnded);
    };
  }, [socket, answerCall, handleRemoteAnswer, handleRemoteIce]);

  // Start call if initiator
  useEffect(() => { if (isInitiator) startCall(); }, []);

  const handleEnd = () => interceptEnd('user_ended');

  async function submitRating() {
    if (ratingVal > 0) {
      try {
        await api.post('/api/call/rating', {
          callId: sessionId, ratedUserId: partnerId, rating: ratingVal
        });
      } catch {}
    }
    onCallEnd(callEndedReason);
  }

  // ── Partner left ──
  if (localCallStatus === 'partner_left') {
    return (
      <div className="call-screen" style={{ justifyContent: 'center', gap: '16px' }}>
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
        <div style={{ fontSize: '56px' }}>👋</div>
        <h2 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700 }}>
          Partner disconnected
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Finding your next match...
        </p>
        <div style={{
          width: '36px', height: '36px',
          border: '3px solid var(--accent-primary)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin-ring 0.8s linear infinite'
        }} />
      </div>
    );
  }

  // ── Connecting ──
  if (callStatus === 'connecting') {
    return (
      <div className="call-screen" style={{ justifyContent: 'center', gap: '20px' }}>
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
        <div style={{
          width: '96px', height: '96px', borderRadius: '50%',
          background: 'var(--accent-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: '36px',
          animation: 'pulse-ring 2s infinite',
          boxShadow: '0 0 0 16px rgba(124,58,237,0.15)'
        }}>
          {partnerDisplay[0].toUpperCase()}
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: 700, margin: 0 }}>
            {partnerDisplay}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>
            ⏳ Connecting call...
          </p>
        </div>
      </div>
    );
  }

  // ── Rating overlay ──
  if (callStatus === 'ended' && showRating) {
    return (
      <div className="call-screen" style={{ justifyContent: 'center', padding: '24px' }}>
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
        <div style={{
          background: 'var(--bg-elevated)', padding: '32px', borderRadius: '16px',
          width: '100%', maxWidth: '400px', textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}>
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 8px' }}>Rate your call</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            How was your conversation with {partnerDisplay}?
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '32px' }}>
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onClick={() => setRatingVal(s)} style={{
                background: 'none', border: 'none', fontSize: '40px', cursor: 'pointer',
                transform: ratingVal === s ? 'scale(1.2)' : 'scale(1)',
                filter: s <= ratingVal ? 'none' : 'grayscale(100%) opacity(0.3)',
                transition: 'all 0.15s'
              }}>⭐</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => onCallEnd(callEndedReason)} style={{
              flex: 1, padding: '12px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '15px'
            }}>Skip</button>
            <button onClick={submitRating} disabled={!ratingVal} style={{
              flex: 2, padding: '12px', background: ratingVal ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              border: 'none', borderRadius: 'var(--radius-md)',
              color: ratingVal ? '#fff' : 'var(--text-muted)', cursor: ratingVal ? 'pointer' : 'default',
              fontSize: '15px', fontWeight: 600
            }}>Submit</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Ended (no rating) ──
  if (callStatus === 'ended') {
    return (
      <div className="call-screen" style={{ justifyContent: 'center', gap: '16px' }}>
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
        <span style={{ fontSize: '64px' }}>📵</span>
        <h2 style={{ color: 'var(--text-primary)' }}>Call ended</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Finding your next match…</p>
      </div>
    );
  }

  const isConnected = callStatus === 'connected';

  // ── Connected layout ──
  return (
    <div className="call-screen" data-status={callStatus}>
      {/* Hidden audio — ALWAYS rendered, never covered */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* ════ TOP BAR — Back + Report ════ */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        zIndex: 20
      }}>
        {/* Back */}
        <button onClick={handleEnd} style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'rgba(0,0,0,0.12)', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-primary)', fontSize: '20px'
        }}>‹</button>

        {/* Report — top right, red pill */}
        {!hasReported ? (
          <InCallReport
            partner={{ id: partnerId, name: partnerDisplay }}
            sessionId={sessionId}
            onReported={() => setHasReported(true)}
          />
        ) : (
          <div style={{
            padding: '8px 14px', borderRadius: '20px',
            background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.3)',
            color: '#10B981', fontSize: '13px', fontWeight: 600
          }}>✅ Reported</div>
        )}
      </div>

      {/* ════ PARTNER CENTER SECTION ════ */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingTop: '80px', paddingBottom: '220px', gap: '12px'
      }}>
        {/* Avatar */}
        <div style={{
          width: '96px', height: '96px', borderRadius: '50%',
          background: isConnected ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: '38px',
          boxShadow: isConnected
            ? '0 0 0 12px rgba(124,58,237,0.15), 0 0 0 24px rgba(124,58,237,0.07)'
            : 'none',
          transition: 'all 0.4s'
        }}>
          {partnerDisplay[0].toUpperCase()}
        </div>

        {/* Name */}
        <h1 style={{
          color: 'var(--text-primary)', fontSize: '26px', fontWeight: 700,
          margin: 0, letterSpacing: '-0.3px'
        }}>{partnerDisplay}</h1>

        {/* Duration */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          color: isConnected ? '#EF4444' : 'var(--text-muted)',
          fontSize: '15px', fontWeight: 600
        }}>
          {isConnected && (
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#EF4444', animation: 'pulse-dot 1s infinite'
            }} />
          )}
          {isConnected ? formatted : 'Connecting...'}
        </div>

        {/* Pool stat */}
        {isConnected && onlineStats.voice > 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            🟢 {onlineStats.voice} in voice pool
          </span>
        )}

        {/* Waveform */}
        {isConnected && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            height: '48px', marginTop: '16px'
          }}>
            {[...Array(12)].map((_, i) => (
              <div key={i} className="viz-bar" style={{
                animationDelay: `${i * 0.07}s`,
                animationDuration: `${0.6 + (i % 3) * 0.2}s`
              }} />
            ))}
          </div>
        )}
      </div>

      {/* ════ BOTTOM CONTROLS — fixed ════ */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '20px 24px',
        paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
        background: 'linear-gradient(to top, var(--bg-primary) 80%, transparent)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
        zIndex: 10
      }}>

        {/* ── SECONDARY ROW: Dare + Music + Add Friend ── */}
        {isConnected && (
          <div style={{
            display: 'flex', gap: '28px',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <DareMode
              socket={socket}
              partner={{ id: partnerId, name: partnerDisplay, displayName: partnerDisplay }}
              sessionId={sessionId}
              userName={user?.displayName || user?.display_name}
              isCallConnected={isConnected}
              buttonOnly
            />
            <MusicSync
              socket={socket}
              isCallConnected={isConnected}
              callAudioRef={remoteAudioRef}
              mode="call"
              buttonOnly
            />
            <FriendRequestButton
              partner={{ id: partnerId, name: partnerDisplay }}
              sessionId={sessionId}
              buttonOnly
            />
          </div>
        )}

        {/* ── PRIMARY ROW: Mute + End + More ── */}
        <div style={{
          display: 'flex', gap: '24px',
          alignItems: 'center', justifyContent: 'center'
        }}>
          {/* Mute */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
            <button onClick={toggleMute} style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: isMuted ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.12)',
              color: isMuted ? '#EF4444' : 'var(--text-primary)',
              fontSize: '24px', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              border: isMuted ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border-subtle)',
              transition: 'all 0.2s'
            }}>
              {isMuted ? '🔇' : '🎤'}
            </button>
            <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 500 }}>
              {isMuted ? 'Unmute' : 'Mute'}
            </span>
          </div>

          {/* End Call — large */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
            <button onClick={handleEnd} style={{
              width: '72px', height: '72px', borderRadius: '50%', border: 'none',
              background: '#DC2626', color: '#fff', fontSize: '26px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 24px rgba(220,38,38,0.45)',
              transition: 'transform 0.15s'
            }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >📵</button>
            <span style={{ color: '#DC2626', fontSize: '11px', fontWeight: 600 }}>End</span>
          </div>

          {/* More (placeholder for future) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
            <button style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              color: 'var(--text-primary)', fontSize: '22px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)', border: '1px solid var(--border-subtle)'
            }}>⋯</button>
            <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 500 }}>More</span>
          </div>
        </div>
      </div>

      {/* DareMode overlay (renders when dare is active) */}
      {isConnected && (
        <DareMode
          socket={socket}
          partner={{ id: partnerId, name: partnerDisplay, displayName: partnerDisplay }}
          sessionId={sessionId}
          userName={user?.displayName || user?.display_name}
          isCallConnected={isConnected}
          panelOnly
        />
      )}

      {/* MusicSync panel (renders when open) */}
      {isConnected && (
        <MusicSync
          socket={socket}
          isCallConnected={isConnected}
          callAudioRef={remoteAudioRef}
          mode="call"
          panelOnly
        />
      )}
    </div>
  );
}
