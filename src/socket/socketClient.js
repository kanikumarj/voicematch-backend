import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

let socket = null;

/**
 * Create and return the Socket.IO client singleton.
 * Call once from your app root after the user has a valid JWT.
 *
 * @param {string} token — JWT access token
 * @returns {Socket}
 */
export function createSocket(token) {
  if (socket) {
    // Destroy previous socket before creating new one (e.g. re-login)
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth:                { token },
    transports:          ['websocket'],   // Skip polling — lower latency
    reconnection:        true,
    reconnectionAttempts: 10,
    reconnectionDelay:   1_000,
    reconnectionDelayMax: 10_000,
    randomizationFactor: 0.5,
    timeout:             20_000,
  });

  // ── Lifecycle logging ───────────────────────────────────────────────────────
  socket.on('connect', () => {
    // Auto-attempt state restore on every (re)connect
    socket.emit('reconnect_restore');
  });

  socket.on('connect_error', (err) => {
    // AUTH_EXPIRED: token expired — app must redirect to login
    if (err.message?.startsWith('AUTH_EXPIRED')) {
      destroySocket();
      window.dispatchEvent(new CustomEvent('socket:auth_expired'));
    }
  });

  socket.on('disconnect', (reason) => {
    // 'io server disconnect' = server explicitly closed — do NOT auto-reconnect
    if (reason === 'io server disconnect') {
      socket.connect();  // Manual reconnect needed; socket.io won't auto-retry
    }
    // All other reasons: socket.io handles auto-reconnect via reconnection options
  });

  return socket;
}

/**
 * Get the existing socket instance.
 * Throws if createSocket() has not been called.
 */
export function getSocket() {
  if (!socket) throw new Error('Socket not initialized. Call createSocket() first.');
  return socket;
}

/**
 * Cleanly destroy the socket (logout, session expiry).
 */
export function destroySocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
