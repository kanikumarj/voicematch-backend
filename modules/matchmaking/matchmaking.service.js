'use strict';

const redis       = require('../../db/redis');
const presence    = require('../presence/presence.service');
const db          = require('../../db');
const { isBlocked }            = require('../moderation/block.service');
const { getPoolPushDirection } = require('../moderation/trust.service');

// In-memory ready-timeout map — keyed by sorted pair string "uuidA:uuidB"
const readyTimeouts = new Map();

function pairKey(a, b) {
  return [a, b].sort().join(':');
}

// ─── Skip cooldown helpers ─────────────────────────────────────────────────────
const SKIP_COOLDOWN_SEC = 15; // seconds before the same pair can be re-matched
const RECENT_MAX        = 5;  // keep last N matched user IDs

/** Mark that userId skipped/ended with partnerId. Prevents immediate rematch. */
async function recordSkip(userId, partnerId) {
  await redis.set(`skip_cd:${userId}:${partnerId}`, '1', 'EX', SKIP_COOLDOWN_SEC);
  const listKey = `recent_matches:${userId}`;
  await redis.lpush(listKey, partnerId);
  await redis.ltrim(listKey, 0, RECENT_MAX - 1);
  await redis.expire(listKey, 600);
}

/** Return true if this pair was recently skipped (either direction). */
async function hasSkipCooldown(userId, partnerId) {
  const [fwd, rev] = await Promise.all([
    redis.get(`skip_cd:${userId}:${partnerId}`),
    redis.get(`skip_cd:${partnerId}:${userId}`),
  ]);
  return Boolean(fwd || rev);
}

// ─── Wait-time tracking (for gender filter widening) ──────────────────────────
const WAIT_KEY    = (id) => `wait_time:${id}`;
const FILTER_WIDE = (id) => `filter_widened:${id}`;
const WAIT_WIDEN_MS = 60_000; // 60 seconds before widening filter

async function recordJoinTime(userId) {
  await redis.set(WAIT_KEY(userId), Date.now(), 'EX', 300);
}

async function clearJoinTime(userId) {
  await Promise.all([
    redis.del(WAIT_KEY(userId)),
    redis.del(FILTER_WIDE(userId)),
  ]);
}

async function isFilterWidened(userId) {
  return Boolean(await redis.get(FILTER_WIDE(userId)));
}

async function widenFilter(userId) {
  await redis.set(FILTER_WIDE(userId), '1', 'EX', 300);
  process.stdout.write(JSON.stringify({ level: 'info', event: 'filter_widened', userId }) + '\n');
}

async function hasWaitedTooLong(userId) {
  const joined = await redis.get(WAIT_KEY(userId));
  if (!joined) return false;
  return (Date.now() - parseInt(joined, 10)) > WAIT_WIDEN_MS;
}

// ─── Compatibility check (gender filter) ──────────────────────────────────────
async function isCompatible(userAId, userBId) {
  const { rows } = await db.query(
    `SELECT id, gender, preferred_gender FROM users WHERE id = ANY($1)`,
    [[userAId, userBId]],
  );

  const map = Object.fromEntries(rows.map(r => [r.id, r]));
  const a   = map[userAId];
  const b   = map[userBId];

  if (!a || !b) return false;

  // null/missing preferred_gender → treat as 'any'
  const aPref = a.preferred_gender || 'any';
  const bPref = b.preferred_gender || 'any';

  const aWantsB = aPref === 'any' || aPref === b.gender;
  const bWantsA = bPref === 'any' || bPref === a.gender;

  return aWantsB && bWantsA;
}

