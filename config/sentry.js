'use strict';

/**
 * Sentry initialisation — call this ONCE at the top of server.js
 * before any other requires.
 *
 * Captures:
 *   ✓ Unhandled Express errors (via errorHandler.js)
 *   ✓ Redis connection failures
 *   ✓ Unhandled promise rejections
 *   ✗ Passwords, JWT tokens, audio data (never captured)
 */

let Sentry = null;

function initSentry() {
  const dsn = process.env.SENTRY_DSN_BACKEND;

  if (!dsn) {
    process.stdout.write('[SENTRY] DSN not set — error tracking disabled\n');
    return;
  }

  try {
    Sentry = require('@sentry/node');

    Sentry.init({
      dsn,
      environment:    process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

      // Strip sensitive data before sending to Sentry
      beforeSend(event) {
        // Scrub Authorization headers
        if (event.request?.headers?.authorization) {
          event.request.headers.authorization = '[REDACTED]';
        }
        // Scrub password fields from request body
        if (event.request?.data) {
          const body = typeof event.request.data === 'string'
            ? JSON.parse(event.request.data)
            : event.request.data;
          if (body.password)    body.password    = '[REDACTED]';
          if (body.newPassword) body.newPassword = '[REDACTED]';
          event.request.data = JSON.stringify(body);
        }
        return event;
      },
    });

    process.stdout.write('[SENTRY] Initialised\n');
  } catch {
    process.stderr.write('[SENTRY] Failed to initialise — continuing without error tracking\n');
    Sentry = null;
  }
}

/**
 * Capture an exception. Safe to call even if Sentry is not initialised.
 */
function captureException(err, context = {}) {
  if (!Sentry) return;
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
    Sentry.captureException(err);
  });
}

/**
 * Set the authenticated user context for the current request.
 * Only store userId — never email or display name.
 */
function setUser(userId) {
  if (!Sentry) return;
  Sentry.setUser({ id: userId });
}

function clearUser() {
  if (!Sentry) return;
  Sentry.setUser(null);
}

module.exports = { initSentry, captureException, setUser, clearUser };
