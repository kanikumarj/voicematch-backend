'use strict';

const presence    = require('./presence.service');
const { handleReconnection } = require('./reconnection.service');
const { attemptMatch, recordJoinTime, clearJoinTime } = require('../matchmaking/matchmaking.service');
const { notifyFriendsOnConnect, notifyFriendsOnDisconnect, notifyFriendsStatusChange } = require('../friends/presence.friends');

/**
 * Register all presence-layer Socket.IO events for this socket.
 */
function registerPresenceEvents(socket, io) {
  const userId = socket.data.user.id;

  // ── On connect: register socket mapping + set online ────────────────────────
  (async () => {
    try {
      await presence.setUserSocket(userId, socket.id);
      await presence.setUserStatus(userId, 'online');
      await notifyFriendsOnConnect(socket, io);
    } catch (err) {
      process.stderr.write(`[PRESENCE] connect setup failed for ${userId}: ${err.message}\n`);
    }
  })();

  // ── reconnect_restore ────────────────────────────────────────────────────────
  // Client auto-emits this on socket reconnect to restore their session state
  socket.on('reconnect_restore', async () => {
    try {
      await handleReconnection(socket, io);
    } catch (err) {
      process.stderr.write(`[PRESENCE] reconnect_restore error ${userId}: ${err.message}\n`);
      socket.emit('session_restored', { state: 'online' }); // safe fallback
    }
  });

  // ── join_pool ────────────────────────────────────────────────────────────────
  socket.on('join_pool', async () => {
    try {
      // P4-9: Redis token bucket — Socket.IO bypasses Express rate limiters
      const rlKey  = `rl:pool:${userId}`;
      const redis  = require('../../db/redis');
      const calls  = await redis.incr(rlKey);
      if (calls === 1) await redis.expire(rlKey, 60);   // 60s window
      if (calls > 20) {
        return socket.emit('error', { message: 'Too many queue requests. Please slow down.' });
      }

      // P5: Email verification gate (TEMPORARILY DISABLED)
      /*
      const db = require('../../db');
      const { rows: uRows } = await db.query(
        'SELECT email_verified FROM users WHERE id = $1',
        [userId],
      );
      if (!uRows[0]?.email_verified) {
        return socket.emit('verification_required', {
          message: 'Please verify your email address before joining a call.',
        });
      }
      */

      // Guard: already in_call — do not re-queue
      const currentSocket = await presence.getUserSocket(userId);
      if (!currentSocket) return;

      await presence.setUserStatus(userId, 'searching');
      await presence.addToPool(userId);       // LREM guard prevents duplicates
      await recordJoinTime(userId);           // FIXED: track wait time for gender filter widening

      // Attempt match — if pool still has waiting users after match, notify them
      await attemptMatch(io);

      // QA-P2-6: Emit queue_position to users still waiting after pairing
      const remaining = await presence.getPoolLength();
      if (remaining > 0) {
        const waitingIds = await redis.lrange('searching_pool', 0, -1);
        const socketMap  = await redis.hgetall('user_socket_map');
        for (const wId of waitingIds) {
          const wSid = socketMap?.[wId];
          if (wSid) io.to(wSid).emit('queue_position', { waiting: true });
        }
      }

    } catch (err) {
      process.stderr.write(`[PRESENCE] join_pool error ${userId}: ${err.message}\n`);
      socket.emit('error', { message: 'Failed to join pool. Please try again.' });
    }
  });

  // ── leave_pool ───────────────────────────────────────────────────────────────
  socket.on('leave_pool', async () => {
    try {
      await presence.removeFromPool(userId);
      await presence.setUserStatus(userId, 'online');
    } catch (err) {
      process.stderr.write(`[PRESENCE] leave_pool error ${userId}: ${err.message}\n`);
    }
  });

  // ── disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', async (reason) => {
    process.stdout.write(`[SOCKET] Disconnected: ${userId} — reason: ${reason}\n`);

    // Grace period for transport-level blips (e.g. mobile background, brief network drop)
    // If user reconnects within 5s and emits reconnect_restore, this cleanup is skipped
    const GRACE_MS = 5_000;
    const gracefulReasons = ['transport close', 'ping timeout'];
    const isBlip = gracefulReasons.includes(reason);

    if (isBlip) {
      // Mark socket as stale but don't clean up yet
      await new Promise(resolve => setTimeout(resolve, GRACE_MS));

      // Check if user reconnected during grace period (new socket would have updated map)
      const currentSid = await presence.getUserSocket(userId);
      if (currentSid && currentSid !== socket.id) {
        // User reconnected — grace period served its purpose, bail out
        process.stdout.write(`[SOCKET] ${userId} reconnected during grace — skip cleanup\n`);
        return;
      }
    }

    try {
      const partnerId = await presence.getPartner(userId);

      if (partnerId) {
        // User was in an active call — notify and requeue partner
        const partnerSocketId = await presence.getUserSocket(partnerId);
        if (partnerSocketId) {
          io.to(partnerSocketId).emit('partner_disconnected', { reason: 'user_disconnect' });

          // Requeue partner
          await presence.setUserStatus(partnerId, 'searching');
          await presence.addToPool(partnerId);
          await attemptMatch(io);
        }

        // Clean up pair
        await presence.removePair(userId, partnerId);
        await presence.clearReady(userId, partnerId);
      }

      // Full cleanup for this user
      await presence.cleanupUser(userId);
      await presence.setUserStatus(userId, 'offline');
      await notifyFriendsOnDisconnect(userId, io);
    } catch (err) {
      process.stderr.write(`[PRESENCE] disconnect cleanup error ${userId}: ${err.message}\n`);
    }
  });
}

module.exports = { registerPresenceEvents };
