'use strict';

const db    = require('../../db');
const redis = require('../../db/redis');

const BLOCK_KEY = (a, b) => `block:${a}:${b}`;

// ─── Block a user ─────────────────────────────────────────────────────────────
async function blockUser(blockerId, blockedId) {
  if (blockerId === blockedId) {
    throw Object.assign(new Error('Cannot block yourself'), { code: 'VALIDATION_ERROR' });
  }

  // DB insert — UNIQUE constraint makes this idempotent
  try {
    await db.query(
      `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)`,
      [blockerId, blockedId],
    );
  } catch (err) {
    if (err.code !== '23505') throw err;  // Ignore duplicate — idempotent
  }

  // Cache in Redis (permanent — no TTL)
  await redis.set(BLOCK_KEY(blockerId, blockedId), '1');

  return { success: true };
}

// ─── Unblock a user ───────────────────────────────────────────────────────────
async function unblockUser(blockerId, blockedId) {
  await db.query(
    `DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
    [blockerId, blockedId],
  );
  await redis.del(BLOCK_KEY(blockerId, blockedId));

  return { success: true };
}

// ─── Check if either direction is blocked (< 5ms via Redis) ──────────────────
async function isBlocked(userA, userB) {
  // Check both directions in one pipeline
  const pipeline = redis.pipeline();
  pipeline.get(BLOCK_KEY(userA, userB));
  pipeline.get(BLOCK_KEY(userB, userA));
  const results = await pipeline.exec();

  if (results[0][1] || results[1][1]) return true;

  // Redis miss — check DB (warm the cache for next time)
  const { rows } = await db.query(
    `SELECT id FROM user_blocks
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [userA, userB],
  );

  if (rows[0]) {
    // Warm cache for both directions found in DB
    await redis.set(BLOCK_KEY(userA, userB), '1');
    return true;
  }

  return false;
}

// ─── Get blocked users list ───────────────────────────────────────────────────
async function getBlockedUsers(blockerId) {
  const { rows } = await db.query(
    `SELECT u.id, u.display_name
     FROM user_blocks b
     JOIN users u ON u.id = b.blocked_id
     WHERE b.blocker_id = $1
     ORDER BY b.created_at DESC`,
    [blockerId],
  );
  return rows;
}

// ─── Warm Redis block cache on login (optional pre-load) ─────────────────────
async function warmBlockCache(userId) {
  const { rows } = await db.query(
    `SELECT blocker_id, blocked_id FROM user_blocks
     WHERE blocker_id = $1 OR blocked_id = $1`,
    [userId],
  );
  if (!rows.length) return;

  const pipeline = redis.pipeline();
  rows.forEach(({ blocker_id, blocked_id }) => {
    pipeline.set(BLOCK_KEY(blocker_id, blocked_id), '1');
  });
  await pipeline.exec();
}

module.exports = { blockUser, unblockUser, isBlocked, getBlockedUsers, warmBlockCache };
