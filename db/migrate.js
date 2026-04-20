'use strict';

/**
 * db/migrate.js
 * Lightweight migration runner — reads SQL files from /db/migrations/
 * in alphabetical order and executes them sequentially.
 *
 * Usage: node db/migrate.js
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const db   = require('./index');

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort(); // alphabetical → numeric order preserved by 001_, 002_, etc.

  // Ensure tracking table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      filename   TEXT        NOT NULL UNIQUE,
      applied_at TIMESTAMP   NOT NULL DEFAULT NOW()
    )
  `);

  for (const file of files) {
    const { rows } = await db.query(
      'SELECT id FROM _migrations WHERE filename = $1',
      [file],
    );

    if (rows.length > 0) {
      process.stdout.write(`[MIGRATE] Skipping ${file} (already applied)\n`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    // Run each migration in its own transaction
    await db.query('BEGIN');
    try {
      await db.query(sql);
      await db.query(
        'INSERT INTO _migrations (filename) VALUES ($1)',
        [file],
      );
      await db.query('COMMIT');
      process.stdout.write(`[MIGRATE] Applied ${file}\n`);
    } catch (err) {
      await db.query('ROLLBACK');
      process.stderr.write(`[MIGRATE] Failed on ${file}: ${err.message}\n`);
      process.exit(1);
    }
  }

  process.stdout.write('[MIGRATE] All migrations complete\n');
  process.exit(0);
}

runMigrations();
