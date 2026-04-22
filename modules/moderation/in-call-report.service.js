'use strict';

// NEW: [Feature 1 — In-Call Report Service]

const db = require('../../db');

const submitInCallReport = async ({ reporterId, reportedId, sessionId, reason }) => {
  // Validate both users are in same session
  const sessionCheck = await db.query(
    `SELECT id FROM sessions
     WHERE id = $1
     AND (user_a_id = $2 OR user_b_id = $2)
     AND (user_a_id = $3 OR user_b_id = $3)
     AND ended_at IS NULL`,
    [sessionId, reporterId, reportedId]
  );

  if (sessionCheck.rows.length === 0) {
    throw new Error('Invalid session or users not in same call');
  }

  // Check if already reported this session
  const existingCheck = await db.query(
    `SELECT id FROM user_reports
     WHERE reporter_id = $1
     AND session_id = $2
     AND source = 'in_call'`,
    [reporterId, sessionId]
  );

  if (existingCheck.rows.length > 0) {
    throw new Error('Already reported this session');
  }

  // Insert report
  await db.query(
    `INSERT INTO user_reports
     (reporter_id, reported_id, session_id, reason, source, status)
     VALUES ($1, $2, $3, $4, 'in_call', 'pending')`,
    [reporterId, reportedId, sessionId, reason]
  );

  // Flag the session
  await db.query(
    `UPDATE sessions
     SET is_flagged = true, flag_reason = $1
     WHERE id = $2`,
    [reason, sessionId]
  );

  // Count reports in last 7 days
  const reportCount = await db.query(
    `SELECT COUNT(*) as count FROM user_reports
     WHERE reported_id = $1
     AND created_at > NOW() - INTERVAL '7 days'`,
    [reportedId]
  );

  const count = parseInt(reportCount.rows[0].count);

  process.stdout.write(JSON.stringify({
    level: 'info',
    event: 'in_call_report',
    reporterId, reportedId, sessionId, reason, totalReports: count
  }) + '\n');

  // Auto soft-ban check if threshold exceeded
  if (count >= 3) {
    const trustCheck = await db.query(
      `SELECT trust_score FROM users WHERE id = $1`,
      [reportedId]
    );
    const trust = trustCheck.rows[0]?.trust_score || 100;
    if (trust < 40) {
      await db.query(
        `INSERT INTO user_bans
         (user_id, ban_type, reason, expires_at, banned_by)
         VALUES ($1, 'soft', 'auto: in_call report threshold',
                 NOW() + INTERVAL '48 hours', 'system')
         ON CONFLICT (user_id) DO NOTHING`,
        [reportedId]
      );
      await db.query(
        `UPDATE users SET status = 'banned' WHERE id = $1`,
        [reportedId]
      );
      process.stderr.write(`[AUTO BAN] userId=${reportedId} reason=in_call_threshold\n`);
    }
  }

  return { success: true, totalReports: count };
};

module.exports = { submitInCallReport };
