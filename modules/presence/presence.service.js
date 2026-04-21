'use strict';

const fs    = require('fs');
const path  = require('path');
const redis = require('../../db/redis');
const db    = require('../../db');

// ─── Load Lua script for atomic pair extraction ───────────────────────────────
const LUA_PAIR_SCRIPT = fs.readFileSync(
  path.join(__dirname, '../matchmaking/matchmaking_pair.lua'),
  'utf8',
);

// Cache the SHA after first SCRIPT LOAD — avoids re-sending script body every call
let luaPairSha = null;
async function getLuaSha() {
  if (!luaPairSha) {
    luaPairSha = await redis.script('LOAD', LUA_PAIR_SCRIPT);
  }
  return luaPairSha;
}

// ─── Redis key helpers ─────────────────────────────────────────────────────────
const KEYS = {
  socketMap:  'user_socket_map',   // HASH: userId → socketId
  pairMap:    'active_pair_map',   // HASH: userId → partnerId
  searchPool: (mode) => `searching_pool:${mode}`, // LIST: [userId, ...]
  readySet:   'pending_ready',     // SET:  userIds who confirmed ready
  userMode:   'user_mode_map',     // HASH: userId -> mode ('voice' | 'chat')
};

// ─── Socket map ───────────────────────────────────────────────────────────────
async function setUserSocket(userId, socketId) {
  await redis.hset(KEYS.socketMap, userId, socketId);
}

async function getUserSocket(userId) {
  return redis.hget(KEYS.socketMap, userId);
}

async function removeUserSocket(userId) {
  await redis.hdel(KEYS.socketMap, userId);
}

async function getActiveUsersCount() {
  try {
    return await redis.hlen(KEYS.socketMap);
  } catch (err) {
    return 0;
  }
}

// ─── Status (PostgreSQL) ──────────────────────────────────────────────────────
async function setUserStatus(userId, status) {
  await db.query(
    'UPDATE users SET status = $1 WHERE id = $2',
    [status, userId],
  );
}

// ─── Pool helpers ─────────────────────────────────────────────────────────────
async function setUserMode(userId, mode) {
  await redis.hset(KEYS.userMode, userId, mode);
}

async function getUserMode(userId) {
  return (await redis.hget(KEYS.userMode, userId)) || 'voice';
}

async function addToPool(userId, mode = 'voice') {
  await setUserMode(userId, mode);
  const poolKey = KEYS.searchPool(mode);
  // LREM first — prevents duplicate entries from double-click / rapid re-joins
  await redis.lrem(poolKey, 0, userId);
  await redis.lpush(poolKey, userId);
}

async function removeFromPool(userId) {
  const mode = await getUserMode(userId);
  await redis.lrem(KEYS.searchPool(mode), 0, userId);
  // Also clean from fallback just in case
  await redis.lrem(KEYS.searchPool('voice'), 0, userId);
  await redis.lrem(KEYS.searchPool('chat'), 0, userId);
}

async function getPoolLength(mode = 'voice') {
  return redis.llen(KEYS.searchPool(mode));
}

async function popTwoFromPool(mode = 'voice', _retry = false) {
  // Atomic Lua script — single round trip, no race between LLEN check and RPOP
  try {
    const sha    = await getLuaSha();
    const result = await redis.evalsha(sha, 1, KEYS.searchPool(mode));
    if (!result || result.length < 2) return [null, null];
    return [result[0], result[1]];
  } catch (err) {
    // Redis restart flushes the script cache — reload and retry once
    if (err.message && err.message.includes('NOSCRIPT') && !_retry) {
      luaPairSha = null;
      return popTwoFromPool(mode, true);
    }
    throw err;
  }
}

// ─── Active pair map ──────────────────────────────────────────────────────────
async function setPair(userA, userB) {
  await redis.hset(KEYS.pairMap, userA, userB);
  await redis.hset(KEYS.pairMap, userB, userA);
}

async function getPartner(userId) {
  return redis.hget(KEYS.pairMap, userId);
}

async function removePair(userA, userB) {
  const pipeline = redis.pipeline();
  pipeline.hdel(KEYS.pairMap, userA);
  if (userB) pipeline.hdel(KEYS.pairMap, userB);
  await pipeline.exec();
}

// ─── Ready confirmation SET ───────────────────────────────────────────────────
async function markReady(userId) {
  await redis.sadd(KEYS.readySet, userId);
}

async function isReady(userId) {
  return redis.sismember(KEYS.readySet, userId);
}

async function clearReady(...userIds) {
  if (userIds.length > 0) {
    await redis.srem(KEYS.readySet, ...userIds);
  }
}

// ─── Full cleanup for a disconnecting user ────────────────────────────────────
async function cleanupUser(userId) {
  const mode = await getUserMode(userId);
  const pipeline = redis.pipeline();
  pipeline.hdel(KEYS.socketMap, userId);
  pipeline.lrem(KEYS.searchPool(mode), 0, userId);
  pipeline.lrem(KEYS.searchPool('voice'), 0, userId);
  pipeline.lrem(KEYS.searchPool('chat'), 0, userId);
  pipeline.hdel(KEYS.pairMap, userId);
  pipeline.srem(KEYS.readySet, userId);
  await pipeline.exec();
}

// ─── Session persistence ──────────────────────────────────────────────────────
async function createSession(userAId, userBId) {
  const { rows } = await db.query(
    `INSERT INTO sessions (user_a_id, user_b_id)
     VALUES ($1, $2)
     RETURNING id`,
    [userAId, userBId],
  );
  return rows[0].id;
}

async function endSession(sessionId, reason) {
  const { rows } = await db.query(
    `UPDATE sessions
     SET ended_at   = NOW(),
         end_reason = $1
     WHERE id = $2
     RETURNING EXTRACT(EPOCH FROM (ended_at - created_at)) as duration`,
    [reason, sessionId],
  );
  return rows[0] ? rows[0].duration : 0;
}

module.exports = {
  KEYS,
  setUserSocket,
  getUserSocket,
  removeUserSocket,
  setUserStatus,
  addToPool,
  removeFromPool,
  getPoolLength,
  popTwoFromPool,
  setPair,
  getPartner,
  removePair,
  markReady,
  isReady,
  clearReady,
  cleanupUser,
  createSession,
  endSession,
  getActiveUsersCount,
  getUserMode,
  setUserMode,
};
