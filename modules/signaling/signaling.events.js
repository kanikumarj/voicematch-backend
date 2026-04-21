'use strict';

const presence = require('../presence/presence.service');
const { pairKey } = require('../matchmaking/matchmaking.service');
const { updateStreak } = require('../call/call.service');

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

  // ── call_end ──────────────────────────────────────────────────────────────
  socket.on('call_end', async ({ reason = 'user_ended' } = {}) => {
    try {
      const partnerId       = await presence.getPartner(userId);
      const partnerSocketId = partnerId ? await presence.getUserSocket(partnerId) : null;

      // Notify partner
      if (partnerSocketId) {
        io.to(partnerSocketId).emit('partner_disconnected', { reason });
      }

      // Update session in DB
      const redis  = require('../../db/redis');
      const key    = partnerId ? pairKey(userId, partnerId) : null;
      if (key) {
        const sessionId = await redis.hget('session_id_map', key);
        if (sessionId) {
          const endReason = reason === 'skip' ? 'skip' : 'user_disconnect';
          const duration = await presence.endSession(sessionId, endReason);
          
          if (duration > 30) {
            await updateStreak(userId);
            if (partnerId) await updateStreak(partnerId);
          }
          await redis.hdel('session_id_map', key);
        }
      }

      // Clean up pair for both
      await presence.removePair(userId, partnerId);
      await presence.clearReady(userId, partnerId);

      // Set statuses
      await presence.setUserStatus(userId, 'online');
      if (partnerId) await presence.setUserStatus(partnerId, 'online');

      // Emit confirmation to caller
      socket.emit('call_ended', { reason });
    } catch (err) {
      process.stderr.write(`[SIGNALING] call_end error ${userId}: ${err.message}\n`);
      socket.emit('error', { message: 'Call end failed. Please refresh.' });
    }
  });
}

module.exports = { registerSignalingEvents };
