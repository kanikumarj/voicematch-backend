'use strict';

const db    = require('../../db');
const redis = require('../../db/redis');

// ─── Audit logger ──────────────────────────────────────────────────────────────
async function logAudit(action, targetType, targetId, detail, adminIp) {
  try {
    await db.query(
      `INSERT INTO admin_audit_log (action, target_type, target_id, detail, admin_ip)
       VALUES ($1, $2, $3, $4, $5)`,
      [action, targetType, targetId, detail ? JSON.stringify(detail) : null, adminIp]
    );
  } catch (err) {
    console.error('[ADMIN AUDIT] Log failed:', err.message);
  }
}

// ─── Overview ──────────────────────────────────────────────────────────────────
async function getOverview() {
  const [statusCounts, totalUsers, todayUsers, todayCalls, avgDuration] = await Promise.all([
    db.query(`SELECT status, COUNT(*)::int AS count FROM users GROUP BY status`),
    db.query(`SELECT COUNT(*)::int AS total FROM users`),
    db.query(`SELECT COUNT(*)::int AS count FROM users WHERE created_at >= CURRENT_DATE`),
    db.query(`SELECT COUNT(*)::int AS count FROM sessions WHERE started_at >= CURRENT_DATE`),
    db.query(`SELECT COALESCE(AVG(duration_seconds), 0)::int AS avg FROM sessions WHERE started_at >= CURRENT_DATE AND duration_seconds IS NOT NULL`),
  ]);

  const statusMap = {};
  statusCounts.rows.forEach(r => { statusMap[r.status] = r.count; });

  return {
    live: {
      online:    statusMap.online    || 0,
      in_call:   statusMap.in_call   || 0,
      searching: statusMap.searching || 0,
    },
    totalUsers:    totalUsers.rows[0].total,
    todayNewUsers: todayUsers.rows[0].count,
    todayCalls:    todayCalls.rows[0].count,
    avgDuration:   avgDuration.rows[0].avg,
  };
}

