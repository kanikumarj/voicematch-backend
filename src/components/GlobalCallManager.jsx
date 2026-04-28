// FIX: [Area 6] GlobalCallManager — enhanced direct call handling with proper routing

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSocket } from '../lib/socket';
import { useToast } from './ui/Toast';
import IncomingCallModal from './friends/IncomingCallModal';
import { useAuth } from '../context/AuthContext';

export default function GlobalCallManager({ children }) {
  const [incomingCall, setIncomingCall] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (!token) return;

    let socket;
    try {
      socket = getSocket();
    } catch (e) {
      return;
    }
    
    if (!socket) return;

    // FIX: [Area 6] Incoming call with caller info
    const onIncoming = ({ fromUser, callId }) => {
      setIncomingCall({ fromUser, callId });
    };

    const onMissed = ({ callId }) => {
      setIncomingCall(prev => prev?.callId === callId ? null : prev);
    };

    // FIX: [Area 6] Direct call accepted — route to dashboard with call state
    const onAccepted = ({ callId, initiator, sessionId, partnerName, partnerId }) => {
      setIncomingCall(null);
      
      // Navigate to dashboard with direct call state
      if (location.pathname !== '/dashboard') {
        navigate('/dashboard', { 
          state: { 
            directCallAccepted: true, 
            initiator,
            sessionId,
            partnerName,
            partnerId
          } 
        });
      } else {
        // Already on dashboard — emit custom event so Dashboard can handle it
        window.dispatchEvent(new CustomEvent('direct_call_connected', {
          detail: { initiator, sessionId, partnerName, partnerId }
        }));
      }
    };

    // FIX: [Area 6] Cancelled (caller hung up before answer)
    const onCancelled = ({ callId }) => {
      setIncomingCall(prev => prev?.callId === callId ? null : prev);
      toast.info('Call was cancelled');
    };

    const onRejected = () => {
      toast.info('Call was declined.');
    };

    const onBusy = () => {
      toast.info('Friend is currently in another call.');
    };

    const onOffline = () => {
      toast.info('Friend is offline.');
    };

    const onRinging = ({ callId }) => {
      // Caller confirmation — call is ringing
    };

    const onError = ({ message }) => {
      toast.error(message || 'Call failed');
    };

    socket.on('incoming_direct_call', onIncoming);
    socket.on('direct_call_missed', onMissed);
    socket.on('direct_call_accepted', onAccepted);
    socket.on('direct_call_cancelled', onCancelled);
    socket.on('direct_call_rejected', onRejected);
    socket.on('friend_busy', onBusy);
    socket.on('friend_offline', onOffline);
    socket.on('direct_call_ringing', onRinging);
    socket.on('direct_call_error', onError);

    return () => {
      socket.off('incoming_direct_call', onIncoming);
      socket.off('direct_call_missed', onMissed);
      socket.off('direct_call_accepted', onAccepted);
      socket.off('direct_call_cancelled', onCancelled);
      socket.off('direct_call_rejected', onRejected);
      socket.off('friend_busy', onBusy);
      socket.off('friend_offline', onOffline);
      socket.off('direct_call_ringing', onRinging);
      socket.off('direct_call_error', onError);
    };
  }, [navigate, location, token, toast]);

  function acceptCall() {
    if (!incomingCall) return;
    try {
      getSocket().emit('direct_call_response', { callId: incomingCall.callId, action: 'accept' });
    } catch (err) {
      toast.error('Failed to accept call');
      setIncomingCall(null);
    }
  }

  function rejectCall() {
    if (!incomingCall) return;
    try {
      getSocket().emit('direct_call_response', { callId: incomingCall.callId, action: 'reject' });
    } catch (err) {
      // Best effort
    }
    setIncomingCall(null);
  }

  return (
    <>
      {children}
      <IncomingCallModal 
        call={incomingCall} 
        onAccept={acceptCall} 
        onReject={rejectCall} 
      />
    </>
  );
}
