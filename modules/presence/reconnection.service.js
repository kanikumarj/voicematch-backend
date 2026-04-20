'use strict';

const presence = require('../presence/presence.service');
const { attemptMatch } = require('../matchmaking/matchmaking.service');

/**
 * Reconnection recovery service.
 *
 * When a client reconnects (network blip, tab focus restore, mobile resume),
 * Socket.IO assigns a NEW socket.id. This service re-attaches the user's
 * state to the new socket without requiring a full re-auth flow.
 *
 * Client emits: 'reconnect_restore' (automatically on socket reconnect)
 * Server responds with the user's current state so UI can resume correctly.
 */

/**
 * Handle state restoration for a reconnected socket.
 *
 * @param {Socket} socket — the NEW socket (different socket.id from before)
 * @param {SocketIO.Server} io
 */
async function handleReconnection(socket, io) {
  const userId  = socket.data.user.id;
  const newSid  = socket.id;

  // Update socket map — old socketId is now stale
  await presence.setUserSocket(userId, newSid);

  // Determine current state
  const partnerId = await presence.getPartner(userId);

  if (partnerId) {
    // Was in an active call — check if partner is still connected
    const partnerSocketId = await presence.getUserSocket(partnerId);

    if (partnerSocketId) {
      // Both alive — resume the call
      await presence.setUserStatus(userId, 'in_call');
      socket.emit('session_restored', {
        state:       'in_call',
        partnerId,
      });
      // Notify partner that their counterpart is back
      io.to(partnerSocketId).emit('partner_reconnected');
    } else {
      // Partner gone during reconnect window — clean up and requeue
      await presence.removePair(userId, partnerId);
      await presence.clearReady(userId, partnerId);
      await presence.setUserStatus(userId, 'searching');
      await presence.addToPool(userId);
      socket.emit('session_restored', { state: 'searching' });
      await attemptMatch(io);
    }
    return;
  }

  // Was searching — re-add to pool
  const isInPool = await checkInPool(userId);
  if (isInPool) {
    socket.emit('session_restored', { state: 'searching' });
    await attemptMatch(io);
    return;
  }

  // Default — mark as online
  await presence.setUserStatus(userId, 'online');
  socket.emit('session_restored', { state: 'online' });
}

/**
 * Check if a userId is currently in the searching_pool LIST.
 * O(n) scan — acceptable for MVP pool sizes.
 */
async function checkInPool(userId) {
  const redis = require('../../db/redis');
  const pool  = await redis.lrange('searching_pool', 0, -1);
  return pool.includes(userId);
}

module.exports = { handleReconnection };
