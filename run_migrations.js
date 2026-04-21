const pool = require('./db/index.js');

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Running Migration 001...');
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(500);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);
      ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;
    `);

    console.log('Running Migration 002...');
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_count INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_last_date DATE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_best INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS total_ratings INT DEFAULT 0;
    `);

    console.log('Running Migration 003...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS call_ratings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id UUID,
        rater_id UUID REFERENCES users(id) ON DELETE CASCADE,
        rated_id UUID REFERENCES users(id) ON DELETE CASCADE,
        rating INT CHECK (rating BETWEEN 1 AND 5),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(call_id, rater_id)
      );
    `);
    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigrations();