// ─── Users ─────────────────────────────────────────────────────────────────────
async function getUsers({ page = 1, limit = 20, search = '', filter = '' }) {
  const offset = (page - 1) * limit;
  let where = 'WHERE 1=1';
  const params = [];
  let idx = 1;

  if (search) {
    where += ` AND (u.email ILIKE $${idx} OR u.display_name ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }
  if (filter && filter !== 'all') {
    if (filter === 'unverified') {
      where += ` AND u.email_verified = false`;
    } else {
      where += ` AND u.status = $${idx}`;
      params.push(filter);
      idx++;
    }
  }

  const countQ = await db.query(`SELECT COUNT(*)::int AS total FROM users u ${where}`, params);
  const dataQ  = await db.query(
    `SELECT u.id, u.email, u.display_name, u.gender, u.age, u.status,
            u.trust_score, u.total_calls, u.created_at, u.email_verified, u.role
     FROM users u ${where}
     ORDER BY u.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { users: dataQ.rows, total: countQ.rows[0].total, page, limit };
}

async function getUserDetail(userId) {
  const userQ = await db.query(
    `SELECT id, email, display_name, gender, age, status, trust_score,
            total_calls, total_minutes, streak_count, created_at,
            email_verified, role, last_active_date, gender_filter, preferred_gender
     FROM users WHERE id = $1`, [userId]
  );
  if (!userQ.rows[0]) return null;

  const [calls, reports, friends] = await Promise.all([
    db.query(
      `SELECT s.id, s.started_at, s.ended_at, s.end_reason, s.duration_seconds,
              CASE WHEN s.user_a_id = $1 THEN ub.display_name ELSE ua.display_name END AS partner_name
       FROM sessions s
       LEFT JOIN users ua ON ua.id = s.user_a_id
       LEFT JOIN users ub ON ub.id = s.user_b_id
       WHERE s.user_a_id = $1 OR s.user_b_id = $1
       ORDER BY s.started_at DESC LIMIT 10`, [userId]
    ),
    db.query(
      `SELECT r.id, r.reason, r.detail, r.status, r.created_at,
              reporter.display_name AS reporter_name
       FROM user_reports r
       JOIN users reporter ON reporter.id = r.reporter_id
       WHERE r.reported_id = $1
       ORDER BY r.created_at DESC LIMIT 10`, [userId]
    ),
    db.query(
      `SELECT CASE WHEN f.user_a_id = $1 THEN ub.display_name ELSE ua.display_name END AS friend_name,
              CASE WHEN f.user_a_id = $1 THEN f.user_b_id ELSE f.user_a_id END AS friend_id,
              f.created_at
       FROM friendships f
       LEFT JOIN users ua ON ua.id = f.user_a_id
       LEFT JOIN users ub ON ub.id = f.user_b_id
       WHERE f.user_a_id = $1 OR f.user_b_id = $1
       ORDER BY f.created_at DESC`, [userId]
    ),
  ]);

  return {
    user:    userQ.rows[0],
    calls:   calls.rows,
    reports: reports.rows,
    friends: friends.rows,
  };
}

async function updateUserStatus(userId, status) {
  const { rows } = await db.query(
    `UPDATE users SET status = $1 WHERE id = $2 RETURNING id, status`,
    [status, userId]
  );
  return rows[0] || null;
}

async function banUser(userId, { banType, reason, expiresAt }) {
  const expires = banType === 'soft' && expiresAt ? expiresAt
    : banType === 'soft' ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    : null;

  await db.query(
    `INSERT INTO user_bans (user_id, ban_type, reason, expires_at, banned_by)
     VALUES ($1, $2, $3, $4, 'admin')
     ON CONFLICT (user_id) DO UPDATE
       SET ban_type = EXCLUDED.ban_type, reason = EXCLUDED.reason,
           expires_at = EXCLUDED.expires_at, banned_by = 'admin'`,
    [userId, banType, reason || 'Admin action', expires]
  );

  await db.query(`UPDATE users SET status = 'banned' WHERE id = $1`, [userId]);
  await redis.lrem('searching_pool', 0, userId);

  return { success: true };
}

async function unbanUser(userId) {
  await db.query(`DELETE FROM user_bans WHERE user_id = $1`, [userId]);
  await db.query(`UPDATE users SET status = 'offline' WHERE id = $1`, [userId]);
  return { success: true };
}

// ─── Live Calls ────────────────────────────────────────────────────────────────
async function getLiveCalls() {
  const { rows } = await db.query(
    `SELECT s.id, s.started_at,
            ua.id AS user_a_id, ua.display_name AS user_a_name, ua.email AS user_a_email,
            ub.id AS user_b_id, ub.display_name AS user_b_name, ub.email AS user_b_email
     FROM sessions s
     JOIN users ua ON ua.id = s.user_a_id
     JOIN users ub ON ub.id = s.user_b_id
     WHERE s.ended_at IS NULL
     ORDER BY s.started_at ASC`
  );
  return rows;
}

async function forceEndCall(sessionId) {
  const { rows } = await db.query(
    `UPDATE sessions SET ended_at = NOW(), end_reason = 'error'
     WHERE id = $1 AND ended_at IS NULL
     RETURNING user_a_id, user_b_id`,
    [sessionId]
  );
  if (!rows[0]) return null;

  await db.query(`UPDATE users SET status = 'online' WHERE id IN ($1, $2)`,
    [rows[0].user_a_id, rows[0].user_b_id]);

  return rows[0];
}

// ─── Reports ───────────────────────────────────────────────────────────────────
async function getReports({ status = 'pending', page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const [dataQ, countQ] = await Promise.all([
    db.query(
      `SELECT r.id, r.reason, r.detail, r.status, r.created_at,
              reporter.display_name AS reporter_name, reporter.email AS reporter_email,
              reported.display_name AS reported_name, reported.email AS reported_email,
              r.reporter_id, r.reported_id
       FROM user_reports r
       JOIN users reporter ON reporter.id = r.reporter_id
       JOIN users reported ON reported.id = r.reported_id
       WHERE r.status = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    ),
    db.query(`SELECT COUNT(*)::int AS total FROM user_reports WHERE status = $1`, [status]),
  ]);
  return { reports: dataQ.rows, total: countQ.rows[0].total, page, limit };
}

async function updateReport(reportId, newStatus) {
  const { rows } = await db.query(
    `UPDATE user_reports SET status = $1 WHERE id = $2 RETURNING *`,
    [newStatus, reportId]
  );
  return rows[0] || null;
}

// ─── Banned ────────────────────────────────────────────────────────────────────
async function getBannedUsers({ page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const [dataQ, countQ] = await Promise.all([
    db.query(
      `SELECT b.id, b.ban_type, b.reason, b.banned_at, b.expires_at, b.banned_by,
              u.id AS user_id, u.email, u.display_name
       FROM user_bans b
       JOIN users u ON u.id = b.user_id
       ORDER BY b.banned_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    db.query(`SELECT COUNT(*)::int AS total FROM user_bans`),
  ]);
  return { bans: dataQ.rows, total: countQ.rows[0].total, page, limit };
}

// ─── Analytics ─────────────────────────────────────────────────────────────────
async function getAnalytics(range = '7d') {
  const days = range === '30d' ? 30 : range === '24h' ? 1 : 7;

  const [dailyUsers, dailyCalls, callsByHour, endReasons] = await Promise.all([
    db.query(
      `SELECT DATE(created_at) AS date, COUNT(*)::int AS count
       FROM users WHERE created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at) ORDER BY date`
    ),
    db.query(
      `SELECT DATE(started_at) AS date, COUNT(*)::int AS count
       FROM sessions WHERE started_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(started_at) ORDER BY date`
    ),
    db.query(
      `SELECT EXTRACT(HOUR FROM started_at)::int AS hour, COUNT(*)::int AS count
       FROM sessions WHERE started_at >= NOW() - INTERVAL '${days} days'
       GROUP BY hour ORDER BY hour`
    ),
    db.query(
      `SELECT COALESCE(end_reason, 'unknown') AS reason, COUNT(*)::int AS count
       FROM sessions WHERE started_at >= NOW() - INTERVAL '${days} days'
       GROUP BY end_reason`
    ),
  ]);

  return {
    dailyUsers: dailyUsers.rows,
    dailyCalls: dailyCalls.rows,
    callsByHour: callsByHour.rows,
    endReasons: endReasons.rows,
  };
}

// ─── System ────────────────────────────────────────────────────────────────────
async function getSystemHealth() {
  let dbOk = false, redisOk = false;

  try { await db.query('SELECT 1'); dbOk = true; } catch {}

  try {
    const pong = await redis.ping();
    redisOk = pong === 'PONG' || pong != null;
  } catch {}

  return {
    database: { connected: dbOk, type: 'PostgreSQL (Neon)' },
    redis:    { connected: redisOk, type: 'Upstash Redis' },
    uptime:   process.uptime(),
    nodeEnv:  process.env.NODE_ENV || 'development',
  };
}

async function getAuditLog({ page = 1, limit = 50 }) {
  const offset = (page - 1) * limit;
  const { rows } = await db.query(
    `SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

module.exports = {
  logAudit,
  getOverview,
  getUsers, getUserDetail, updateUserStatus, banUser, unbanUser,
  getLiveCalls, forceEndCall,
  getReports, updateReport,
  getBannedUsers,
  getAnalytics,
  getSystemHealth, getAuditLog,
};
