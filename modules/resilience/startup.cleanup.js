'use strict';

/**
 * modules/resilience/startup.cleanup.js
 *
 * Runs once on server start.
 * Resets stale DB state left over from a previous crash/restart.
 * Clears transient Redis keys that would cause ghost users.
 */

const db    = require('../../db');
const redis = require('../../db/redis');

async function runStartupCleanup() {
  process.stdout.write('[STARTUP] Running cleanup…\n');

  try {
    // ── 1. Reset stale user statuses in PostgreSQL ───────────────────────────
    const { rowCount } = await db.query(
      `UPDATE users
       SET status = 'offline'
       WHERE status IN ('searching', 'in_call', 'online')`,
    );
    process.stdout.write(`[STARTUP] Reset ${rowCount} stale user status(es) to offline\n`);

    // ── 2. Clear the matchmaking pool ────────────────────────────────────────
    await redis.del('searching_pool');
    process.stdout.write('[STARTUP] Cleared searching_pool\n');

    // ── 3. Clear user_socket_map (all sockets are gone on restart) ───────────
    await redis.del('user_socket_map');
    process.stdout.write('[STARTUP] Cleared user_socket_map\n');

    // ── 4. Clear session_id_map ───────────────────────────────────────────────
    await redis.del('session_id_map');
    process.stdout.write('[STARTUP] Cleared session_id_map\n');

    // ── 5. SCAN + DEL transient key patterns ─────────────────────────────────
    const patterns = [
      'heartbeat:*',
      'reconnect_window:*',
      'ready:*',
      'pair:*',
      'wait_time:*',
      'filter_widened:*',
    ];

    for (const pattern of patterns) {
      let cursor = '0';
      let deleted = 0;
      do {
        const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        if (!result) break; // FIXED: Handles null if Redis is offline/not connected
        
        const [nextCursor, keys] = result;
        cursor = nextCursor;
        if (keys && keys.length) {
          await redis.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== '0');
      if (deleted) process.stdout.write(`[STARTUP] Deleted ${deleted} keys matching ${pattern}\n`);
    }

    // ── 6. Close open sessions left from crash ────────────────────────────────
    await db.query(
      `UPDATE sessions
       SET ended_at = NOW(), end_reason = 'error'
       WHERE ended_at IS NULL`,
    );

    process.stdout.write('[STARTUP] Cleanup complete ✓\n');
  } catch (err) {
    process.stderr.write(`[STARTUP] Cleanup failed: ${err.message}\n`);
    // Non-fatal — server continues booting
  }
}

module.exports = { runStartupCleanup };