// ─── Core matchmaking ─────────────────────────────────────────────────────────
async function attemptMatch(io, _depth = 0) {
  // Safety guard: avoid infinite recursion if all pool members are on cooldown/incompatible
  if (_depth > 10) return;

  const poolLen = await presence.getPoolLength();
  if (poolLen < 2) return;

  const [userAId, userBId] = await presence.popTwoFromPool();

  if (!userAId || !userBId) {
    if (userAId) await presence.addToPool(userAId);
    if (userBId) await presence.addToPool(userBId);
    return;
  }

  // Validate both still connected
  const [socketAId, socketBId] = await Promise.all([
    presence.getUserSocket(userAId),
    presence.getUserSocket(userBId),
  ]);

  if (!socketAId && !socketBId) return attemptMatch(io, _depth + 1);
  if (!socketAId) { await presence.addToPool(userBId); return attemptMatch(io, _depth + 1); }
  if (!socketBId) { await presence.addToPool(userAId); return attemptMatch(io, _depth + 1); }

  // ── Block check ──────────────────────────────────────────────────────────────
  const blocked = await isBlocked(userAId, userBId);
  if (blocked) {
    const [dirA, dirB] = await Promise.all([
      getPoolPushDirection(userAId),
      getPoolPushDirection(userBId),
    ]);
    await redis[dirA.toLowerCase()]('searching_pool', userAId);
    await redis[dirB.toLowerCase()]('searching_pool', userBId);
    return attemptMatch(io, _depth + 1);
  }

  // ── Skip cooldown check ───────────────────────────────────────────────────────
  // If these two recently skipped each other, rotate them to the BACK of the pool
  // and try the next pair — so a 3rd (or 4th) user gets a chance immediately.
  const onCooldown = await hasSkipCooldown(userAId, userBId);
  if (onCooldown) {
    // Push to BACK of pool so the next pair at the front can be tried
    await redis.rpush('searching_pool', userAId, userBId);
    return attemptMatch(io, _depth + 1);
  }

  // ── Compatibility check (gender preference) ───────────────────────────────────
  const [widenedA, widenedB] = await Promise.all([
    isFilterWidened(userAId),
    isFilterWidened(userBId),
  ]);

  // Only skip compat if BOTH users have waited long enough to widen their filter
  if (!widenedA && !widenedB) {
    const compatible = await isCompatible(userAId, userBId);
    if (!compatible) {
      const [longA, longB] = await Promise.all([
        hasWaitedTooLong(userAId),
        hasWaitedTooLong(userBId),
      ]);
      if (longA) await widenFilter(userAId);
      if (longB) await widenFilter(userBId);

      // Put both back at the end of the pool and keep trying
      await redis.rpush('searching_pool', userAId, userBId);
      return attemptMatch(io, _depth + 1);
    }
  }

  // ── Commit the match ──────────────────────────────────────────────────────────
  await clearJoinTime(userAId);
  await clearJoinTime(userBId);
  await presence.setPair(userAId, userBId);

  const { rows } = await db.query(
    'SELECT id, display_name FROM users WHERE id = ANY($1)',
    [[userAId, userBId]],
  );
  const nameMap = Object.fromEntries(rows.map(r => [r.id, r.display_name || 'Anonymous']));

  // Create DB session record
  let sessionId;
  try {
    sessionId = await presence.createSession(userAId, userBId);
    await redis.hset('session_id_map', pairKey(userAId, userBId), sessionId);
  } catch (err) {
    process.stderr.write(`[MATCHMAKING] session create error: ${err.message}\n`);
  }

  io.to(socketAId).emit('match_found', { partnerId: userBId, partnerName: nameMap[userBId], sessionId });
  io.to(socketBId).emit('match_found', { partnerId: userAId, partnerName: nameMap[userAId], sessionId });

  process.stdout.write(
    `[MATCHMAKING] Matched ${nameMap[userAId]} ↔ ${nameMap[userBId]}\n`
  );

  // ── 10s ready confirmation timeout ───────────────────────────────────────────
  const key   = pairKey(userAId, userBId);
  const timer = setTimeout(async () => {
    readyTimeouts.delete(key);
    const [aReady, bReady] = await Promise.all([
      presence.isReady(userAId),
      presence.isReady(userBId),
    ]);

    if (!aReady && !bReady) {
      process.stdout.write(`[MATCHMAKING] Ready timeout for pair ${key} — requeueing\n`);
      await presence.clearReady(userAId, userBId);
      await presence.removePair(userAId, userBId);

      if (socketAId) io.to(socketAId).emit('partner_disconnected', { reason: 'ready_timeout' });
      if (socketBId) io.to(socketBId).emit('partner_disconnected', { reason: 'ready_timeout' });

      if (socketAId) { await presence.addToPool(userAId); await attemptMatch(io); }
      if (socketBId) { await presence.addToPool(userBId); await attemptMatch(io); }

      if (sessionId) await presence.endSession(sessionId, 'error');
    }
  }, 10_000);

  readyTimeouts.set(key, { timer, userAId, userBId, sessionId });
}

// ─── Ready confirmation ───────────────────────────────────────────────────────
async function resolveReadyConfirm(userId, io) {
  await presence.markReady(userId);

  const partnerId = await presence.getPartner(userId);
  if (!partnerId) return;

  const [userReady, partnerReady] = await Promise.all([
    presence.isReady(userId),
    presence.isReady(partnerId),
  ]);

  // Either user ready → connect both immediately
  if (userReady || partnerReady) {
    const key   = pairKey(userId, partnerId);
    const entry = readyTimeouts.get(key);
    if (entry) { clearTimeout(entry.timer); readyTimeouts.delete(key); }

    await presence.clearReady(userId, partnerId);
    await Promise.all([
      presence.setUserStatus(userId,    'in_call'),
      presence.setUserStatus(partnerId, 'in_call'),
    ]);

    const initiatorId = userId < partnerId ? userId : partnerId;

    const [socketUserId, socketPartnerId] = await Promise.all([
      presence.getUserSocket(userId),
      presence.getUserSocket(partnerId),
    ]);

    if (socketUserId)    io.to(socketUserId).emit('both_ready',    { initiator: userId    === initiatorId });
    if (socketPartnerId) io.to(socketPartnerId).emit('both_ready', { initiator: partnerId === initiatorId });
  }
}

module.exports = {
  attemptMatch, resolveReadyConfirm, pairKey, readyTimeouts,
  recordJoinTime, clearJoinTime, recordSkip,
};
