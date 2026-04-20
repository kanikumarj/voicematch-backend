'use strict';

const db    = require('../../db');
const redis = require('../../db/redis');
const { captureException } = require('../../config/sentry');

// ─── Lua: atomic report count check + soft ban trigger guard ─────────────────
// Returns 1 if threshold crossed for the first time (prevents double-trigger)
const REPORT_THRESHOLD_LUA = `
local key   = KEYS[1]
local ttl   = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local count = redis.call('INCR', key)
if count == 1 then redis.call('EXPIRE', key, ttl) end
if count == limit then return 1 end
return 0
`;

let reportThresholdSha = null;

async function getReportThresholdSha() {
  if (reportThresholdSha) return reportThresholdSha;
  reportThresholdSha = await redis.script('LOAD', REPORT_THRESHOLD_LUA);
  return reportThresholdSha;
}

// ─── Create report ────────────────────────────────────────────────────────────
async function createReport(reporterId, reportedId, sessionId, reason, detail) {
  // Insert report record
  await db.query(
    `INSERT INTO user_reports (reporter_id, reported_id, session_id, reason, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [reporterId, reportedId, sessionId, reason, detail],
  );

  process.stdout.write(JSON.stringify({
    level: 'info', event: 'user_reported', reportedId, reason,
  }) + '\n');

  // Atomic: increment 7-day rolling count + check threshold
  const key   = `report_count:${reportedId}`;
  const ttl   = 7 * 24 * 60 * 60;  // 7 days in seconds
  const limit = 3;

  try {
    const sha       = await getReportThresholdSha();
    const triggered = await redis.evalsha(sha, 1, key, ttl, limit);

    if (triggered === 1) {
      await softBanCheck(reportedId);
    }
  } catch (err) {
    if (err.message?.includes('NOSCRIPT')) {
      reportThresholdSha = null;  // Reload on next call
    }
    captureException(err, { context: 'createReport.thresholdCheck' });
  }
}

// ─── Soft ban check ───────────────────────────────────────────────────────────
async function softBanCheck(userId) {
  const { rows } = await db.query(
    `SELECT trust_score, status FROM users WHERE id = $1`,
    [userId],
  );

  if (!rows[0]) return;
  if (rows[0].status === 'banned') return;   // Already banned — idempotent

  const { trust_score } = rows[0];

  // Threshold: 3+ reports AND trust_score < 40
  const { rows: reportRows } = await db.query(
    `SELECT COUNT(*)::int AS cnt
     FROM user_reports
     WHERE reported_id = $1
       AND status = 'pending'
       AND created_at > NOW() - INTERVAL '7 days'`,
    [userId],
  );

  const reportCount = reportRows[0].cnt;

  if (reportCount >= 3 && trust_score < 40) {
    // Apply soft ban
    await db.query(
      `INSERT INTO user_bans (user_id, ban_type, reason, expires_at)
       VALUES ($1, 'soft', 'auto: threshold exceeded', NOW() + INTERVAL '48 hours')
       ON CONFLICT (user_id) DO NOTHING`,   // Idempotent — skip if already banned
      [userId],
    );

    await db.query(
      `UPDATE users SET status = 'banned' WHERE id = $1`,
      [userId],
    );

    // Remove from pool if currently searching
    await redis.lrem('searching_pool', 0, userId);

    // Notify if online
    const socketId = await redis.hget('user_socket_map', userId);
    if (socketId) {
      const { getIO } = require('../../socket/socket.server');
      try {
        getIO().to(socketId).emit('account_suspended', {
          message: 'Your account has been temporarily suspended.',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        });
      } catch { /* socket may have disconnected */ }
    }

    process.stderr.write(JSON.stringify({
      level: 'warn', event: 'soft_ban_applied', userId,
    }) + '\n');
  }
}

// ─── Admin: list reports ──────────────────────────────────────────────────────
async function listReports({ status = 'pending', page = 1, limit = 25 } = {}) {
  const offset = (page - 1) * limit;
  const { rows } = await db.query(
    `SELECT r.id, r.reason, r.detail, r.status, r.created_at,
            reporter.display_name AS reporter_name,
            reported.display_name AS reported_name,
            r.reported_id
     FROM user_reports r
     JOIN users reporter ON reporter.id = r.reporter_id
     JOIN users reported ON reported.id = r.reported_id
     WHERE r.status = $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [status, limit, offset],
  );
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM user_reports WHERE status = $1`,
    [status],
  );
  return { reports: rows, total: countRows[0].total, page, limit };
}

// ─── Admin: action a report ───────────────────────────────────────────────────
async function actionReport(reportId, { status, banType }) {
  const { rows } = await db.query(
    `UPDATE user_reports SET status = $1 WHERE id = $2 RETURNING reported_id`,
    [status, reportId],
  );
  if (!rows[0]) throw Object.assign(new Error('Report not found'), { code: 'NOT_FOUND' });

  if (status === 'actioned' && banType) {
    const { reported_id: userId } = rows[0];
    const expires = banType === 'soft' ? `NOW() + INTERVAL '48 hours'` : 'NULL';
    await db.query(
      `INSERT INTO user_bans (user_id, ban_type, reason, expires_at, banned_by)
       VALUES ($1, $2, 'admin: report actioned',
         ${banType === 'soft' ? 'NOW() + INTERVAL \'48 hours\'' : 'NULL'}, 'admin')
       ON CONFLICT (user_id) DO UPDATE
         SET ban_type = EXCLUDED.ban_type,
             expires_at = EXCLUDED.expires_at,
             banned_by  = 'admin'`,
      [userId, banType],
    );
    await db.query(`UPDATE users SET status = 'banned' WHERE id = $1`, [userId]);

    // Trust score penalty for actioned report
    const { updateTrustScore } = require('../moderation/trust.service');
    await updateTrustScore(userId, { adminPenalty: 10 });
  }

  return { success: true };
}

module.exports = { createReport, softBanCheck, listReports, actionReport };
