'use strict';

const db = require('../../db');

// ─── Get own profile + stats ──────────────────────────────────────────────────
async function getProfile(userId) {
  const { rows } = await db.query(
    `SELECT
       u.id,
       u.display_name,
       u.age,
       u.gender,
       u.gender_filter,
       u.preferred_gender,
       u.trust_score,
       u.total_calls,
       u.total_minutes,
       u.streak_count,
       u.last_active_date,
       u.created_at                      AS member_since,
       u.role,
       u.username,
       u.profile_public,
       ROUND(AVG(f.rating)::numeric, 1)  AS avg_rating,
       COUNT(f.id)::int                  AS rating_count
     FROM users u
     LEFT JOIN call_feedback f ON f.reviewed_id = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId],
  );

  if (!rows[0]) throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
  return rows[0];
}

// ─── Update own profile ───────────────────────────────────────────────────────
const ALLOWED_FIELDS = new Set([
  'display_name', 'age', 'gender', 'gender_filter', 'preferred_gender',
]);

const GENDER_VALUES = ['any', 'male', 'female', 'other'];

function validateProfileUpdate(data) {
  const errors = [];

  if (data.display_name !== undefined) {
    const d = String(data.display_name).trim();
    if (!d || d.length > 50) errors.push('displayName must be 1–50 characters');
  }

  if (data.age !== undefined) {
    const a = parseInt(data.age, 10);
    if (isNaN(a) || a < 18 || a > 99) errors.push('Age must be between 18 and 99');
  }

  if (data.gender !== undefined && !GENDER_VALUES.includes(data.gender)) {
    errors.push('Invalid gender value');
  }
  if (data.gender_filter !== undefined && !GENDER_VALUES.includes(data.gender_filter)) {
    errors.push('Invalid genderFilter value');
  }
  if (data.preferred_gender !== undefined && !GENDER_VALUES.includes(data.preferred_gender)) {
    errors.push('Invalid preferredGender value');
  }

  return errors;
}

async function updateProfile(userId, updates) {
  // Map camelCase → snake_case
  const fieldMap = {
    displayName:     'display_name',
    age:             'age',
    gender:          'gender',
    genderFilter:    'gender_filter',
    preferredGender: 'preferred_gender',
  };

  const cols   = [];
  const values = [];
  let   idx    = 1;

  const validationErrors = validateProfileUpdate(
    Object.fromEntries(
      Object.entries(updates)
        .filter(([k]) => fieldMap[k])
        .map(([k, v]) => [fieldMap[k], v]),
    ),
  );

  if (validationErrors.length) {
    throw Object.assign(new Error(validationErrors.join('; ')), { code: 'VALIDATION_ERROR' });
  }

  Object.entries(updates).forEach(([key, val]) => {
    const col = fieldMap[key];
    if (!col) return;
    cols.push(`${col} = $${idx++}`);
    values.push(key === 'displayName' ? String(val).trim() : val);
  });

  if (!cols.length) {
    throw Object.assign(new Error('No valid fields to update'), { code: 'VALIDATION_ERROR' });
  }

  values.push(userId);
  const { rows } = await db.query(
    `UPDATE users SET ${cols.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );

  return rows[0];
}

// ─── Delete own account ────────────────────────────────────────────────────────
async function deleteAccount(userId) {
  // Cascade deletes handle sessions, feedback, blocks via FK
  await db.query(`DELETE FROM users WHERE id = $1`, [userId]);
  return { success: true };
}

module.exports = { getProfile, updateProfile, deleteAccount };
