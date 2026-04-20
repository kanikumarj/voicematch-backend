'use strict';

/**
 * modules/email/email.service.js
 *
 * Multi-provider email waterfall:
 *   1. Brevo SMTP     (BREVO_SMTP_KEY)        — free 300/day, no domain needed
 *   2. Resend API     (RESEND_API_KEY)         — free 100/day, test sender available
 *   3. Gmail SMTP     (SMTP_USER + SMTP_PASS)  — requires App Password
 *   4. Console log    (dev fallback)           — prints link to terminal
 *
 * Set whichever credentials you have in .env — the service auto-selects.
 */

const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const redis      = require('../../db/redis');
const db         = require('../../db');

// ─── TTLs ─────────────────────────────────────────────────────────────────────
const VERIFY_TTL_SECS = 24 * 60 * 60;   // 24 hours
const RESET_TTL_SECS  = 60 * 60;         // 1 hour

const FROM         = process.env.EMAIL_FROM      || 'voicematch@example.com';
const BREVO_FROM   = process.env.BREVO_FROM_EMAIL || FROM;   // Brevo requires from = verified sender
const APP_URL      = process.env.APP_URL         || 'http://localhost:5173';

// ─── Provider builders ────────────────────────────────────────────────────────

/**
 * Provider 1: Brevo SMTP
 * Sign up free at https://app.brevo.com
 * Go to → Account → SMTP & API → SMTP tab
 * Set BREVO_SMTP_USER (your login email) and BREVO_SMTP_KEY (API key shown there)
 */
function buildBrevoTransport() {
  const user = process.env.BREVO_SMTP_USER;
  const pass = process.env.BREVO_SMTP_KEY;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host:   'smtp-relay.brevo.com',
    port:   587,
    secure: false,
    auth:   { user, pass },
  });
}

/**
 * Provider 2: Resend API (via nodemailer + HTTP)
 * Using Resend's SMTP relay: smtp.resend.com
 * SMTP user is always "resend", password is your API key.
 * FROM must be onboarding@resend.dev (test) or a verified domain.
 */
function buildResendTransport() {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.startsWith('re_dev_fake')) return null;
  return nodemailer.createTransport({
    host:   'smtp.resend.com',
    port:   465,
    secure: true,
    auth:   { user: 'resend', pass: key },
  });
}

/**
 * Provider 3: Gmail / Google Workspace SMTP
 * Requires App Password — go to myaccount.google.com/apppasswords
 * College Workspace accounts may have this disabled by admin.
 */
function buildGmailTransport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass || pass === 'your_16_char_app_password_here') return null;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth:   { user, pass },
  });
}

// ─── Transport initialisation ─────────────────────────────────────────────────
const PROVIDERS = [
  { name: 'Brevo',    build: buildBrevoTransport  },
  { name: 'Resend',   build: buildResendTransport  },
  { name: 'Gmail',    build: buildGmailTransport   },
];

const availableProviders = PROVIDERS
  .map(p => ({ name: p.name, transport: p.build() }))
  .filter(p => p.transport !== null);

if (availableProviders.length === 0) {
  process.stdout.write('[EMAIL] ⚠  No email provider configured — emails will log to console only\n');
} else {
  availableProviders.forEach(p =>
    process.stdout.write(`[EMAIL] ✓ Provider ready: ${p.name}\n`),
  );
}

// ─── Send with waterfall ──────────────────────────────────────────────────────
async function sendMail({ to, subject, html }) {
  let lastError;

  for (const { name, transport } of availableProviders) {
    // Each provider may need a specific from address:
    //   Brevo  → must use the SMTP login email as sender (verified sender)
    //   Resend → must use onboarding@resend.dev (test) or verified domain
    //   Others → use EMAIL_FROM from .env
    let effectiveFrom;
    if (name === 'Brevo') {
      effectiveFrom = `"VoiceMatch" <${BREVO_FROM}>`;
    } else if (name === 'Resend') {
      effectiveFrom = `"VoiceMatch" <onboarding@resend.dev>`;
    } else {
      effectiveFrom = `"VoiceMatch" <${FROM}>`;
    }

    process.stdout.write(`[EMAIL] Attempting via ${name} | from: ${effectiveFrom} | to: ${to}\n`);

    try {
      const info = await transport.sendMail({
        from:    effectiveFrom,
        to,
        subject,
        html,
        replyTo: FROM,    // Replies always go to the configured FROM address
      });
      process.stdout.write(
        `[EMAIL] ✓ Sent via ${name} → ${to} | "${subject}" | id: ${info.messageId}\n`,
      );
      return info;
    } catch (err) {
      // Log the full SMTP response so we can debug sender-rejection errors
      const detail = err.response || err.message;
      process.stderr.write(`[EMAIL] ✗ ${name} failed (code ${err.responseCode || 'N/A'}): ${detail}\n`);
      lastError = err;
      // Try next provider
    }
  }

  // All providers failed — log to console as last resort (dev only)
  process.stdout.write(`\n[EMAIL FALLBACK] ⚡ No provider could send. Logging email:\n`);
  process.stdout.write(`  To:      ${to}\n`);
  process.stdout.write(`  Subject: ${subject}\n`);
  if (lastError) {
    const detail = lastError.response || lastError.message;
    process.stderr.write(`[EMAIL] Last error (code ${lastError.responseCode || 'N/A'}): ${detail}\n`);
  }
  // Don't throw in dev — registration still works, user sees link in logs
  if (process.env.NODE_ENV === 'production') {
    throw Object.assign(new Error('Email send failed — all providers exhausted'), { code: 'EMAIL_ERROR' });
  }
}

