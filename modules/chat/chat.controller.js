'use strict';

const chatService = require('./chat.service');
const presence = require('../presence/presence.service');

async function getMessages(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const data = await chatService.getMessages(req.params.friendshipId, req.user.id, page, limit);
    res.json(data);
  } catch (err) {
    if (err.message === 'Unauthorized') return res.status(403).json({ error: err.message });
    next(err);
  }
}

async function deleteMessage(req, res, next) {
  try {
    const friendshipId = await chatService.deleteMessage(req.params.messageId, req.user.id);
    
    if (friendshipId) {
      // Emit via socket if possible, or handle through chat.events.js
      // We will need `io` to emit. Instead of doing it here, we'll let client rely on polling or we can import socket.
      // But we can get `io` from `socket.server`
      const { getIO } = require('../../socket/socket.server');
      const db = require('../../db');
      const { rows } = await db.query(
        `SELECT user_a_id, user_b_id FROM friendships WHERE id = $1`, [friendshipId]
      );
      if (rows.length) {
        const friendId = rows[0].user_a_id === req.user.id ? rows[0].user_b_id : rows[0].user_a_id;
        const friendSocketId = await presence.getUserSocket(friendId);
        if (friendSocketId) {
          getIO().to(friendSocketId).emit('message_deleted', { messageId: req.params.messageId });
        }
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('unauthorized') || err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

module.exports = {
  getMessages,
  deleteMessage
};
