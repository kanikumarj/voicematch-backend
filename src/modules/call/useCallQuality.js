import { useState, useEffect, useRef } from 'react';

const POLL_INTERVAL_MS = 4_000;

/**
 * useCallQuality — polls RTCPeerConnection.getStats() every 4 seconds.
 *
 * Returns a quality object the UI can use to show signal strength or warnings.
 *
 * @param {React.MutableRefObject} peerRef — ref to RTCPeerConnection
 * @param {string} callStatus              — only polls when 'connected'
 */
export function useCallQuality(peerRef, callStatus) {
  const [quality, setQuality] = useState({
    packetsLost:      0,
    jitter:           0,         // seconds
    roundTripTime:    null,      // seconds (null if not available)
    audioLevel:       0,         // 0–1 remote audio energy
    connectionState:  'new',
    label:            'unknown', // 'excellent' | 'good' | 'poor' | 'critical'
  });

  const intervalRef = useRef(null);

  useEffect(() => {
    if (callStatus !== 'connected') {
      clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(async () => {
      const peer = peerRef.current;
      if (!peer) return;

      try {
        const stats = await peer.getStats();
        const parsed = parseStats(stats);
        setQuality(parsed);

        // Emit a custom event if quality drops to critical — CallScreen can warn user
        if (parsed.label === 'critical') {
          window.dispatchEvent(new CustomEvent('call:quality_critical', { detail: parsed }));
        }
      } catch {
        // getStats() can throw if peer is closing — safe to ignore
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalRef.current);
  }, [callStatus, peerRef]);

  return quality;
}

// ─── Stats parser ─────────────────────────────────────────────────────────────
function parseStats(stats) {
  let packetsLost    = 0;
  let jitter         = 0;
  let roundTripTime  = null;
  let audioLevel     = 0;

  stats.forEach((report) => {
    // Inbound audio — packet loss and jitter
    if (report.type === 'inbound-rtp' && report.kind === 'audio') {
      packetsLost = report.packetsLost   ?? 0;
      jitter      = report.jitter        ?? 0;
    }

    // Remote inbound — round trip time
    if (report.type === 'remote-inbound-rtp' && report.kind === 'audio') {
      roundTripTime = report.roundTripTime ?? null;
    }

    // Audio source level — local mic energy (proxy for "am I connected")
    if (report.type === 'media-source' && report.kind === 'audio') {
      audioLevel = report.audioLevel ?? 0;
    }
  });

  const label = classifyQuality({ jitter, packetsLost, roundTripTime });

  return { packetsLost, jitter, roundTripTime, audioLevel, label };
}

function classifyQuality({ jitter, packetsLost, roundTripTime }) {
  // Thresholds based on ITU-T G.114 recommendations for VoIP
  if (roundTripTime !== null && roundTripTime > 0.4) return 'critical';  // > 400ms RTT
  if (packetsLost > 50)                                return 'critical';
  if (jitter > 0.05)                                   return 'poor';     // > 50ms jitter
  if (packetsLost > 10)                                return 'poor';
  if (roundTripTime !== null && roundTripTime > 0.15)  return 'good';
  return 'excellent';
}
