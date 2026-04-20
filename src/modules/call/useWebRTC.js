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
    const res = await fetch(`${API_BASE}/api/call/turn-credentials`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch TURN credentials');
    const { iceServers } = await res.json();
    return iceServers;
  }

  // ── Cleanup — close peer and release all tracks ─────────────────────────────
  const closePeer = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.onicecandidate       = null;
      peerRef.current.ontrack              = null;
      peerRef.current.oniceconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    iceQueueRef.current    = [];
    isRemoteSetRef.current = false;
    setRemoteStream(null);
  }, []);

  // ── Create RTCPeerConnection ────────────────────────────────────────────────
  async function createPeer() {
    // Guard: close any dangling peer from previous session
    closePeer();

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

    peer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState;
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        socket.emit('call_end', { reason: 'user_ended' });
        closePeer();
        setCallStatus('ended');
      }
    };

    return peer;
  }

  // ── Get microphone ──────────────────────────────────────────────────────────
  async function getMic() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      // Permission denied or hardware error
      setCallStatus('ended');
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
    closePeer();
    setCallStatus('ended');
  }, [socket, closePeer]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => { closePeer(); };
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
  };
}
