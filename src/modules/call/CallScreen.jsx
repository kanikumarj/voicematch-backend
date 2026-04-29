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
  const [musicOpen, setMusicOpen] = useState(false); // shared across button + panel


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
      <div className="call-screen call-screen--partner-left">
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
        <div className="call-status-icon">👋</div>
        <h2 className="call-status-title">Partner disconnected</h2>
        <p className="call-status-subtitle">Finding your next match...</p>
        <div className="call-spinner" />
      </div>
    );
  }

  // ── Connecting ──
  if (callStatus === 'connecting') {
    return (
      <div className="call-screen call-screen--connecting">
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
        <div className="call-avatar call-avatar--pulsing">
          {partnerDisplay[0].toUpperCase()}
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 className="call-partner-name">{partnerDisplay}</h2>
          <p className="call-status-subtitle">⏳ Connecting call...</p>
        </div>
      </div>
    );
  }

  // ── Rating overlay ──
  if (callStatus === 'ended' && showRating) {
    return (
      <div className="call-screen call-screen--centered">
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
        <div className="call-rating-card">
          <h2 className="call-rating-title">Rate your call</h2>
          <p className="call-rating-subtitle">
            How was your conversation with {partnerDisplay}?
          </p>
          <div className="call-rating-stars">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onClick={() => setRatingVal(s)} className="call-star-btn" style={{
                transform: ratingVal === s ? 'scale(1.2)' : 'scale(1)',
                filter: s <= ratingVal ? 'none' : 'grayscale(100%) opacity(0.3)',
              }}>⭐</button>
            ))}
          </div>
          <div className="call-rating-actions">
            <button onClick={() => onCallEnd(callEndedReason)} className="call-btn-secondary">Skip</button>
            <button onClick={submitRating} disabled={!ratingVal} className="call-btn-primary">Submit</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Ended (no rating) ──
  if (callStatus === 'ended') {
    return (
      <div className="call-screen call-screen--centered">
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
        <div className="call-status-icon">📵</div>
        <h2 className="call-status-title">Call ended</h2>
        <p className="call-status-subtitle">Finding your next match…</p>
      </div>
    );
  }

  const isConnected = callStatus === 'connected';

  // ── Connected layout ──
  return (
    <div className="call-screen" data-status={callStatus}>
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* ════ TOP BAR — Back + Report ════ */}
      <div className="call-topbar">
        <button onClick={handleEnd} className="call-topbar-btn" aria-label="Back">
          ‹
        </button>

        {!hasReported ? (
          <InCallReport
            partner={{ id: partnerId, name: partnerDisplay }}
            sessionId={sessionId}
            onReported={() => setHasReported(true)}
          />
        ) : (
          <div className="call-reported-badge">✅ Reported</div>
        )}
      </div>

      {/* ════ PARTNER CENTER ════ */}
      <div className="call-center">
        <div className={`call-avatar ${isConnected ? 'call-avatar--connected' : ''}`}>
          {partnerDisplay[0].toUpperCase()}
        </div>

        <h1 className="call-partner-name">{partnerDisplay}</h1>

        <div className={`call-timer ${isConnected ? 'call-timer--live' : ''}`}>
          {isConnected && <div className="call-timer-dot" />}
          {isConnected ? formatted : 'Connecting...'}
        </div>

        {isConnected && onlineStats.voice > 0 && (
          <span className="call-pool-stat">🟢 {onlineStats.voice} in voice pool</span>
        )}

        {isConnected && (
          <div className="call-waveform">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="viz-bar" style={{
                animationDelay: `${i * 0.06}s`,
                animationDuration: `${0.5 + (i % 4) * 0.15}s`
              }} />
            ))}
          </div>
        )}
      </div>

      {/* ════ BOTTOM CONTROLS ════ */}
      <div className="call-controls">

        {/* ── SECONDARY ROW: Dare + Music + Add Friend ── */}
        {isConnected && (
          <div className="call-controls-secondary">
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
              isOpen={musicOpen}
              onOpenChange={setMusicOpen}
            />
            <FriendRequestButton
              partner={{ id: partnerId, name: partnerDisplay }}
              sessionId={sessionId}
              buttonOnly
            />
          </div>
        )}

        {/* ── PRIMARY ROW: Mute + End + More ── */}
        <div className="call-controls-primary">
          {/* Mute */}
          <div className="call-ctrl-group">
            <button onClick={toggleMute} className={`call-ctrl-btn ${isMuted ? 'call-ctrl-btn--danger' : ''}`}>
              {isMuted ? '🔇' : '🎤'}
            </button>
            <span className="call-ctrl-label">{isMuted ? 'Unmute' : 'Mute'}</span>
          </div>

          {/* End Call — large red */}
          <div className="call-ctrl-group">
            <button onClick={handleEnd} className="call-ctrl-btn call-ctrl-btn--end">
              📵
            </button>
            <span className="call-ctrl-label call-ctrl-label--end">End</span>
          </div>

          {/* More */}
          <div className="call-ctrl-group">
            <button className="call-ctrl-btn">⋯</button>
            <span className="call-ctrl-label">More</span>
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
          isOpen={musicOpen}
          onOpenChange={setMusicOpen}
        />
      )}
    </div>
  );
}
