'use strict';

const db    = require('../../db');
const redis = require('../../db/redis');

const TRUST_TTL  = 60 * 60;   // 1 hour
const TRUST_KEY  = (id) => `trust:${id}`;

// ─── Weighted average: recent ratings count more ──────────────────────────────
function weightedAverage(ratings) {
  if (!ratings.length) return 100;  // No ratings yet → neutral trust
  const n = ratings.length;
  let weightSum = 0;
  let valueSum  = 0;
  ratings.forEach((r, i) => {
    const weight = i + 1;         // Oldest = weight 1, newest = weight n
    valueSum  += r.rating * weight;
    weightSum += weight;
  });
  const avg   = valueSum / weightSum;  // 1–5 scale
  const score = Math.round(((avg - 1) / 4) * 100);   // Map 1–5 → 0–100
  return Math.min(100, Math.max(0, score));
}

// ─── Update trust score for a user ───────────────────────────────────────────
async function updateTrustScore(userId, { adminPenalty = 0 } = {}) {
  // Fetch last 20 ratings received
  const { rows } = await db.query(
    `SELECT rating FROM call_feedback
     WHERE reviewed_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [userId],
  );

  let score = weightedAverage(rows);

  // Apply admin penalty (e.g., from actioned reports)
  score = Math.max(0, score - adminPenalty);

  await db.query(
    `UPDATE users SET trust_score = $1 WHERE id = $2`,
    [score, userId],
  );

  // Cache for 1 hour
  await redis.setex(TRUST_KEY(userId), TRUST_TTL, score);

  // Auto soft ban check if score very low
  if (score < 20) {
    const { softBanCheck } = require('../moderation/report.service');
    softBanCheck(userId).catch(() => {});
  }

  return score;
}

// ─── Get trust score (cache-first) ────────────────────────────────────────────
async function getTrustScore(userId) {
  const cached = await redis.get(TRUST_KEY(userId));
  if (cached !== null) return parseInt(cached, 10);

  const { rows } = await db.query(
    `SELECT trust_score FROM users WHERE id = $1`,
    [userId],
  );
  if (!rows[0]) return 100;

  await redis.setex(TRUST_KEY(userId), TRUST_TTL, rows[0].trust_score);
  return rows[0].trust_score;
}

// ─── Determine pool push direction for matchmaking ────────────────────────────
// Returns 'LPUSH' (priority) or 'RPUSH' (deprioritized)
async function getPoolPushDirection(userId) {
  const score = await getTrustScore(userId);
  return score >= 70 ? 'LPUSH' : 'RPUSH';
}

module.exports = { updateTrustScore, getTrustScore, getPoolPushDirection };
