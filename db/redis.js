'use strict';

const Redis = require('ioredis');

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest:    3,
  enableReadyCheck:        true,
  lazyConnect:             false,
  retryStrategy(times) {
    // Exponential back-off capped at 30s — allows Redis restart recovery
    const delay = Math.min(times * 200, 30_000);
    return delay;
  },
}) : null;

if (redis) {
  redis.on('error',       (err) => process.stderr.write(`[REDIS] Error: ${err.message}\n`));
  redis.on('reconnecting',()    => process.stderr.write('[REDIS] Reconnecting...\n'));
  redis.on('ready',       ()    => process.stdout.write('[REDIS] Connected\n'));
}

module.exports = redis;
