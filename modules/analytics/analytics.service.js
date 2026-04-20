'use strict';

const db    = require('../../db');
const redis = require('../../db/redis');

// ─── Helper: build interval string from range param ───────────────────────────
function intervalFrom(range) {
  const map = { '24h': '24 hours', '7d': '7 days', '30d': '30 days' };
  if (!map[range]) throw Object.assign(new Error('Invalid range. Use 24h, 7d, or 30d'), { code: 'VALIDATION_ERROR' });
  return map[range];
}

// ─── 1. Total sessions ────────────────────────────────────────────────────────
async function getTotalSessions(range) {
  const interval = intervalFrom(range);
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM sessions
     WHERE started_at > NOW() - INTERVAL '${interval}'`,
  );
  return rows[0].total;
}

// ─── 2. Average call duration ─────────────────────────────────────────────────
async function getAverageCallDuration(range) {
  const interval = intervalFrom(range);
  const { rows } = await db.query(
    `SELECT ROUND(AVG(EXTRACT(EPOCH FROM (ended_at - started_at))))::int AS avg_seconds
     FROM sessions
     WHERE ended_at IS NOT NULL
       AND started_at > NOW() - INTERVAL '${interval}'`,
  );
  return rows[0].avg_seconds ?? 0;
}

// ─── 3. Active users right now ────────────────────────────────────────────────
async function getActiveUsersNow() {
  // Read from Redis socket map — counts currently connected sockets
  // Note: this reflects connected sockets, not DB status (faster + more accurate)
  const socketMap = await redis.hgetall('user_socket_map');
  const connected = socketMap ? Object.keys(socketMap).length : 0;

  // Break down by status from Redis pair map
  const pairMap = await redis.hgetall('active_pair_map');
  const inCall  = pairMap ? Math.floor(Object.keys(pairMap).length / 2) : 0;  // pairs stored bidirectionally

  const poolLen = await redis.llen('searching_pool');

  return {
    connected,
    inCall,
    searching: poolLen,
    online:    Math.max(0, connected - inCall * 2 - poolLen),
  };
}

// ─── 4. Peak hours ────────────────────────────────────────────────────────────
async function getPeakHours(range) {
  const interval = intervalFrom(range);
  const { rows } = await db.query(
    `SELECT EXTRACT(HOUR FROM started_at)::int AS hour,
            COUNT(*)::int                       AS session_count
     FROM sessions
     WHERE started_at > NOW() - INTERVAL '${interval}'
     GROUP BY hour
     ORDER BY hour ASC`,
  );
  // Ensure all 24 hours are represented (fill missing with 0)
  const map = Object.fromEntries(rows.map(r => [r.hour, r.session_count]));
  return Array.from({ length: 24 }, (_, h) => ({
    hour:          h,
    session_count: map[h] ?? 0,
  }));
}

// ─── 5. Disconnect reasons ────────────────────────────────────────────────────
async function getDisconnectReasons(range) {
  const interval = intervalFrom(range);
  const { rows } = await db.query(
    `SELECT end_reason,
            COUNT(*)::int AS count
     FROM sessions
     WHERE ended_at IS NOT NULL
       AND started_at > NOW() - INTERVAL '${interval}'
     GROUP BY end_reason`,
  );
  // Normalise into fixed shape
  const base = { user_disconnect: 0, skip: 0, error: 0, mutual_end: 0, null: 0 };
  rows.forEach(r => { base[r.end_reason ?? 'null'] = r.count; });
  return base;
}

// ─── 6. Retention rate ───────────────────────────────────────────────────────
async function getRetentionRate(range) {
  const interval = intervalFrom(range);
  const { rows } = await db.query(
    `WITH cohort AS (
       SELECT DISTINCT user_a_id AS user_id
       FROM sessions
       WHERE started_at > NOW() - INTERVAL '${interval}'
       UNION
       SELECT DISTINCT user_b_id
       FROM sessions
       WHERE started_at > NOW() - INTERVAL '${interval}'
     ),
     returned AS (
       SELECT c.user_id
       FROM cohort c
       JOIN sessions s ON (s.user_a_id = c.user_id OR s.user_b_id = c.user_id)
       GROUP BY c.user_id
       HAVING COUNT(s.id) > 1
     )
     SELECT
       (SELECT COUNT(*) FROM cohort)::int  AS total_users,
       (SELECT COUNT(*) FROM returned)::int AS retained_users`,
  );
  const { total_users, retained_users } = rows[0];
  const rate = total_users > 0 ? Math.round((retained_users / total_users) * 100) : 0;
  return { total_users, retained_users, rate_percent: rate };
}

// ─── 7. All metrics in one call ───────────────────────────────────────────────
async function getAllMetrics(range) {
  const [
    totalSessions,
    avgDuration,
    activeNow,
    peakHours,
    disconnectReasons,
    retention,
  ] = await Promise.all([
    getTotalSessions(range),
    getAverageCallDuration(range),
    getActiveUsersNow(),
    getPeakHours(range),
    getDisconnectReasons(range),
    getRetentionRate(range),
  ]);

  return {
    range,
    generatedAt:     new Date().toISOString(),
    totalSessions,
    avgCallDuration: avgDuration,
    activeNow,
    peakHours,
    disconnectReasons,
    retention,
  };
}

module.exports = {
  getTotalSessions,
  getAverageCallDuration,
  getActiveUsersNow,
  getPeakHours,
  getDisconnectReasons,
  getRetentionRate,
  getAllMetrics,
};
