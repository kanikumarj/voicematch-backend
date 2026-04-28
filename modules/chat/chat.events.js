'use strict';

// FIX: [Area 4] Chat events with delivery receipts, read receipts, and friend music sync

const db = require('../../db');
const presence = require('../presence/presence.service');
const { getFriendshipId } = require('../friends/friends.helpers');

function registerChatEvents(socket, io) {
  const userId = socket.data.user.id;

  // FIX: [Area 4] Helper to get friend socket by friendship ID
  async function getFriendSocketByFriendship(friendshipId) {
    try {
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
    } catch (err) {
      process.stderr.write(`[CHAT] getFriendSocket error: ${err.message}\n`);
      return null;
    }
  }

  // ── chat_send_message ──────────────────────────────────────────────────────
  // FIX: [Area 4] Enhanced with delivery status tracking
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

      // FIX: [Area 4] Confirm to sender with 'sent' status (single tick)
      socket.emit('chat_message_confirmed', { 
        tempId, 
        messageId: message.id, 
        sentAt: message.sent_at,
        status: 'sent'
      });

      if (friendSocketId) {
        // FIX: [Area 4] Emit new_message for notifications and real-time chat
        io.to(friendSocketId).emit('new_message', {
          id: message.id,
          senderId: userId,
          senderName: socket.data.user.displayName,
          text: content,
          createdAt: message.sent_at,
          friendshipId,
          fromMe: false,
          status: 'delivered'
        });

        // Legacy event for backward compatibility
        io.to(friendSocketId).emit('chat_message_received', {
          message: {
            id: message.id,
            senderId: userId,
            content,
            sentAt: message.sent_at,
            friendshipId,
            status: 'delivered'
          }
        });

        // FIX: [Area 4] Mark as delivered in DB
        await db.query(
          `UPDATE chat_messages SET status = 'delivered', delivered_at = NOW() WHERE id = $1`,
          [message.id]
        );
        
        // FIX: [Area 4] Notify sender: double tick (delivered)
        socket.emit('message_status_update', { 
          messageId: message.id, 
          status: 'delivered',
          friendshipId 
        });

        // Legacy event
        socket.emit('message_delivered', { 
          messageId: message.id, 
          friendshipId 
        });
      }
      // If partner offline: message stays 'sent' (single tick)
    } catch (err) {
      process.stderr.write(`[CHAT] send_message error: ${err.message}\n`);
    }
  });

  // ── viewing_conversation / chat_mark_read ───────────────────────────────────
  // FIX: [Area 4] Enhanced with read_at timestamp tracking
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

      // FIX: [Area 4] Mark all messages as read with read_at timestamp
      const updated = await db.query(
        `UPDATE chat_messages 
         SET status = 'read', read_at = NOW()
         WHERE friendship_id = $1 AND sender_id = $2 AND status != 'read'
         RETURNING id`,
        [friendshipId, friendId]
      );

      const messageIds = updated.rows.map(r => r.id);
      
      if (friendSocketId && messageIds.length > 0) {
        // FIX: [Area 4] Emit to partner that their messages were read (blue tick)
        io.to(friendSocketId).emit('messages_read', { 
          friendshipId,
          messageIds,
          byUserId: userId,
          readAt: new Date().toISOString() 
        });
        // Legacy
        io.to(friendSocketId).emit('chat_read_receipt', { 
          friendshipId, 
          readAt: new Date().toISOString() 
        });
      }
    } catch (err) {
      process.stderr.write(`[CHAT] mark_read error: ${err.message}\n`);
    }
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
    } catch (err) { /* non-critical */ }
  });

  // ── chat_typing_stop ───────────────────────────────────────────────────────
  socket.on('chat_typing_stop', async ({ friendshipId }) => {
    try {
      const friendInfo = await getFriendSocketByFriendship(friendshipId);
      if (friendInfo?.friendSocketId) {
        io.to(friendInfo.friendSocketId).emit('friend_stopped_typing', { friendshipId, userId });
      }
    } catch (err) { /* non-critical */ }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // NEW: [Area 7] Friend Music Sync Events
  // ══════════════════════════════════════════════════════════════════════════

  // FIX: [Area 7] Music share in friends chat
  socket.on('friend_music_share', async ({ friendshipId, videoId, title, thumbnail }) => {
    try {
      const friendInfo = await getFriendSocketByFriendship(friendshipId);
      if (!friendInfo) return;

      const payload = { videoId, title, thumbnail };
      socket.emit('friend_music_started', { ...payload, isSharer: true });
      if (friendInfo.friendSocketId) {
        io.to(friendInfo.friendSocketId).emit('friend_music_started', { ...payload, isSharer: false });
      }
    } catch (err) {
      process.stderr.write(`[CHAT] friend_music_share error: ${err.message}\n`);
    }
  });

  // FIX: [Area 7] Music playback control in friends chat
  socket.on('friend_music_control', async ({ friendshipId, action, timestamp }) => {
    try {
      const friendInfo = await getFriendSocketByFriendship(friendshipId);
      if (!friendInfo?.friendSocketId) return;
      io.to(friendInfo.friendSocketId).emit('friend_music_control', {
        action,
        timestamp,
        serverTime: Date.now()
      });
    } catch (err) {
      process.stderr.write(`[CHAT] friend_music_control error: ${err.message}\n`);
    }
  });

  // FIX: [Area 7] Stop music in friends chat
  socket.on('friend_music_stop', async ({ friendshipId }) => {
    try {
      const friendInfo = await getFriendSocketByFriendship(friendshipId);
      if (friendInfo?.friendSocketId) {
        io.to(friendInfo.friendSocketId).emit('friend_music_stopped');
      }
      socket.emit('friend_music_stopped');
    } catch (err) {
      process.stderr.write(`[CHAT] friend_music_stop error: ${err.message}\n`);
    }
  });

  // FIX: [Area 7] Add to music queue in friends chat
  socket.on('friend_music_queue_add', async ({ friendshipId, videoId, title, thumbnail }) => {
    try {
      const friendInfo = await getFriendSocketByFriendship(friendshipId);
      if (!friendInfo) return;
      const queueItem = { videoId, title, thumbnail, addedBy: userId };
      socket.emit('friend_music_queued', { queueItem });
      if (friendInfo.friendSocketId) {
        io.to(friendInfo.friendSocketId).emit('friend_music_queued', { queueItem });
      }
    } catch (err) {
      process.stderr.write(`[CHAT] friend_music_queue error: ${err.message}\n`);
    }
  });
}

module.exports = { registerChatEvents };
