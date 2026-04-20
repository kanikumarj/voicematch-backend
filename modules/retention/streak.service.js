'use strict';

const db    = require('../../db');
const redis = require('../../db/redis');

// ─── Update streak after a completed call ─────────────────────────────────────
async function updateStreak(userId) {
  const { rows } = await db.query(
    `SELECT streak_count, last_active_date FROM users WHERE id = $1`,
    [userId],
  );

  if (!rows[0]) return;

  const { streak_count: current, last_active_date: lastDate } = rows[0];
  const today     = new Date().toISOString().slice(0, 10);   // YYYY-MM-DD
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  let newStreak = current;

  if (!lastDate) {
    newStreak = 1;                     // First ever call
  } else if (lastDate === today) {
    return;                            // Already counted today — no change
  } else if (lastDate === yesterday) {
    newStreak = current + 1;           // Consecutive day — extend streak
  } else {
    newStreak = 1;                     // Gap detected — reset streak
  }

  await db.query(
    `UPDATE users
     SET streak_count = $1, last_active_date = $2
     WHERE id = $3`,
    [newStreak, today, userId],
  );

  // Emit milestone event if applicable
  const MILESTONES = [3, 7, 14, 30];
  if (MILESTONES.includes(newStreak)) {
    const socketId = await redis.hget('user_socket_map', userId);
    if (socketId) {
      const { getIO } = require('../../socket/socket.server');
      try {
        getIO().to(socketId).emit('streak_milestone', {
          streak: newStreak,
          message: `🔥 ${newStreak} day streak! Keep it up.`,
        });
      } catch { /* socket may have disconnected */ }
    }
  }

  return newStreak;
}

module.exports = { updateStreak };
