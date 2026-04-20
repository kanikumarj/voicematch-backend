import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSocket } from '../lib/socket';
import { toast } from './ui/Toast';
import IncomingCallModal from './friends/IncomingCallModal';
import { useAuth } from '../context/AuthContext';

export default function GlobalCallManager({ children }) {
  const [incomingCall, setIncomingCall] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    let socket;
    try {
      socket = getSocket();
    } catch (e) {
      return;
    }
    
    if (!socket) return;

    const onIncoming = ({ fromUser, callId }) => {
      setIncomingCall({ fromUser, callId });
      // Play ringtone here if you want
    };

    const onMissed = ({ callId }) => {
      setIncomingCall(prev => prev?.callId === callId ? null : prev);
    };

    const onAccepted = ({ callId, initiator }) => {
      setIncomingCall(null);
      // Redirect to dashboard where the call screen will pick up the connected state
      // Actually, we need to pass a flag so Dashboard knows to render CallScreen directly
      // However, the socket will also restore state if we are 'in_call' on the backend.
      if (location.pathname !== '/dashboard') {
        navigate('/dashboard', { state: { directCallAccepted: true, initiator } });
      }
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

    socket.on('incoming_direct_call', onIncoming);
    socket.on('direct_call_missed', onMissed);
    socket.on('direct_call_accepted', onAccepted);
    socket.on('direct_call_rejected', onRejected);
    socket.on('friend_busy', onBusy);
    socket.on('friend_offline', onOffline);

    return () => {
      socket.off('incoming_direct_call', onIncoming);
      socket.off('direct_call_missed', onMissed);
      socket.off('direct_call_accepted', onAccepted);
      socket.off('direct_call_rejected', onRejected);
      socket.off('friend_busy', onBusy);
      socket.off('friend_offline', onOffline);
    };
  }, [navigate, location]);

  function acceptCall() {
    if (!incomingCall) return;
    getSocket().emit('direct_call_response', { callId: incomingCall.callId, action: 'accept' });
  }

  function rejectCall() {
    if (!incomingCall) return;
    getSocket().emit('direct_call_response', { callId: incomingCall.callId, action: 'reject' });
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
