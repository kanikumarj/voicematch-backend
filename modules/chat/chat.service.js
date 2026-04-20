'use strict';

const db = require('../../db');
const { areFriends } = require('../friends/friends.helpers');

async function getMessages(friendshipId, userId, page = 1, limit = 30) {
  // Validate areFriends
  const { rows: fRows } = await db.query(
    `SELECT user_a_id, user_b_id FROM friendships WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2)`,
    [friendshipId, userId]
  );
  if (!fRows.length) throw new Error('Unauthorized');
  
  const offset = (page - 1) * limit;

  const { rows: messages } = await db.query(
    `SELECT id, sender_id AS "senderId", content, sent_at AS "sentAt", is_deleted AS "isDeleted"
     FROM chat_messages
     WHERE friendship_id = $1
     ORDER BY sent_at DESC
     LIMIT $2 OFFSET $3`,
    [friendshipId, limit + 1, offset]
  );

  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();

  // Mark as delivered / Reset unread
  const isA = fRows[0].user_a_id === userId;
  const unreadCol = isA ? 'unread_count_a' : 'unread_count_b';
  await db.query(`UPDATE chat_rooms SET ${unreadCol} = 0 WHERE friendship_id = $1`, [friendshipId]);

  return {
    messages: messages.reverse(), // return chronological order for UI
    hasMore,
    page
  };
}

async function deleteMessage(messageId, userId) {
  const { rowCount } = await db.query(
    `UPDATE chat_messages 
     SET is_deleted = true, content = 'Message deleted'
     WHERE id = $1 AND sender_id = $2 AND is_deleted = false`,
    [messageId, userId]
  );
  
  if (!rowCount) throw new Error('Message not found or unauthorized');
  
  // Need friendship id to emit socket event
  const { rows } = await db.query(
    `SELECT friendship_id FROM chat_messages WHERE id = $1`,
    [messageId]
  );
  
  return rows[0]?.friendship_id || null;
}

module.exports = {
  getMessages,
  deleteMessage
};
