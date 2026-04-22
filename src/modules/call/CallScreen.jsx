import { useEffect, useRef, useState } from 'react';
import { useWebRTC } from './useWebRTC';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import BottomSheet from '../../components/ui/BottomSheet';
import useCallTimer from '../../hooks/useCallTimer';
import useOnlineStats from '../../hooks/useOnlineStats';
import api from '../../lib/api';
import './CallScreen.css';

export default function CallScreen({ socket, token, partnerName, isInitiator, partnerId, sessionId, onCallEnd }) {
  const [friendState, setFriendState] = useState('idle');
  const [incomingReq, setIncomingReq] = useState(null);
  
  const [showRating, setShowRating] = useState(false);
  const [callEndedReason, setCallEndedReason] = useState(null);
  const [ratingVal, setRatingVal] = useState(0);

  const {
    callStatus, isMuted, remoteAudioRef,
    startCall, answerCall, handleRemoteIce, handleRemoteAnswer,
    toggleMute, endCall,
  } = useWebRTC(socket, token);

  const { seconds, formatted } = useCallTimer(callStatus === 'connected');
  const onlineStats = useOnlineStats();

  const interceptEnd = (reason) => {
    endCall();
    if (seconds > 10 && partnerId) {
      setCallEndedReason(reason);
      setShowRating(true);
    } else {
      onCallEnd(reason);
    }
  };

  useEffect(() => {
    socket.on('webrtc_offer',         async ({ offer })     => await answerCall(offer));
    socket.on('webrtc_answer',        async ({ answer })    => await handleRemoteAnswer(answer));
    socket.on('webrtc_ice_candidate', async ({ candidate }) => await handleRemoteIce(candidate));
    socket.on('partner_disconnected', ({ reason }) => { interceptEnd(reason); });
    socket.on('call_ended',           () => { interceptEnd('user_ended'); });

    const onReqReceived   = ({ requestId, fromUser }) => setIncomingReq({ requestId, fromUser });
    const onReqSent       = () => setFriendState('sent');
    const onFriendCreated = () => { setFriendState('friends'); setIncomingReq(null); };
    const onReqRejected   = () => setFriendState('idle');

    socket.on('friend_request_received',     onReqReceived);
    socket.on('friend_request_sent_confirm', onReqSent);
    socket.on('friendship_created',          onFriendCreated);
    socket.on('friend_request_rejected',     onReqRejected);
    socket.on('already_friends',             onFriendCreated);

    return () => {
      socket.off('webrtc_offer');
      socket.off('webrtc_answer');
      socket.off('webrtc_ice_candidate');
      socket.off('partner_disconnected');
      socket.off('call_ended');
      socket.off('friend_request_received',     onReqReceived);
      socket.off('friend_request_sent_confirm', onReqSent);
      socket.off('friendship_created',          onFriendCreated);
      socket.off('friend_request_rejected',     onReqRejected);
      socket.off('already_friends',             onFriendCreated);
    };
  }, [socket, answerCall, handleRemoteAnswer, handleRemoteIce, onCallEnd]);

  useEffect(() => { if (isInitiator) startCall(); }, []);

  function handleEnd() { interceptEnd('user_ended'); }

  async function submitRating() {
    if (ratingVal > 0) {
      try {
        await api.post('/api/call/rating', {
          callId: sessionId,
          ratedUserId: partnerId,
          rating: ratingVal
        });
      } catch (err) {
        console.error(err);
      }
    }
    onCallEnd(callEndedReason);
  }

  function sendFriendReq() {
    if (friendState !== 'idle') return;
    socket.emit('send_friend_request', { toUserId: partnerId, sessionId });
  }

  function respondReq(action) {
    if (!incomingReq) return;
    socket.emit('respond_friend_request', { requestId: incomingReq.requestId, action });
    if (action === 'reject') setIncomingReq(null);
  }

  return (
    <div className="call-screen" data-status={callStatus}>
      <audio ref={remoteAudioRef} autoPlay playsInline aria-hidden="true" />

      {/* ── Connecting ── */}
      {callStatus === 'connecting' && (
        <div className="call-state-connecting">
          <div className="call-avatar-ring">
            <Avatar name={partnerName} size="xl" />
            <div className="call-spinner-ring" />
          </div>
          <h2>{partnerName || 'Connecting...'}</h2>
          <p className="call-status-text">Connecting<span className="dots"><span>.</span><span>.</span><span>.</span></span></p>
        </div>
      )}

      {/* ── Connected ── */}
      {callStatus === 'connected' && (
        <div className="call-state-connected">
          {/* Header */}
          <div className="call-header">
            <Avatar name={partnerName} size="lg" status="in_call" />
            <div className="call-header-info">
              <h2 className="call-partner-name">{partnerName}</h2>
              <span className="call-duration-badge">In call • {formatted}</span>
              {onlineStats.voice > 0 && (
                <span className="call-pool-stat">🟢 {onlineStats.voice} in voice pool</span>
              )}
            </div>
          </div>

          {/* Audio visualizer */}
          <div className="call-visualizer">
            {Array.from({ length: 12 }, (_, i) => (
              <div
                key={i}
                className="viz-bar"
                style={{ animationDelay: `${i * 0.08}s`, animationDuration: `${0.6 + (i % 3) * 0.2}s` }}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="call-controls">
            <button
              className={`call-ctrl ${isMuted ? 'ctrl-active' : ''}`}
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              aria-pressed={isMuted}
            >
              {isMuted
                ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              }
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button
              className={`call-ctrl ctrl-friend ${friendState !== 'idle' ? 'ctrl-sent' : ''}`}
              onClick={sendFriendReq}
              disabled={friendState !== 'idle'}
              aria-label="Add friend"
            >
              {friendState === 'friends'
                ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              }
              <span>{friendState === 'idle' ? 'Add Friend' : friendState === 'sent' ? 'Sent ✓' : 'Friends ✓'}</span>
            </button>

            <button className="call-ctrl ctrl-end" onClick={handleEnd} aria-label="End call">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.24h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 5.95 5.95l.87-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
              <span>End</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Ended ── */}
      {(callStatus === 'ended' || showRating) && (
        <div className="call-state-ended" style={{ background: 'var(--bg)', position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {showRating ? (
            <div style={{ background: 'var(--surface)', padding: 32, borderRadius: 16, width: '100%', maxWidth: 400, textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
              <h2>Rate your call</h2>
              <p style={{ margin: '8px 0 24px', color: 'var(--text-muted)' }}>How was your conversation with {partnerName}?</p>
              
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 32 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRatingVal(star)}
                    style={{ background: 'none', border: 'none', fontSize: 40, cursor: 'pointer', transition: 'transform 0.2s', transform: ratingVal === star ? 'scale(1.2)' : 'scale(1)', filter: star <= ratingVal ? 'none' : 'grayscale(100%) opacity(0.3)' }}
                  >
                    ⭐
                  </button>
                ))}
              </div>
              
              <div style={{ display: 'flex', gap: 12 }}>
                <Button variant="ghost" style={{ flex: 1 }} onClick={() => onCallEnd(callEndedReason)}>Skip</Button>
                <Button style={{ flex: 2 }} disabled={!ratingVal} onClick={submitRating}>Submit</Button>
              </div>
            </div>
          ) : (
            <>
              <span className="call-ended-icon">📵</span>
              <h2>Call ended</h2>
              <p>Finding your next match…</p>
            </>
          )}
        </div>
      )}

      {/* ── Incoming Friend Request (BottomSheet) ── */}
      <BottomSheet open={!!incomingReq} onClose={() => setIncomingReq(null)} title="Friend Request">
        {incomingReq && (
          <div className="friend-req-sheet">
            <Avatar name={incomingReq.fromUser.displayName} size="lg" />
            <p><strong>{incomingReq.fromUser.displayName}</strong> wants to be friends 👋</p>
            <div className="friend-req-btns">
              <Button variant="ghost" onClick={() => respondReq('reject')}>Decline</Button>
              <Button fullWidth onClick={() => respondReq('accept')}>Accept</Button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
