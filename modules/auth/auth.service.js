
'use strict';

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { z }  = require('zod');
const db     = require('../../db');

const SALT_ROUNDS = 12;

// ─── Custom error factory ─────────────────────────────────────────────────────
function appError(code, message) {
  const err  = new Error(message);
  err.code   = code;
  return err;
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────
const registerSchema = z.object({
  email:       z.string().email('Invalid email format').max(255).optional().nullable(),
  username:    z.string().min(3, 'Username must be at least 3 characters').max(50).optional().nullable(),
  password:    z.string().min(8, 'Password must be at least 8 characters').max(128),
  displayName: z.string().optional().nullable(),
}).refine(data => data.email || data.username, {
  message: "Either email or username is required",
  path: ["identifier"]
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password:   z.string().min(1, 'Password is required'),
});

const onboardingSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name cannot be empty')
    .max(100, 'Display name too long'),
  age: z
    .number({ invalid_type_error: 'Age must be a number' })
    .int()
    .min(13, 'Minimum age is 13')
    .max(120, 'Age out of valid range'),
  gender: z
    .string()
    .trim()
    .min(1, 'Gender cannot be empty')
    .max(20, 'Gender value too long'),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function signToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

function safePublicUser(row) {
  return {
    id:          row.id,
    email:       row.email,
    displayName: row.display_name,
    age:         row.age,
    gender:      row.gender,
    isOnboarded: row.is_onboarded,
    status:      row.status,
  };
}

// ─── Register ────────────────────────────────────────────────────────────────
async function registerUser(body) {
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    throw appError('VALIDATION_ERROR', parsed.error.issues[0].message);
  }

  const { email, username, password, displayName } = parsed.data;
  const normalizedEmail = email ? email.toLowerCase().trim() : null;
  const normalizedUsername = username ? username.trim() : null;

  // Duplicate check
  if (normalizedEmail) {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) throw appError('EMAIL_EXISTS', 'An account with this email already exists');
  }
  if (normalizedUsername) {
    const existing = await db.query('SELECT id FROM users WHERE username = $1', [normalizedUsername]);
    if (existing.rows.length > 0) throw appError('USERNAME_EXISTS', 'Username already taken');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const finalDisplayName = displayName || normalizedUsername || (normalizedEmail ? normalizedEmail.split('@')[0] : 'User');

  let insertedUser;
  try {
    const { rows } = await db.query(
      `INSERT INTO users (email, username, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, username, is_onboarded`,
      [normalizedEmail, normalizedUsername, passwordHash, finalDisplayName],
    );
    insertedUser = rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw appError('UNIQUE_EXISTS', 'An account with this email or username already exists');
    }
    throw err;
  }

  const token = signToken({ id: insertedUser.id, email: insertedUser.email });

  if (normalizedEmail) {
    const { sendVerificationEmail } = require('../email/email.service');
    sendVerificationEmail(insertedUser.id, normalizedEmail).catch((err) => {
      process.stderr.write(`[EMAIL] Verification send failed for ${insertedUser.id}: ${err.message}\n`);
    });
  }

  return {
    userId:        insertedUser.id,
    token,
    emailVerified: false,
  };
}

// ─── Login ───────────────────────────────────────────────────────────────────
async function loginUser(body) {
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw appError('VALIDATION_ERROR', parsed.error.issues[0].message);
  }

  const { identifier, password } = parsed.data;
  const normalizedIdentifier     = identifier.toLowerCase().trim();

  const { rows } = await db.query(
    `SELECT id, email, username, password_hash, is_onboarded 
     FROM users 
     WHERE email = $1 OR username = $1`,
    [normalizedIdentifier],
  );

  const dummyHash = '$2b$12$invalidhashpadding000000000000000000000000000000000000000';
  const user      = rows[0] || null;
  const hashToCompare = user ? user.password_hash : dummyHash;

  const isValid = await bcrypt.compare(password, hashToCompare);

  if (!user || !isValid) {
    throw appError('INVALID_CREDENTIALS', 'Invalid email, username, or password');
  }

  const token = signToken({ id: user.id, email: user.email });

  return {
    token,
    user: {
      id:          user.id,
      email:       user.email,
      isOnboarded: user.is_onboarded,
    },
  };
}

// ─── Onboarding ──────────────────────────────────────────────────────────────
async function completeOnboarding(userId, body) {
  // Coerce age to number if sent as string from JSON body
  const coercedBody = {
    ...body,
    age: body.age !== undefined ? Number(body.age) : body.age,
  };

  const parsed = onboardingSchema.safeParse(coercedBody);
  if (!parsed.success) {
    throw appError('VALIDATION_ERROR', parsed.error.issues[0].message);
  }

  const { displayName, age, gender } = parsed.data;

  // Fetch current onboarding state
  const { rows } = await db.query(
    'SELECT is_onboarded FROM users WHERE id = $1',
    [userId],
  );

  if (!rows[0]) throw appError('VALIDATION_ERROR', 'User not found');

  if (rows[0].is_onboarded) {
    throw appError('ALREADY_ONBOARDED', 'Onboarding has already been completed');
  }

  const { rows: updated } = await db.query(
    `UPDATE users
     SET display_name  = $1,
         age           = $2,
         gender        = $3,
         is_onboarded  = true
     WHERE id = $4
       AND is_onboarded = false
     RETURNING id, email, display_name, age, gender, is_onboarded, status`,
    [displayName, age, gender, userId],
  );

  // If 0 rows updated the user was already onboarded (race condition)
  if (!updated[0]) {
    throw appError('ALREADY_ONBOARDED', 'Onboarding has already been completed');
  }

  return {
    success: true,
    user:    safePublicUser(updated[0]),
  };
}

// ─── Get user by ID (for /me route) ──────────────────────────────────────────
async function getUserById(userId) {
  const { rows } = await db.query(
    `SELECT id, email, display_name, age, gender, is_onboarded, status
     FROM users
     WHERE id = $1`,
    [userId],
  );

  return rows[0] ? safePublicUser(rows[0]) : null;
}

// ─── Google OAuth ────────────────────────────────────────────────────────────
async function findOrCreateGoogleUser({ googleId, email, displayName, avatar }) {
  let user = await db.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
  if (user.rows[0]) return user.rows[0];

  if (email) {
    user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (user.rows[0]) {
      await db.query('UPDATE users SET google_id = $1 WHERE email = $2', [googleId, email]);
      return user.rows[0];
    }
  }

  const newUser = await db.query(`
    INSERT INTO users (email, display_name, google_id, avatar, email_verified)
    VALUES ($1, $2, $3, $4, true)
    RETURNING *
  `, [email || null, displayName, googleId, avatar]);
  
  return newUser.rows[0];
}

module.exports = {
  registerUser,
  loginUser,
  completeOnboarding,
  getUserById,
  findOrCreateGoogleUser,
};
