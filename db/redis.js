'use strict';

const { Redis } = require('@upstash/redis');

// Prefer environment variables if set on Render, else fallback to hardcoded snippet
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://grateful-grackle-103336.upstash.io';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'gQAAAAAAAZOoAAIocDIzN2E2MmRhMDRlMWU0MjJiOTJjMjg1OGIyZGNhOWI1MnAyMTAzMzM2';

const redis = new Redis({
  url: UPSTASH_URL,
  token: UPSTASH_TOKEN,
});

// Polyfill `.on` because @upstash/redis is REST-based and connectionless
redis.on = function(event, callback) {
  if (event === 'ready') {
    // Fire 'ready' immediately so the server startup logs correctly
    setImmediate(callback);
  }
};

// Polyfill `.call` so rate-limit-redis continues to work
redis.call = async function (...args) {
  const [command, ...rest] = args;
  const cmd = command.toLowerCase();

  if (cmd === 'eval') {
    const [script, numKeys, ...keysAndArgs] = rest;
    const keys = keysAndArgs.slice(0, numKeys);
    const scriptArgs = keysAndArgs.slice(numKeys);
    return await redis.eval(script, keys, scriptArgs);
  }

  if (cmd === 'evalsha') {
    const [sha, numKeys, ...keysAndArgs] = rest;
    const keys = keysAndArgs.slice(0, numKeys);
    const scriptArgs = keysAndArgs.slice(numKeys);
    try {
      return await redis.evalsha(sha, keys, scriptArgs);
    } catch (err) {
      // If script is missing in Upstash, throw NoScriptError to force client to fallback to EVAL
      if (err.message && err.message.includes('NOSCRIPT')) {
        const error = new Error('NOSCRIPT');
        error.code = 'NOSCRIPT';
        throw error;
      }
      throw err;
    }
  }

  if (typeof redis[cmd] === 'function') {
    return await redis[cmd](...rest);
  }

  throw new Error(`Command ${command} not supported by Upstash polyfill`);
};

module.exports = redis;
