'use strict';

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const redis = require('../db/redis');

/**
 * Factory: creates a rate limiter middleware with a Redis backing store.
 * Falls back to in-memory store if Redis is unavailable (graceful degradation).
 */
function createLimiter({ windowMs, max, prefix, message }) {
  let store;
  try {
    store = new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix,
    });
  } catch {
    process.stderr.write(`[RATE LIMIT] Redis store init failed for ${prefix} — using memory store\n`);
    store = undefined;
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders:   false,
    store,
    keyGenerator: (req) => {
      // Authenticated users keyed by userId; guests keyed by IPv4/IPv6-safe IP
      return req.user?.id || ipKeyGenerator(req);
    },
    handler: (_req, res) => {
      res.status(429).json({ error: message });
    },
    skip: (req) => req.path === '/health',
  });
}

// ─── Pre-configured limiters ──────────────────────────────────────────────────

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max:      10,
  prefix:   'rl:auth:',
  message:  'Too many attempts. Please wait 15 minutes before trying again.',
});

const poolJoinLimiter = createLimiter({
  windowMs: 60 * 1000,
  max:      20,
  prefix:   'rl:pool:',
  message:  'Too many queue requests. Please slow down.',
});

const apiLimiter = createLimiter({
  windowMs: 60 * 1000,
  max:      120,
  prefix:   'rl:api:',
  message:  'Too many requests.',
});

module.exports = { authLimiter, poolJoinLimiter, apiLimiter, createLimiter };
