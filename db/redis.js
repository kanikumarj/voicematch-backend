const Redis = require('ioredis')

let redis = null
let isConnected = false

const createRedisClient = () => {
  const url = process.env.REDIS_URL

  if (!url) {
    console.warn('[REDIS] No REDIS_URL set — Redis disabled, using memory fallback')
    return null
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    // FIXED: removed lazyConnect — Redis must connect on startup for matchmaking to work
    tls: url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    retryStrategy: (times) => {
      if (times > 5) {
        console.warn('[REDIS] Max retries reached — continuing without Redis')
        return null // stop retrying, don't crash
      }
      return Math.min(times * 500, 3000)
    }
  })

  client.on('connect', () => {
    isConnected = true
    console.log('[REDIS] ✓ Connected')
  })

  client.on('ready', () => {
    isConnected = true
    console.log('[REDIS] ✓ Ready')
  })

  client.on('error', (err) => {
    // FIXED: Don't set isConnected=false on transient errors — only on close
    console.warn('[REDIS] Error:', err.message)
  })

  client.on('close', () => {
    isConnected = false
    console.warn('[REDIS] Connection closed')
  })

  client.on('reconnecting', () => {
    console.log('[REDIS] Reconnecting...')
  })

  return client
}

redis = createRedisClient()

// Safe get — returns null if Redis unavailable
const get = async (key) => {
  if (!redis || !isConnected) return null
  try { return await redis.get(key) }
  catch { return null }
}

// Safe set — silently fails if Redis unavailable
const set = async (key, value, ...rest) => {
  if (!redis || !isConnected) return null
  try { return await redis.set(key, value, ...rest) }
  catch { return null }
}

// Safe del
const del = async (key) => {
  if (!redis || !isConnected) return null
  try { return await redis.del(key) }
  catch { return null }
}

const exportedObj = { redis, get, set, del, isConnected: () => isConnected }

// FIXED: Proxy must handle pipeline() and script() which return synchronous objects,
// not promises. The old proxy wrapped everything in async, which broke pipeline chains.
module.exports = new Proxy(exportedObj, {
  get(target, prop) {
    if (prop in target) return target[prop]

    // Fallback to the real redis client
    if (redis && typeof redis[prop] === 'function') {
      // FIXED: pipeline() and multi() return synchronous chain objects — don't wrap in async
      if (prop === 'pipeline' || prop === 'multi') {
        return (...args) => {
          if (!isConnected) {
            // Return a mock pipeline that silently does nothing
            return {
              exec: async () => [],
              hset: function() { return this },
              hdel: function() { return this },
              lrem: function() { return this },
              srem: function() { return this },
              lpush: function() { return this },
              rpush: function() { return this },
              del: function() { return this },
              set: function() { return this },
              get: function() { return this },
            }
          }
          return redis[prop](...args)
        }
      }
      // FIXED: script() returns synchronous result — handle specially
      if (prop === 'script') {
        return async (...args) => {
          if (!isConnected) return null
          try { return await redis[prop](...args) }
          catch { return null }
        }
      }
      // All other methods — wrap in safe async
      return async (...args) => {
        if (!isConnected) return null
        try {
          return await redis[prop](...args)
        } catch {
          return null
        }
      }
    }

    return async () => null
  }
})
