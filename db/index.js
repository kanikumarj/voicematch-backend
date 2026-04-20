
'use strict';

const { Pool } = require('pg');

// Guard at startup — fail fast if database URL is missing
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max:              10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  // Surface pool-level errors without crashing the process;
  // individual query errors are handled at the call site
  process.stderr.write(`[DB] Unexpected pool error: ${err.message}\n`);
});

module.exports = pool;
