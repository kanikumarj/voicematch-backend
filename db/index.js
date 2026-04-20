
'use strict';

const { Pool } = require('pg');

// Guard at startup — fail fast if database URL is missing
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const isLocal = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }, // FIXED: Required for Supabase
  max: 5,               // Supabase free tier limit
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err.message);
});

// FIXED: Test connection on startup to catch auth/CORS issues early
pool.query('SELECT NOW()')
  .then(() => console.log('[DB] ✓ PostgreSQL connected'))
  .catch(err => console.error('[DB] ✗ Connection failed:', err.message));

module.exports = pool;
