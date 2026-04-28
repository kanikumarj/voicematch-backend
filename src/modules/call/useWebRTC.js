// FIX: [Area 2] useWebRTC — comprehensive cleanup on ALL exit paths

import { useRef, useState, useCallback, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL;

/**
 * useWebRTC — manages the full RTCPeerConnection lifecycle.
 *
 * @param {object} socket — active Socket.IO socket instance
 * @param {string} token  — JWT for TURN credential fetch
 */
export function useWebRTC(socket, token) {
  const [callStatus, setCallStatus]   = useState('idle');   // idle | connecting | connected | ended
  const [isMuted, setIsMuted]         = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);

  const peerRef        = useRef(null);  // RTCPeerConnection
  const localStreamRef = useRef(null);  // MediaStream (mic)
  const remoteAudioRef = useRef(null);  // <audio> element ref — pass from component
  const iceQueueRef    = useRef([]);    // ICE candidates buffered before remote desc set
  const isRemoteSetRef = useRef(false); // tracks if remote description has been set

  // ── Fetch TURN credentials ──────────────────────────────────────────────────
  async function fetchIceServers() {
    try {
      const res = await fetch(`${API_BASE}/api/call/turn-credentials`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch TURN credentials');
      const { iceServers } = await res.json();
      return iceServers;
    } catch (err) {
      console.error('[WebRTC] TURN fetch error:', err.message);
      // FIX: [Area 2] Fallback to STUN-only if TURN fails
      return [{ urls: 'stun:stun.l.google.com:19302' }];
    }
  }

  // FIX: [Area 2] Comprehensive cleanup — close peer and release all tracks
  const closePeer = useCallback((reason = 'unknown') => {
    console.log('[WEBRTC] Cleanup triggered:', reason);

    // 1. Stop all local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('[WEBRTC] Track stopped:', track.kind);
      });
      localStreamRef.current = null;
    }

    // 2. Remove remote audio
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      try { remoteAudioRef.current.pause(); } catch { /* may already be paused */ }
    }

    // 3. Close peer connection
    if (peerRef.current) {
      // Remove all listeners first
      peerRef.current.ontrack = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.oniceconnectionstatechange = null;
      try { peerRef.current.close(); } catch { /* may already be closed */ }
      peerRef.current = null;
      console.log('[WEBRTC] Peer connection closed');
    }

    iceQueueRef.current    = [];
    isRemoteSetRef.current = false;
    setRemoteStream(null);
    setIsMuted(false);
  }, []);

  // ── Create RTCPeerConnection ────────────────────────────────────────────────
  async function createPeer() {
    // Guard: close any dangling peer from previous session
    closePeer('new_peer_guard');

    const iceServers = await fetchIceServers();
    const peer = new RTCPeerConnection({ iceServers });
    peerRef.current = peer;

    peer.onicecandidate = ({ candidate }) => {
      // null candidate = end-of-candidates, still emit (server will drop silently)
      socket.emit('webrtc_ice_candidate', { candidate });
    };

    peer.ontrack = ({ streams }) => {
      const stream = streams[0];
      setRemoteStream(stream);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
      setCallStatus('connected');
    };

    // FIX: [Area 2] Connection state monitoring — catch ALL failure states
    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      console.log('[WEBRTC] Connection state:', state);

      if (state === 'connected') {
        setCallStatus('connected');
      }

      if (state === 'failed' || state === 'closed') {
        console.warn('[WEBRTC] Connection failed/closed:', state);
        socket.emit('call_end', { reason: 'connection_' + state });
        closePeer('connection_state_' + state);
        setCallStatus('ended');
      }
    };

    // FIX: [Area 2] ICE connection monitoring with reconnection grace period
    peer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState;
      console.log('[WEBRTC] ICE state:', state);

      if (state === 'disconnected') {
        // Give 5 seconds for reconnection before cleanup
        setTimeout(() => {
          if (peerRef.current?.iceConnectionState === 'disconnected') {
            console.warn('[WEBRTC] ICE disconnected timeout');
            socket.emit('call_end', { reason: 'ice_disconnected' });
            closePeer('ice_disconnected');
            setCallStatus('ended');
          }
        }, 5000);
      }

      if (state === 'failed') {
        console.warn('[WEBRTC] ICE failed');
        socket.emit('call_end', { reason: 'ice_failed' });
        closePeer('ice_failed');
        setCallStatus('ended');
      }
    };

    return peer;
  }

  // ── Get microphone ──────────────────────────────────────────────────────────
  async function getMic() {
    let stream;
    try {
      // FIXED: Use optimal WebRTC audio constraints
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
    } catch (err) {
      setCallStatus('ended');
      // FIXED: Better error handling for mic permissions
      if (err.name === 'NotAllowedError') {
        throw new Error('Microphone permission required');
      }
      if (err.name === 'NotFoundError') {
        throw new Error('No microphone found');
      }
      throw new Error(`Microphone error: ${err.message}`);
    }
    localStreamRef.current = stream;
    return stream;
  }

  // ── Flush buffered ICE candidates ───────────────────────────────────────────
  async function flushIceQueue() {
    const peer = peerRef.current;
    if (!peer || !isRemoteSetRef.current) return;
    while (iceQueueRef.current.length > 0) {
      const candidate = iceQueueRef.current.shift();
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Stale candidate — safe to discard
      }
    }
  }

  // ── startCall (initiator path) ──────────────────────────────────────────────
  const startCall = useCallback(async () => {
    setCallStatus('connecting');
    try {
      const peer   = await createPeer();
      const stream = await getMic();
      stream.getTracks().forEach(t => peer.addTrack(t, stream));

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('webrtc_offer', { offer });
    } catch (err) {
      console.error(`[WebRTC] startCall error: ${err.message}`);
      closePeer('start_call_error');
      setCallStatus('ended');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // ── answerCall (receiver path) ──────────────────────────────────────────────
  const answerCall = useCallback(async (offer) => {
    setCallStatus('connecting');
    try {
      const peer   = await createPeer();
      const stream = await getMic();
      stream.getTracks().forEach(t => peer.addTrack(t, stream));

      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      isRemoteSetRef.current = true;
      await flushIceQueue();

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('webrtc_answer', { answer });
    } catch (err) {
      console.error(`[WebRTC] answerCall error: ${err.message}`);
      closePeer('answer_call_error');
      setCallStatus('ended');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // ── Incoming ICE candidate ──────────────────────────────────────────────────
  const handleRemoteIce = useCallback(async (candidate) => {
    if (!candidate) return;
    if (!isRemoteSetRef.current) {
      // Buffer until remote description is set
      iceQueueRef.current.push(candidate);
      return;
    }
    try {
      await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Discard stale candidate
    }
  }, []);

  // ── Incoming answer ─────────────────────────────────────────────────────────
  const handleRemoteAnswer = useCallback(async (answer) => {
    try {
      await peerRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
      isRemoteSetRef.current = true;
      await flushIceQueue();
    } catch (err) {
      console.error(`[WebRTC] setRemoteDescription error: ${err.message}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Toggle mute ─────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(t => {
      t.enabled = !t.enabled;
    });
    setIsMuted(prev => !prev);
  }, []);

  // ── End call (user-initiated) ───────────────────────────────────────────────
  const endCall = useCallback(() => {
    socket.emit('call_end', { reason: 'user_ended' });
    closePeer('user_ended');
    setCallStatus('ended');
  }, [socket, closePeer]);

  // FIX: [Area 2] Cleanup on component unmount
  useEffect(() => {
    return () => {
      console.log('[WEBRTC] Component unmount cleanup');
      closePeer('unmount');
    };
  }, [closePeer]);

  return {
    callStatus,
    isMuted,
    remoteStream,
    remoteAudioRef,
    startCall,
    answerCall,
    handleRemoteIce,
    handleRemoteAnswer,
    toggleMute,
    endCall,
    closePeer,  // FIX: [Area 2] Expose closePeer for external cleanup
  };
}
