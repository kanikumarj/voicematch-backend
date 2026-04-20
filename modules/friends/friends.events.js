'use strict';

const db = require('../../db');
const presence = require('../presence/presence.service');
const { areFriends, cacheFriendship, orderUsers } = require('./friends.helpers');

function registerFriendsEvents(socket, io) {
  const userId = socket.data.user.id;
  const userDisplayName = socket.data.user.displayName;

  // ── send_friend_request ────────────────────────────────────────────────────────
  socket.on('send_friend_request', async ({ toUserId, sessionId }) => {
    try {
      // 1. Validate they are in an active call
      const partnerId = await presence.getPartner(userId);
      if (partnerId !== toUserId) {
        return socket.emit('error', { message: 'Can only send requests during an active call with this user' });
      }

      // 2. Validate not already friends
      const friendsAlready = await areFriends(userId, toUserId);
      if (friendsAlready) {
        return socket.emit('already_friends', { userId: toUserId });
      }

      // 3. Check existing requests
      const { rows } = await db.query(
        `SELECT id, sender_id FROM friend_requests 
         WHERE (sender_id = $1 AND receiver_id = $2 AND status = 'pending')
            OR (sender_id = $2 AND receiver_id = $1 AND status = 'pending')`,
        [userId, toUserId]
      );

      let existing = rows.find(r => r.sender_id === userId);
      if (existing) return; // already sent

      let incoming = rows.find(r => r.sender_id === toUserId);

      const toUserSocketId = await presence.getUserSocket(toUserId);

      // 4. Mutual interest -> auto accept
      if (incoming) {
        // Update request
        await db.query(`UPDATE friend_requests SET status = 'accepted', responded_at = NOW() WHERE id = $1`, [incoming.id]);
        
        // Create friendship
        const [min, max] = orderUsers(userId, toUserId);
        const { rows: fRows } = await db.query(
          `INSERT INTO friendships (user_a_id, user_b_id) VALUES ($1, $2) 
           ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET user_a_id = EXCLUDED.user_a_id 
           RETURNING id`,
          [min, max]
        );
        const friendshipId = fRows[0].id;

        // Create chat room
        await db.query(`INSERT INTO chat_rooms (friendship_id) VALUES ($1) ON CONFLICT DO NOTHING`, [friendshipId]);
        await cacheFriendship(min, max);

        const friend1 = { id: toUserId }; // In real app, fetch name if needed, but we have them in call
        const friend2 = { id: userId, displayName: userDisplayName };
        
        socket.emit('friendship_created', { friendshipId, friend: friend1 });
        if (toUserSocketId) io.to(toUserSocketId).emit('friendship_created', { friendshipId, friend: friend2 });
        return;
      }

      // 5. Normal send
      const { rows: reqRows } = await db.query(
        `INSERT INTO friend_requests (sender_id, receiver_id, session_id) 
         VALUES ($1, $2, $3) RETURNING id`,
        [userId, toUserId, sessionId]
      );
      const requestId = reqRows[0].id;

      socket.emit('friend_request_sent_confirm', { requestId, toUser: { id: toUserId } });
      
      if (toUserSocketId) {
        io.to(toUserSocketId).emit('friend_request_received', {
          requestId,
          fromUser: { id: userId, displayName: userDisplayName }
        });
      }
    } catch (err) {
      process.stderr.write(`[FRIENDS] send_friend_request error: ${err.message}\n`);
    }
  });

  // ── respond_friend_request (during call) ────────────────────────────────────────
  socket.on('respond_friend_request', async ({ requestId, action }) => {
    try {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `SELECT sender_id FROM friend_requests WHERE id = $1 AND receiver_id = $2 AND status = 'pending'`,
          [requestId, userId]
        );
        if (!rows.length) {
          await client.query('ROLLBACK');
          return;
        }
        
        const senderId = rows[0].sender_id;
        const senderSocketId = await presence.getUserSocket(senderId);

        if (action === 'accept') {
          await client.query(`UPDATE friend_requests SET status = 'accepted', responded_at = NOW() WHERE id = $1`, [requestId]);
          const [min, max] = orderUsers(userId, senderId);
          const { rows: fRows } = await client.query(
            `INSERT INTO friendships (user_a_id, user_b_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id`,
            [min, max]
          );
          if (fRows.length) {
            const friendshipId = fRows[0].id;
            await client.query(`INSERT INTO chat_rooms (friendship_id) VALUES ($1) ON CONFLICT DO NOTHING`, [friendshipId]);
            await cacheFriendship(min, max);

            socket.emit('friendship_created', { friendshipId, friend: { id: senderId } });
            if (senderSocketId) io.to(senderSocketId).emit('friendship_created', { friendshipId, friend: { id: userId, displayName: userDisplayName } });
          }
        } else if (action === 'reject') {
          await client.query(`UPDATE friend_requests SET status = 'rejected', responded_at = NOW() WHERE id = $1`, [requestId]);
          if (senderSocketId) io.to(senderSocketId).emit('friend_request_rejected', { toUserId: userId });
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (err) {
      process.stderr.write(`[FRIENDS] respond_friend_request error: ${err.message}\n`);
    }
  });
}

module.exports = { registerFriendsEvents };
