'use strict';

const db = require('../../db');
const presence = require('../presence/presence.service');
const { getFriendshipId } = require('../friends/friends.helpers');

function registerChatEvents(socket, io) {
  const userId = socket.data.user.id;

  async function getFriendSocketByFriendship(friendshipId) {
    const { rows } = await db.query(
      `SELECT user_a_id, user_b_id FROM friendships WHERE id = $1`,
      [friendshipId]
    );
    if (!rows.length) return null;
    const { user_a_id, user_b_id } = rows[0];
    if (user_a_id !== userId && user_b_id !== userId) return null;
    
    const friendId = user_a_id === userId ? user_b_id : user_a_id;
    const friendSocketId = await presence.getUserSocket(friendId);
    return { friendId, friendSocketId, isA: user_a_id === userId };
  }

  // ── chat_send_message ──────────────────────────────────────────────────────
  socket.on('chat_send_message', async ({ friendshipId, content, tempId }) => {
    try {
      if (!content || !content.trim()) return;
      if (content.length > 1000) return;

      const friendInfo = await getFriendSocketByFriendship(friendshipId);
      if (!friendInfo) return socket.emit('error', { message: 'Unauthorized' });
      const { friendId, friendSocketId, isA } = friendInfo;

      const { rows } = await db.query(
        `INSERT INTO chat_messages (friendship_id, sender_id, content, status) 
         VALUES ($1, $2, $3, 'sent') RETURNING id, sent_at`,
        [friendshipId, userId, content]
      );
      const message = rows[0];

      const unreadCol = isA ? 'unread_count_b' : 'unread_count_a';
      await db.query(
        `UPDATE chat_rooms 
         SET last_message = $1, last_message_at = NOW(), ${unreadCol} = ${unreadCol} + 1
         WHERE friendship_id = $2`,
        [content.substring(0, 50), friendshipId]
      );

      socket.emit('chat_message_confirmed', { 
        tempId, 
        messageId: message.id, 
        sentAt: message.sent_at,
        status: 'sent'
      });

      if (friendSocketId) {
        // Emit new_message for notifications and real-time chat
        io.to(friendSocketId).emit('new_message', {
          id: message.id,
          senderId: userId,
          senderName: socket.data.user.displayName,
          text: content,
          createdAt: message.sent_at,
          friendshipId,
          fromMe: false
        });

        // Legacy event for backward compatibility
        io.to(friendSocketId).emit('chat_message_received', {
          message: {
            id: message.id,
            senderId: userId,
            content,
            sentAt: message.sent_at,
            friendshipId
          }
        });

        // Mark as delivered
        await db.query(
          `UPDATE chat_messages SET status = 'delivered' WHERE id = $1`,
          [message.id]
        );
        
        socket.emit('message_delivered', { 
          messageId: message.id, 
          friendshipId 
        });
      }
    } catch (err) {
      process.stderr.write(`[CHAT] send_message error: ${err.message}\n`);
    }
  });

  // ── viewing_conversation / chat_mark_read ───────────────────────────────────
  const handleMarkRead = async ({ friendshipId }) => {
    try {
      const friendInfo = await getFriendSocketByFriendship(friendshipId);
      if (!friendInfo) return;
      const { friendId, friendSocketId, isA } = friendInfo;
      
      const unreadCol = isA ? 'unread_count_a' : 'unread_count_b';
      await db.query(
        `UPDATE chat_rooms SET ${unreadCol} = 0 WHERE friendship_id = $1`,
        [friendshipId]
      );

      // Mark all messages as read
      await db.query(
        `UPDATE chat_messages 
         SET status = 'read' 
         WHERE friendship_id = $1 AND sender_id = $2 AND status != 'read'`,
        [friendshipId, friendId]
      );
      
      if (friendSocketId) {
        // Emit to partner that their messages were read
        io.to(friendSocketId).emit('messages_read', { 
          friendshipId,
          byUserId: userId,
          readAt: new Date().toISOString() 
        });
        // Legacy
        io.to(friendSocketId).emit('chat_read_receipt', { 
          friendshipId, 
          readAt: new Date().toISOString() 
        });
      }
    } catch (err) { }
  };

  socket.on('chat_mark_read', handleMarkRead);
  socket.on('viewing_conversation', handleMarkRead);

  // ── chat_typing_start ──────────────────────────────────────────────────────
  socket.on('chat_typing_start', async ({ friendshipId }) => {
    try {
      const friendInfo = await getFriendSocketByFriendship(friendshipId);
      if (friendInfo?.friendSocketId) {
        io.to(friendInfo.friendSocketId).emit('friend_typing', { friendshipId, userId });
      }
    } catch (err) { }
  });

  // ── chat_typing_stop ───────────────────────────────────────────────────────
  socket.on('chat_typing_stop', async ({ friendshipId }) => {
    try {
      const friendInfo = await getFriendSocketByFriendship(friendshipId);
      if (friendInfo?.friendSocketId) {
        io.to(friendInfo.friendSocketId).emit('friend_stopped_typing', { friendshipId, userId });
      }
    } catch (err) { }
  });
}

module.exports = { registerChatEvents };
