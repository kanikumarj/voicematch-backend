'use strict';

const db = require('../../db');

async function updateStreak(userId) {
  const user = await db.query(
    'SELECT streak_count, streak_last_date, streak_best FROM users WHERE id = $1',
    [userId]
  );
  if (!user.rows[0]) return 0;
  
  const { streak_count, streak_last_date, streak_best } = user.rows[0];
  const today = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date(Date.now() - 86400000);
  const yesterday = yesterdayDate.toISOString().split('T')[0];

  // Convert Date object from DB to string if needed
  const lastDateStr = streak_last_date ? new Date(streak_last_date).toISOString().split('T')[0] : null;

  let newStreak = streak_count || 0;

  if (lastDateStr === today) {
    return newStreak; // already counted today
  } else if (lastDateStr === yesterday) {
    newStreak = newStreak + 1; // continue streak
  } else {
    newStreak = 1; // streak reset
  }

  await db.query(`
    UPDATE users SET
      streak_count = $1,
      streak_last_date = $2,
      streak_best = GREATEST(COALESCE(streak_best, 0), $1)
    WHERE id = $3
  `, [newStreak, today, userId]);

  return newStreak;
}

module.exports = { updateStreak };
