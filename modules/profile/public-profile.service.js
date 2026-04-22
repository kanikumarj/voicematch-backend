'use strict';

// NEW: [Feature 4 — Public Profile Service]

const db = require('../../db');

async function generateUsername(displayName) {
  const base = (displayName || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 30);

  if (!base) return `user-${Date.now().toString().slice(-6)}`;

  // Check if available
  const check = await db.query('SELECT id FROM users WHERE username = $1', [base]);
  if (check.rows.length === 0) return base;

  // Append random 4 digits
  let attempts = 0;
  while (attempts < 10) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${base}-${suffix}`;
    const c = await db.query('SELECT id FROM users WHERE username = $1', [candidate]);
    if (c.rows.length === 0) return candidate;
    attempts++;
  }

  // Fallback: timestamp
  return `${base}-${Date.now().toString().slice(-6)}`;
}

function getPersonalityTag({ totalCalls, averageRating, totalMinutes, streakCount }) {
  if (totalCalls < 10) return 'New Voice';
  if (totalCalls >= 100 && averageRating >= 4.5) return 'The Legend';
  if (averageRating >= 4.5) return 'The Charmer';
  if (totalCalls >= 100 && averageRating >= 4.0) return 'The Storyteller';
  if (totalMinutes >= 500) return 'The Deep Talker';
  if (streakCount >= 14) return 'The Dedicated';
  if (streakCount >= 7) return 'The Regular';
  if (totalCalls >= 50) return 'The Explorer';
  return 'Voice Explorer';
}

async function getPublicProfile(username) {
  const result = await db.query(
    `SELECT
       u.id,
       u.display_name,
       u.username,
       u.streak_count,
       u.total_calls,
       u.total_minutes,
       u.profile_public,
       u.created_at AS member_since,
       COALESCE(AVG(cf.rating)::numeric(3,1), 0) AS average_rating
     FROM users u
     LEFT JOIN call_feedback cf ON cf.reviewed_id = u.id
     WHERE u.username = $1
     GROUP BY u.id`,
    [username]
  );

  if (result.rows.length === 0) return null;

  const user = result.rows[0];
  if (!user.profile_public) return null;

  const personalityTag = getPersonalityTag({
    totalCalls:    user.total_calls || 0,
    averageRating: parseFloat(user.average_rating) || 0,
    totalMinutes:  user.total_minutes || 0,
    streakCount:   user.streak_count || 0,
  });

  return {
    displayName:   user.display_name,
    username:      user.username,
    streakCount:   user.streak_count || 0,
    totalCalls:    user.total_calls || 0,
    totalMinutes:  user.total_minutes || 0,
    averageRating: (parseFloat(user.average_rating) || 0).toFixed(1),
    personalityTag,
    memberSince:   user.member_since,
    isPublic:      user.profile_public,
  };
}

async function assignUsername(userId, displayName) {
  // Check if already has username
  const existing = await db.query('SELECT username FROM users WHERE id = $1', [userId]);
  if (existing.rows[0]?.username) return existing.rows[0].username;

  const username = await generateUsername(displayName);
  await db.query('UPDATE users SET username = $1 WHERE id = $2', [username, userId]);
  return username;
}

async function toggleProfilePublic(userId, isPublic) {
  await db.query('UPDATE users SET profile_public = $1 WHERE id = $2', [isPublic, userId]);
  return { success: true };
}

module.exports = {
  getPublicProfile,
  assignUsername,
  toggleProfilePublic,
  getPersonalityTag,
};
