
'use strict';

const bcrypt = require('bcrypt');
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
  email:    z.string().email('Invalid email format').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  email:    z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
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

  const { email, password } = parsed.data;
  const normalizedEmail     = email.toLowerCase().trim();

  // Duplicate email — early exit
  const existing = await db.query(
    'SELECT id FROM users WHERE email = $1',
    [normalizedEmail],
  );
  if (existing.rows.length > 0) {
    throw appError('EMAIL_EXISTS', 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  let insertedUser;
  try {
    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, is_onboarded`,
      [normalizedEmail, passwordHash],
    );
    insertedUser = rows[0];
  } catch (err) {
    // pg UNIQUE violation — catches race-condition duplicate email
    if (err.code === '23505') {
      throw appError('EMAIL_EXISTS', 'An account with this email already exists');
    }
    throw err;
  }

  const token = signToken({ id: insertedUser.id, email: insertedUser.email });

  // Fire-and-forget — do not block registration if email delivery fails
  const { sendVerificationEmail } = require('../email/email.service');
  sendVerificationEmail(insertedUser.id, normalizedEmail).catch((err) => {
    process.stderr.write(`[EMAIL] Verification send failed for ${insertedUser.id}: ${err.message}\n`);
  });

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

  const { email, password }  = parsed.data;
  const normalizedEmail      = email.toLowerCase().trim();

  const { rows } = await db.query(
    'SELECT id, email, password_hash, is_onboarded FROM users WHERE email = $1',
    [normalizedEmail],
  );

  // Use constant-time comparison even when user not found to prevent timing attacks
  const dummyHash = '$2b$12$invalidhashpadding000000000000000000000000000000000000000';
  const user      = rows[0] || null;
  const hashToCompare = user ? user.password_hash : dummyHash;

  const isValid = await bcrypt.compare(password, hashToCompare);

  if (!user || !isValid) {
    throw appError('INVALID_CREDENTIALS', 'Invalid email or password');
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

module.exports = {
  registerUser,
  loginUser,
  completeOnboarding,
  getUserById,
};
