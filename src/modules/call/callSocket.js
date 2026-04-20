/**
 * callSocket.js
 *
 * Binds matchmaking → WebRTC handoff events.
 * Used by the parent component/context that owns the socket instance.
 *
 * Usage:
 *   import { bindCallSocketEvents, unbindCallSocketEvents } from './callSocket';
 *
 *   useEffect(() => {
 *     bindCallSocketEvents(socket, { onMatchFound, onBothReady, onError });
 *     return () => unbindCallSocketEvents(socket);
 *   }, [socket]);
 */

/**
 * @param {Socket} socket
 * @param {object} handlers
 * @param {(data: { partnerId, partnerName }) => void} handlers.onMatchFound
 * @param {(data: { initiator: boolean }) => void}     handlers.onBothReady
 * @param {(data: { reason: string }) => void}         handlers.onPartnerDisconnected
 * @param {(data: { message: string }) => void}        handlers.onError
 */
export function bindCallSocketEvents(socket, {
  onMatchFound,
  onBothReady,
  onPartnerDisconnected,
  onError,
}) {
  // Fired when matchmaking pairs two users
  socket.on('match_found', (data) => {
    // Immediately confirm ready — app does this automatically
    socket.emit('ready_confirm');
    onMatchFound?.(data);
  });

  // Fired when both users have confirmed ready
  socket.on('both_ready', (data) => {
    onBothReady?.(data);
  });

  // Partner left before or during call
  socket.on('partner_disconnected', (data) => {
    onPartnerDisconnected?.(data);
  });

  // Server-side error events
  socket.on('error', (data) => {
    onError?.(data);
  });

  // Queue position feedback (no match yet)
  socket.on('queue_position', () => {
    // Parent can show "Searching…" state — no action needed here
  });
}

/**
 * Remove all call-related socket listeners.
 * Call this in useEffect cleanup or on unmount.
 */
export function unbindCallSocketEvents(socket) {
  socket.off('match_found');
  socket.off('both_ready');
  socket.off('partner_disconnected');
  socket.off('error');
  socket.off('queue_position');
}

/**
 * Emit join_pool — user is ready to be matched.
 */
export function joinPool(socket) {
  socket.emit('join_pool');
}

/**
 * Emit leave_pool — user cancels matchmaking.
 */
export function leavePool(socket) {
  socket.emit('leave_pool');
}
