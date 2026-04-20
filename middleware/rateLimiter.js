const rateLimit = require('express-rate-limit')

// FIXED: Removed rate-limit-redis — Upstash doesn't support
// SCRIPT command. Using memory store instead (sufficient for MVP).

const createLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 min default
    max: options.max || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: options.message || 'Too many requests, please try again later.'
    },
    skip: (req) => process.env.NODE_ENV === 'development'
  })
}

// Auth limiter — strict
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many auth attempts, please try again in 15 minutes.'
})

// General API limiter
const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200
})

// Socket / call limiter — relaxed
const callLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60
})

// Added poolJoinLimiter back so it doesn't break any routes that might use it
const poolJoinLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 20
})

module.exports = { authLimiter, apiLimiter, callLimiter, poolJoinLimiter, createLimiter }