// ─── Atomic token get-and-delete ─────────────────────────────────────────────
async function getAndDelete(key) {
  try {
    return await redis.getdel(key);
  } catch (err) {
    if (err.message && err.message.includes('unknown command')) {
      const val = await redis.get(key);
      if (val) await redis.del(key);
      return val;
    }
    throw err;
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────
const fs   = require('fs');
const path = require('path');

function loadTemplate(name) {
  return fs.readFileSync(path.join(__dirname, 'templates', name), 'utf8');
}

const TEMPLATES = {
  verification:  loadTemplate('verification.html'),
  resetPassword: loadTemplate('reset-password.html'),
};

function renderTemplate(template, vars) {
  return Object.entries(vars).reduce(
    (html, [key, val]) => html.replaceAll(`{{${key}}}`, val),
    template,
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function sendVerificationEmail(userId, email) {
  const token = crypto.randomBytes(32).toString('hex');
  await redis.setex(`verify:${token}`, VERIFY_TTL_SECS, userId);

  const link = `${APP_URL}/verify-email?token=${token}`;
  const html = renderTemplate(TEMPLATES.verification, { link, email });

  // In dev: always log the link so testing works without real email
  process.stdout.write(`[EMAIL] Verification link for ${email}:\n  ${link}\n`);

  await sendMail({ to: email, subject: 'Verify your VoiceMatch account', html });
}

async function verifyEmailToken(token) {
  if (!token || typeof token !== 'string') return null;

  const userId = await getAndDelete(`verify:${token}`);
  if (!userId) return null;

  await db.query('UPDATE users SET email_verified = true WHERE id = $1', [userId]);
  return userId;
}

async function resendVerification(userId) {
  const { rows } = await db.query(
    'SELECT email, email_verified FROM users WHERE id = $1',
    [userId],
  );
  if (!rows[0])               throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
  if (rows[0].email_verified) throw Object.assign(new Error('Email already verified'), { code: 'ALREADY_VERIFIED' });

  await sendVerificationEmail(userId, rows[0].email);
}

async function sendPasswordResetEmail(email) {
  const { rows } = await db.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase().trim()],
  );
  if (!rows[0]) return;   // Anti-enumeration: silent exit

  const token = crypto.randomBytes(32).toString('hex');
  await redis.setex(`reset:${token}`, RESET_TTL_SECS, rows[0].id);

  const link = `${APP_URL}/reset-password?token=${token}`;
  const html = renderTemplate(TEMPLATES.resetPassword, { link });

  // Dev convenience
  process.stdout.write(`[EMAIL] Password reset link for ${email}:\n  ${link}\n`);

  await sendMail({ to: email, subject: 'Reset your VoiceMatch password', html });
}

async function resetPassword(token, newPassword) {
  if (!token) throw Object.assign(new Error('Token required'), { code: 'VALIDATION_ERROR' });
  if (!newPassword || newPassword.length < 8) {
    throw Object.assign(new Error('Password must be at least 8 characters'), { code: 'VALIDATION_ERROR' });
  }

  const userId = await getAndDelete(`reset:${token}`);
  if (!userId) {
    throw Object.assign(new Error('Reset link has expired or already been used'), { code: 'TOKEN_INVALID' });
  }

  const bcrypt = require('bcryptjs');
  const hash   = await bcrypt.hash(newPassword, 12);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
}

module.exports = {
  sendVerificationEmail,
  verifyEmailToken,
  resendVerification,
  sendPasswordResetEmail,
  resetPassword,
};
