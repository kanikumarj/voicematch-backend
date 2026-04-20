'use strict';

const { resolveReadyConfirm, attemptMatch, recordSkip } = require('./matchmaking.service');
const presence = require('../presence/presence.service');

/**
 * Register matchmaking-layer Socket.IO events for this socket.
 * Note: join_pool / leave_pool are handled in presence.events.js.
 */
function registerMatchmakingEvents(socket, io) {
  const userId = socket.data.user.id;

  // ── ready_confirm ─────────────────────────────────────────────────────────
  socket.on('ready_confirm', async () => {
    try {
      await resolveReadyConfirm(userId, io);
    } catch (err) {
      process.stderr.write(`[MATCHMAKING] ready_confirm error ${userId}: ${err.message}\n`);
      socket.emit('error', { message: 'Ready confirmation failed.' });
    }
  });

  // ── skip (decline match and requeue, with cooldown) ───────────────────────
  socket.on('skip', async () => {
    try {
      const partnerId = await presence.getPartner(userId);

      if (partnerId) {
        // Record 15s skip cooldown so this pair is NOT immediately re-matched
        await recordSkip(userId, partnerId);

        const partnerSocketId = await presence.getUserSocket(partnerId);

        // Notify partner they were skipped → send them back to searching
        if (partnerSocketId) {
          io.to(partnerSocketId).emit('partner_disconnected', { reason: 'skip' });
          await presence.setUserStatus(partnerId, 'searching');
          await presence.addToPool(partnerId);
        }

        // Clean up pair
        await presence.removePair(userId, partnerId);
        await presence.clearReady(userId, partnerId);
      }

      // Requeue self
      await presence.setUserStatus(userId, 'searching');
      await presence.addToPool(userId);

      // Let client know they're back in queue
      socket.emit('skip_confirmed');

      // Attempt match for everyone in the pool
      await attemptMatch(io);
    } catch (err) {
      process.stderr.write(`[MATCHMAKING] skip error ${userId}: ${err.message}\n`);
      socket.emit('error', { message: 'Skip failed. Please try again.' });
    }
  });

  // ── exit_pool (user deliberately exits — no requeue) ─────────────────────
  socket.on('exit_pool', async () => {
    try {
      const partnerId = await presence.getPartner(userId);

      if (partnerId) {
        await recordSkip(userId, partnerId);
        const partnerSocketId = await presence.getUserSocket(partnerId);
        if (partnerSocketId) {
          io.to(partnerSocketId).emit('partner_disconnected', { reason: 'exit' });
          await presence.setUserStatus(partnerId, 'searching');
          await presence.addToPool(partnerId);
        }
        await presence.removePair(userId, partnerId);
        await presence.clearReady(userId, partnerId);
      }

      // Remove self from pool but stay online (not requeue)
      await presence.removeFromPool(userId);
      await presence.setUserStatus(userId, 'online');

      // No recurse — user is done for now
    } catch (err) {
      process.stderr.write(`[MATCHMAKING] exit_pool error ${userId}: ${err.message}\n`);
    }
  });
}

module.exports = { registerMatchmakingEvents };
