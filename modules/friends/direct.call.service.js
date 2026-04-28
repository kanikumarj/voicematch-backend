'use strict';

// FIX: [Area 6] Direct call service — complete with session creation and proper WebRTC initiator assignment

const redis = require('../../db/redis');
const db = require('../../db');
const presence = require('../presence/presence.service');
const { areFriends } = require('./friends.helpers');
const { pairKey } = require('../matchmaking/matchmaking.service');

// FIX: [Area 6] Helper to get user display name
async function getUserName(userId) {
  try {
    const result = await db.query(
      'SELECT display_name FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0]?.display_name || 'Friend';
  } catch {
    return 'Friend';
  }
}

function registerDirectCallEvents(socket, io) {
  const userId = socket.data.user.id;
  const userDisplayName = socket.data.user.displayName;

  // ── direct_call_request ──────────────────────────────────────────────────
  // FIX: [Area 6] Enhanced with proper status checks and error handling
  socket.on('direct_call_request', async ({ toUserId }) => {
    try {
      const isFriend = await areFriends(userId, toUserId);
      if (!isFriend) {
        return socket.emit('direct_call_error', { message: 'Not friends' });
      }

      const toUserSocketId = await presence.getUserSocket(toUserId);
      if (!toUserSocketId) {
        return socket.emit('friend_offline', { userId: toUserId });
      }

      // FIX: [Area 6] Check if friend is busy
      const { rows } = await db.query('SELECT status FROM users WHERE id = $1', [toUserId]);
      if (rows[0]?.status === 'in_call') {
        return socket.emit('friend_busy', { userId: toUserId });
      }

      // Generate call ID
      const { randomUUID } = require('crypto');
      const callId = randomUUID();

      // Store in Redis (TTL 30s)
      await redis.set(
        `direct_call:${callId}`,
        JSON.stringify({ callerId: userId, receiverId: toUserId }),
        'EX', 30
      );

      // FIX: [Area 6] Emit to receiver with caller name
      const toSocket = io.sockets.sockets.get(toUserSocketId);
      if (toSocket) {
        toSocket.emit('incoming_direct_call', {
          fromUser: { id: userId, displayName: userDisplayName },
          callId
        });
      }

      // FIX: [Area 6] Confirm ringing state to caller
      socket.emit('direct_call_ringing', { callId, toUserId });

      // Handle Missed Call if timeout
      setTimeout(async () => {
        try {
          const stillPending = await redis.get(`direct_call:${callId}`);
          if (stillPending) {
            await redis.del(`direct_call:${callId}`);
            socket.emit('direct_call_missed', { callId });
            
            const freshSocketId = await presence.getUserSocket(toUserId);
            if (freshSocketId) {
              io.to(freshSocketId).emit('direct_call_cancelled', { callId });
            }
          }
        } catch (e) {
          // Timeout cleanup is best-effort
        }
      }, 30000);

    } catch (err) {
      process.stderr.write(`[DIRECT CALL] Request error: ${err.message}\n`);
      socket.emit('direct_call_error', { message: 'Call failed' });
    }
  });

  // ── direct_call_response ─────────────────────────────────────────────────
  // FIX: [Area 6] Enhanced with proper session creation and initiator assignment
  socket.on('direct_call_response', async ({ callId, action }) => {
    try {
      const callDataStr = await redis.get(`direct_call:${callId}`);
      if (!callDataStr) {
        return socket.emit('direct_call_error', { message: 'Call expired' });
      }

      const { callerId, receiverId } = JSON.parse(callDataStr);
      if (userId !== receiverId) return;

      await redis.del(`direct_call:${callId}`);

      const callerSocketId = await presence.getUserSocket(callerId);
      const callerSocket = callerSocketId ? io.sockets.sockets.get(callerSocketId) : null;

      if (action === 'reject') {
        if (callerSocket) {
          callerSocket.emit('direct_call_rejected', { callId });
        }
        return;
      }

      if (action === 'accept') {
        // FIX: [Area 6] Create session in DB
        let sessionId = null;
        try {
          sessionId = await presence.createSession(callerId, receiverId);
          await redis.hset(
            'session_id_map',
            pairKey(callerId, receiverId),
            sessionId
          );
        } catch (e) {
          process.stderr.write(`[DIRECT CALL] Session creation error: ${e.message}\n`);
        }

        // Store active pair map
        await presence.setPair(callerId, receiverId);

        // Update statuses
        await presence.setUserStatus(callerId, 'in_call');
        await presence.setUserStatus(receiverId, 'in_call');

        // FIX: [Area 6] Get partner names for both sides
        const callerName = await getUserName(callerId);
        const receiverName = await getUserName(receiverId);

        // FIX: [Area 6] Caller is WebRTC initiator (creates offer)
        if (callerSocket) {
          callerSocket.emit('direct_call_accepted', {
            callId,
            sessionId,
            initiator: true,
            partnerName: receiverName,
            partnerId: receiverId
          });
        }

        // FIX: [Area 6] Receiver waits for offer
        socket.emit('direct_call_accepted', {
          callId,
          sessionId,
          initiator: false,
          partnerName: callerName,
          partnerId: callerId
        });
      }
    } catch (err) {
      process.stderr.write(`[DIRECT CALL] Response error: ${err.message}\n`);
      socket.emit('direct_call_error', { message: 'Call response failed' });
    }
  });
}

module.exports = { registerDirectCallEvents };
