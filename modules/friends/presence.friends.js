'use strict';

const db = require('../../db');
const presence = require('../presence/presence.service');

async function notifyFriendsOnConnect(socket, io) {
  const userId = socket.data.user.id;
  try {
    // Get all friends
    const { rows } = await db.query(
      `SELECT CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END AS friend_id 
       FROM friendships WHERE user_a_id = $1 OR user_b_id = $1`,
      [userId]
    );
    
    if (!rows.length) return;
    
    const friendIds = rows.map(r => r.friend_id);
    const onlineFriends = [];
    
    // Batch emit in chunks to avoid blocking
    const BATCH_SIZE = 50;
    for (let i = 0; i < friendIds.length; i += BATCH_SIZE) {
      const chunk = friendIds.slice(i, i + BATCH_SIZE);
      const socketPromises = chunk.map(id => presence.getUserSocket(id));
      const sockets = await Promise.all(socketPromises);
      
      for (let j = 0; j < chunk.length; j++) {
        const friendId = chunk[j];
        const fSocketId = sockets[j];
        
        if (fSocketId) {
          // Friend is online
          const { rows: statusRows } = await db.query('SELECT status FROM users WHERE id = $1', [friendId]);
          onlineFriends.push({ userId: friendId, status: statusRows[0]?.status || 'online' });
          
          // Notify friend I am online
          io.to(fSocketId).emit('friend_online', { userId, status: 'online' });
        }
      }
    }
    
    // Send initial list to myself
    socket.emit('friends_online_status', { onlineFriends });
  } catch (err) {
    process.stderr.write(`[FRIENDS PRESENCE] Connect error: ${err.message}\n`);
  }
}

async function notifyFriendsOnDisconnect(userId, io) {
  try {
    const { rows } = await db.query(
      `SELECT CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END AS friend_id 
       FROM friendships WHERE user_a_id = $1 OR user_b_id = $1`,
      [userId]
    );
    
    if (!rows.length) return;
    
    const friendIds = rows.map(r => r.friend_id);
    for (const friendId of friendIds) {
      const fSocketId = await presence.getUserSocket(friendId);
      if (fSocketId) {
        io.to(fSocketId).emit('friend_offline', { userId });
      }
    }
  } catch (err) {
    process.stderr.write(`[FRIENDS PRESENCE] Disconnect error: ${err.message}\n`);
  }
}

async function notifyFriendsStatusChange(userId, status, io) {
  try {
    const { rows } = await db.query(
      `SELECT CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END AS friend_id 
       FROM friendships WHERE user_a_id = $1 OR user_b_id = $1`,
      [userId]
    );
    
    if (!rows.length) return;
    
    const friendIds = rows.map(r => r.friend_id);
    for (const friendId of friendIds) {
      const fSocketId = await presence.getUserSocket(friendId);
      if (fSocketId) {
        io.to(fSocketId).emit('friend_status_change', { userId, status });
      }
    }
  } catch (err) {
    process.stderr.write(`[FRIENDS PRESENCE] Status change error: ${err.message}\n`);
  }
}

module.exports = {
  notifyFriendsOnConnect,
  notifyFriendsOnDisconnect,
  notifyFriendsStatusChange
};
