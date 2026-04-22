'use strict';

const db = require('../../db');
const { orderUsers, removeFriendshipCache, cacheFriendship } = require('./friends.helpers');

async function getFriendsData(userId) {
  // Friends list with chat room info
  const { rows: friends } = await db.query(
    `SELECT 
      u.id, u.display_name AS "displayName", u.gender, u.status,
      f.id AS "friendshipId", f.created_at AS "friendsSince",
      CASE WHEN f.user_a_id = $1 THEN cr.unread_count_a ELSE cr.unread_count_b END AS "unreadCount",
      cr.last_message AS "lastMessage",
      cr.last_message_at AS "lastMessageAt"
     FROM friendships f
     JOIN users u ON (u.id = CASE WHEN f.user_a_id = $1 THEN f.user_b_id ELSE f.user_a_id END)
     LEFT JOIN chat_rooms cr ON cr.friendship_id = f.id
     WHERE f.user_a_id = $1 OR f.user_b_id = $1
     ORDER BY cr.last_message_at DESC NULLS LAST, f.created_at DESC`,
    [userId]
  );

  // Pending received
  const { rows: pendingReceived } = await db.query(
    `SELECT 
      fr.id AS "requestId", fr.sent_at AS "sentAt", fr.session_id AS "sessionId",
      u.id AS "fromUserId", u.display_name AS "fromUserDisplayName"
     FROM friend_requests fr
     JOIN users u ON u.id = fr.sender_id
     WHERE fr.receiver_id = $1 AND fr.status = 'pending'
     ORDER BY fr.sent_at DESC`,
    [userId]
  );

  // Pending sent
  const { rows: pendingSent } = await db.query(
    `SELECT 
      fr.id AS "requestId", fr.sent_at AS "sentAt",
      u.id AS "toUserId", u.display_name AS "toUserDisplayName"
     FROM friend_requests fr
     JOIN users u ON u.id = fr.receiver_id
     WHERE fr.sender_id = $1 AND fr.status = 'pending'
     ORDER BY fr.sent_at DESC`,
    [userId]
  );

  return {
    friends,
    pendingReceived: pendingReceived.map(r => ({
      requestId: r.requestId, sentAt: r.sentAt, sessionId: r.sessionId,
      fromUser: { id: r.fromUserId, displayName: r.fromUserDisplayName }
    })),
    pendingSent: pendingSent.map(r => ({
      requestId: r.requestId, sentAt: r.sentAt,
      toUser: { id: r.toUserId, displayName: r.toUserDisplayName }
    }))
  };
}

async function acceptFriendRequest(requestId, receiverId) {
  // Use transaction to ensure data integrity
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    // Check if valid and pending
    const { rows } = await client.query(
      `SELECT sender_id FROM friend_requests 
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'`,
      [requestId, receiverId]
    );
    if (!rows.length) throw new Error('Request not found or already processed');
    const senderId = rows[0].sender_id;
    
    // Update request
    await client.query(
      `UPDATE friend_requests SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
      [requestId]
    );

    // Also accept any inverse requests
    await client.query(
      `UPDATE friend_requests SET status = 'accepted', responded_at = NOW() 
       WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'`,
      [receiverId, senderId]
    );

    // Create friendship
    const [min, max] = orderUsers(senderId, receiverId);
    const { rows: fRows } = await client.query(
      `INSERT INTO friendships (user_a_id, user_b_id) 
       VALUES ($1, $2) ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET user_a_id = EXCLUDED.user_a_id 
       RETURNING id`,
      [min, max]
    );
    const friendshipId = fRows[0].id;

    // Create chat room
    await client.query(
      `INSERT INTO chat_rooms (friendship_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [friendshipId]
    );

    await client.query('COMMIT');
    await cacheFriendship(min, max);
    return { friendshipId, senderId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function rejectFriendRequest(requestId, receiverId) {
  const { rowCount, rows } = await db.query(
    `UPDATE friend_requests SET status = 'rejected', responded_at = NOW() 
     WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
     RETURNING sender_id`,
    [requestId, receiverId]
  );
  if (!rowCount) throw new Error('Request not found or already processed');
  return { senderId: rows[0].sender_id };
}

async function unfriend(friendshipId, userId) {
  const { rows } = await db.query(
    `DELETE FROM friendships 
     WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2)
     RETURNING user_a_id, user_b_id`,
    [friendshipId, userId]
  );
  if (!rows.length) throw new Error('Friendship not found or unauthorized');
  
  const { user_a_id, user_b_id } = rows[0];
  const otherUserId = user_a_id === userId ? user_b_id : user_a_id;
  
  await removeFriendshipCache(user_a_id, user_b_id);
  
  return { otherUserId };
}

async function getFriendProfile(friendshipId, userId) {
  const { rows } = await db.query(
    `SELECT u.id, u.display_name AS "displayName", u.gender, u.member_since AS "memberSince",
            u.total_calls AS "totalCalls", u.streak,
            u.is_online AS "isOnline", u.last_seen AS "lastSeen"
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.user_a_id = $2 THEN f.user_b_id ELSE f.user_a_id END
     WHERE f.id = $1 AND (f.user_a_id = $2 OR f.user_b_id = $2)`,
    [friendshipId, userId]
  );
  return rows[0] || null;
}

async function checkFriendship(userId, otherId) {
  const [min, max] = orderUsers(userId, otherId);
  const { rows } = await db.query(
    `SELECT id FROM friendships WHERE user_a_id = $1 AND user_b_id = $2`,
    [min, max]
  );
  return rows.length > 0;
}

module.exports = {
  getFriendsData,
  acceptFriendRequest,
  rejectFriendRequest,
  unfriend,
  getFriendProfile,
  checkFriendship
};
