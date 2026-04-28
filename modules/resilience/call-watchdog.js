'use strict';

// NEW: [Area 2] Call Watchdog — finds and fixes stuck sessions/users

const db     = require('../../db');
const logger = console; // FIX: use console if logger module unavailable

/**
 * Watchdog — runs every 5 minutes to find stuck sessions and force-close them.
 * Also fixes users stuck in 'in_call' status with no active session.
 */
function startCallWatchdog(io) {
  setInterval(async () => {
    try {
      // 1. Find sessions running > 3 hours (likely stuck)
      const stuckSessions = await db.query(
        `SELECT s.id, s.user_a_id, s.user_b_id
         FROM sessions s
         WHERE s.ended_at IS NULL
         AND s.started_at < NOW() - INTERVAL '3 hours'`
      );

      for (const session of stuckSessions.rows) {
        logger.warn('[WATCHDOG] Force closing stuck session:', session.id);

        await db.query(
          `UPDATE sessions
           SET ended_at = NOW(),
               end_reason = 'watchdog_timeout',
               duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
           WHERE id = $1`,
          [session.id]
        );

        // FIX: [Area 2] Reset both users' status
        await db.query(
          `UPDATE users SET status = 'online'
           WHERE id = ANY($1::uuid[])
           AND status = 'in_call'`,
          [[session.user_a_id, session.user_b_id]]
        );
      }

      if (stuckSessions.rows.length > 0) {
        logger.warn(`[WATCHDOG] Closed ${stuckSessions.rows.length} stuck session(s)`);
      }

      // 2. Find users marked in_call but no active session
      const stuckUsers = await db.query(
        `SELECT u.id FROM users u
         WHERE u.status = 'in_call'
         AND NOT EXISTS (
           SELECT 1 FROM sessions s
           WHERE (s.user_a_id = u.id OR s.user_b_id = u.id)
           AND s.ended_at IS NULL
         )`
      );

      for (const user of stuckUsers.rows) {
        logger.warn('[WATCHDOG] Fixing stuck user status:', user.id);
        await db.query(
          `UPDATE users SET status = 'online' WHERE id = $1`,
          [user.id]
        );
      }

      if (stuckUsers.rows.length > 0) {
        logger.warn(`[WATCHDOG] Fixed ${stuckUsers.rows.length} stuck user(s)`);
      }

    } catch (err) {
      process.stderr.write(`[WATCHDOG] Error: ${err.message}\n`);
    }
  }, 5 * 60 * 1000); // every 5 minutes

  process.stdout.write('[WATCHDOG] Call watchdog started\n');
}

module.exports = { startCallWatchdog };
