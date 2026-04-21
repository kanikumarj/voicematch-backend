
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
})

pool.on('connect', () => console.log('[DB] ✓ PostgreSQL connected'))
pool.on('error', (err) => console.error('[DB] ✗ Connection failed:', err.message))

module.exports = pool

