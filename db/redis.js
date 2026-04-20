const Redis = require('ioredis')

let redis = null
let isConnected = false

const createRedisClient = () => {
  const url = process.env.REDIS_URL

  if (!url) {
    console.warn('[REDIS] No REDIS_URL set — Redis disabled, using memory fallback')
    return null
  }

  // FIXED: Clean URL only, no extra flags
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
    tls: url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('[REDIS] Max retries reached — continuing without Redis')
        return null // stop retrying, don't crash
      }
      return Math.min(times * 500, 2000)
    }
  })

  client.on('connect', () => {
    isConnected = true
    console.log('[REDIS] ✓ Connected')
  })

  client.on('error', (err) => {
    isConnected = false
    console.warn('[REDIS] Error:', err.message)
    // FIXED: Never throw — just log and continue
  })

  client.on('close', () => {
    isConnected = false
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
const set = async (key, value, ttlSeconds) => {
  if (!redis || !isConnected) return null
  try {
    if (ttlSeconds) return await redis.set(key, value, 'EX', ttlSeconds)
    return await redis.set(key, value)
  } catch { return null }
}

// Safe del
const del = async (key) => {
  if (!redis || !isConnected) return null
  try { return await redis.del(key) }
  catch { return null }
}

const exportedObj = { redis, get, set, del, isConnected: () => isConnected }

// Safe proxy to support both object destruction and direct method calls like redis.hget()
module.exports = new Proxy(exportedObj, {
  get(target, prop) {
    if (prop in target) return target[prop]
    
    // Fallback to the real redis client, but catch errors silently if offline
    if (redis && typeof redis[prop] === 'function') {
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
