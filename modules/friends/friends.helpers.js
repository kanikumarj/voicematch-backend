'use strict';

const db = require('../../db');
const redis = require('../../db/redis');

// Enforce smaller UUID first
function orderUsers(userA, userB) {
  return userA < userB ? [userA, userB] : [userB, userA];
}

async function getFriendshipId(userA, userB) {
  const [min, max] = orderUsers(userA, userB);
  const { rows } = await db.query(
    'SELECT id FROM friendships WHERE user_a_id = $1 AND user_b_id = $2',
    [min, max]
  );
  return rows[0]?.id || null;
}

async function areFriends(userA, userB) {
  if (!userA || !userB) return false;
  const [min, max] = orderUsers(userA, userB);
  const cacheKey = `friends:${min}:${max}`;
  
  // Check Redis first
  const cached = await redis.get(cacheKey);
  if (cached) return cached === '1';

  // Fallback to DB
  const friendshipId = await getFriendshipId(min, max);
  const isFriend = !!friendshipId;

  // Cache result for 1 hour
  await redis.set(cacheKey, isFriend ? '1' : '0', 'EX', 3600);
  
  return isFriend;
}

// Ensure cache is updated when friendship is created
async function cacheFriendship(userA, userB) {
  const [min, max] = orderUsers(userA, userB);
  await redis.set(`friends:${min}:${max}`, '1', 'EX', 3600);
}

// Remove from cache when unfriended
async function removeFriendshipCache(userA, userB) {
  const [min, max] = orderUsers(userA, userB);
  await redis.del(`friends:${min}:${max}`);
}

async function getUnreadCount(friendshipId, userId) {
  const { rows } = await db.query(
    `SELECT user_a_id, user_b_id FROM friendships WHERE id = $1`,
    [friendshipId]
  );
  if (!rows.length) return 0;
  
  const isA = rows[0].user_a_id === userId;
  const col = isA ? 'unread_count_a' : 'unread_count_b';
  
  const { rows: roomRows } = await db.query(
    `SELECT ${col} AS count FROM chat_rooms WHERE friendship_id = $1`,
    [friendshipId]
  );
  
  return roomRows[0]?.count || 0;
}

module.exports = {
  orderUsers,
  getFriendshipId,
  areFriends,
  cacheFriendship,
  removeFriendshipCache,
  getUnreadCount
};
