'use strict';

// FIX: [Area 2] Complete signaling events with forceCleanupCall

const presence = require('../presence/presence.service');
const { pairKey } = require('../matchmaking/matchmaking.service');
const { updateStreak } = require('../call/call.service');
const db = require('../../db');

/**
 * Resolve partner's current socket reference.
 * Returns null if partner is gone — callers must handle null gracefully.
 */
async function getPartnerSocket(userId, io) {
  const partnerId = await presence.getPartner(userId);
  if (!partnerId) return null;

  const partnerSocketId = await presence.getUserSocket(partnerId);
  if (!partnerSocketId) return null;

  const partnerSocket = io.sockets.sockets.get(partnerSocketId);
  return partnerSocket || null;
}

/**
 * FIX: [Area 2] Comprehensive cleanup function for all call exit paths.
 * Ensures session is closed, pair is removed, and user status is reset.
 */
async function forceCleanupCall(userId, reason) {
  try {
    const redis = require('../../db/redis');

    // 1. Get partner before removing pair
    const partnerId = await presence.getPartner(userId);

    // 2. Find active session
    let sessionId = null;
    if (partnerId) {
      const key = pairKey(userId, partnerId);
      sessionId = await redis.hget('session_id_map', key);
    }

    // 3. Update session in DB — close it
    if (sessionId) {
      await db.query(
        `UPDATE sessions
         SET ended_at = COALESCE(ended_at, NOW()),
             end_reason = COALESCE(end_reason, $1),
             duration_seconds = COALESCE(
               duration_seconds,
               EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
             )
         WHERE id = $2
         AND ended_at IS NULL`,
        [reason, sessionId]
      );
    }

    // 4. Remove pair map and session_id_map
    if (partnerId) {
      const key = pairKey(userId, partnerId);
      await redis.hdel('session_id_map', key);
      await presence.removePair(userId, partnerId);
      await presence.clearReady(userId, partnerId);
    }

    // 5. Update user status to online
    await db.query(
      `UPDATE users SET status = 'online'
       WHERE id = $1 AND status IN ('in_call', 'searching')`,
      [userId]
    );

    // 6. Update streak if call was long enough
    if (sessionId) {
      try {
        const sessionResult = await db.query(
          `SELECT duration_seconds FROM sessions WHERE id = $1`,
          [sessionId]
        );
        const duration = sessionResult.rows[0]?.duration_seconds || 0;
        if (duration > 30) {
          await updateStreak(userId);
          if (partnerId) await updateStreak(partnerId);
        }
      } catch (e) {
        // Non-fatal — streak update failure shouldn't block cleanup
      }
    }

    return partnerId;
  } catch (err) {
    process.stderr.write(`[CLEANUP] forceCleanupCall error: ${JSON.stringify({ userId, reason, error: err.message })}\n`);
    return null;
  }
}

/**
 * Register all WebRTC signaling events.
 * Server acts as a pure relay — SDP/ICE payloads are NOT inspected.
 */
function registerSignalingEvents(socket, io) {
  const userId = socket.data.user.id;

  // ── webrtc_offer ──────────────────────────────────────────────────────────
  socket.on('webrtc_offer', async ({ offer }) => {
    if (!offer) return socket.emit('error', { message: 'Invalid offer payload' });
    try {
      const partnerSocket = await getPartnerSocket(userId, io);
      if (!partnerSocket) {
        return socket.emit('partner_disconnected', { reason: 'signaling_error' });
      }
      partnerSocket.emit('webrtc_offer', { offer });
    } catch (err) {
      process.stderr.write(`[SIGNALING] offer relay error ${userId}: ${err.message}\n`);
    }
  });

  // ── webrtc_answer ─────────────────────────────────────────────────────────
  socket.on('webrtc_answer', async ({ answer }) => {
    if (!answer) return socket.emit('error', { message: 'Invalid answer payload' });
    try {
      const partnerSocket = await getPartnerSocket(userId, io);
      if (!partnerSocket) {
        return socket.emit('partner_disconnected', { reason: 'signaling_error' });
      }
      partnerSocket.emit('webrtc_answer', { answer });
    } catch (err) {
      process.stderr.write(`[SIGNALING] answer relay error ${userId}: ${err.message}\n`);
    }
  });

  // ── webrtc_ice_candidate ──────────────────────────────────────────────────
  socket.on('webrtc_ice_candidate', async ({ candidate }) => {
    if (!candidate) return; // Null candidate = end-of-candidates — silently drop
    try {
      const partnerSocket = await getPartnerSocket(userId, io);
      if (!partnerSocket) return; // Partner gone mid-negotiation — disconnect handler will clean up
      partnerSocket.emit('webrtc_ice_candidate', { candidate });
    } catch (err) {
      process.stderr.write(`[SIGNALING] ICE relay error ${userId}: ${err.message}\n`);
    }
  });

  // ── match_message (Chat Relay) ────────────────────────────────────────────
  socket.on('match_message', ({ roomId, targetSocketId, text }) => {
    io.to(targetSocketId).emit('match_message', {
      text,
      fromSocketId: socket.id,
      timestamp: Date.now()
    });
  });

  // ── match_typing (Chat Relay) ─────────────────────────────────────────────
  socket.on('match_typing', ({ roomId, targetSocketId }) => {
    io.to(targetSocketId).emit('match_typing', {
      fromSocketId: socket.id
    });
  });

  // ── match_end (Chat Relay) ────────────────────────────────────────────────
  socket.on('match_end', ({ roomId, targetSocketId }) => {
    io.to(targetSocketId).emit('match_ended', {
      fromSocketId: socket.id
    });
    // Optional: trigger normal call_end cleanup
    socket.emit('call_end', { reason: 'user_ended' });
  });

  // FIX: [Area 2] call_end — user explicitly ended, with comprehensive cleanup
  socket.on('call_end', async ({ reason = 'user_ended' } = {}) => {
    try {
      const partnerId = await forceCleanupCall(userId, reason === 'skip' ? 'skip' : 'user_disconnect');

      // Notify partner
      if (partnerId) {
        const partnerSocketId = await presence.getUserSocket(partnerId);
        if (partnerSocketId) {
          io.to(partnerSocketId).emit('partner_disconnected', { reason });
        }

        // FIX: [Area 2] Update partner status
        await db.query(
          `UPDATE users SET status = 'online'
           WHERE id = $1 AND status = 'in_call'`,
          [partnerId]
        );
      }

      // Emit confirmation to caller
      socket.emit('call_ended', { reason });
    } catch (err) {
      process.stderr.write(`[SIGNALING] call_end error ${userId}: ${err.message}\n`);
      socket.emit('error', { message: 'Call end failed. Please refresh.' });
    }
  });
}

module.exports = { registerSignalingEvents, forceCleanupCall };
