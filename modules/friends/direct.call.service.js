'use strict';

const redis = require('../../db/redis');
const presence = require('../presence/presence.service');
const { areFriends } = require('./friends.helpers');

function registerDirectCallEvents(socket, io) {
  const userId = socket.data.user.id;
  const userDisplayName = socket.data.user.displayName;

  // ── direct_call_request ──────────────────────────────────────────────────
  socket.on('direct_call_request', async ({ toUserId }) => {
    try {
      const isFriend = await areFriends(userId, toUserId);
      if (!isFriend) return socket.emit('error', { message: 'Not friends' });

      const toUserSocketId = await presence.getUserSocket(toUserId);
      if (!toUserSocketId) return socket.emit('friend_offline', { userId: toUserId });

      // Check friend status from DB or Redis
      const db = require('../../db');
      const { rows } = await db.query('SELECT status FROM users WHERE id = $1', [toUserId]);
      if (rows[0]?.status === 'in_call') {
        return socket.emit('friend_busy', { userId: toUserId });
      }

      // Generate call ID
      const { randomUUID } = require('crypto');
      const callId = randomUUID();

      // Store in Redis (TTL 30s)
      await redis.set(`direct_call:${callId}`, JSON.stringify({ callerId: userId, receiverId: toUserId }), 'EX', 30);

      // Emit to receiver
      io.to(toUserSocketId).emit('incoming_direct_call', {
        fromUser: { id: userId, displayName: userDisplayName },
        callId
      });

      // Handle Missed Call if timeout
      setTimeout(async () => {
        const stillPending = await redis.get(`direct_call:${callId}`);
        if (stillPending) {
          await redis.del(`direct_call:${callId}`);
          socket.emit('direct_call_missed', { callId });
          io.to(toUserSocketId).emit('direct_call_missed', { callId });
        }
      }, 30_000);

    } catch (err) {
      process.stderr.write(`[DIRECT CALL] Request error: ${err.message}\n`);
    }
  });

  // ── direct_call_response ─────────────────────────────────────────────────
  socket.on('direct_call_response', async ({ callId, action }) => {
    try {
      const callDataStr = await redis.get(`direct_call:${callId}`);
      if (!callDataStr) return socket.emit('error', { message: 'Call expired' });
      
      const { callerId, receiverId } = JSON.parse(callDataStr);
      if (userId !== receiverId) return;

      await redis.del(`direct_call:${callId}`);

      const callerSocketId = await presence.getUserSocket(callerId);

      if (action === 'reject') {
        if (callerSocketId) io.to(callerSocketId).emit('direct_call_rejected', { callId });
        return;
      }

      if (action === 'accept') {
        // Create session
        let sessionId;
        try {
          sessionId = await presence.createSession(callerId, receiverId);
          await redis.hset('session_id_map', require('../matchmaking/matchmaking.service').pairKey(callerId, receiverId), sessionId);
        } catch (e) {}

        // Store active pair map
        await presence.setPair(callerId, receiverId);
        
        // Update statuses
        await presence.setUserStatus(callerId, 'in_call');
        await presence.setUserStatus(receiverId, 'in_call');

        // Initiator is caller
        socket.emit('direct_call_accepted', { callId, initiator: false });
        if (callerSocketId) io.to(callerSocketId).emit('direct_call_accepted', { callId, initiator: true });
      }
    } catch (err) {
      process.stderr.write(`[DIRECT CALL] Response error: ${err.message}\n`);
    }
  });
}

module.exports = { registerDirectCallEvents };
