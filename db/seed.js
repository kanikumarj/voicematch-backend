'use strict';

/**
 * db/seed.js — Development seed data only.
 * Creates 3 test users (2 regular, 1 admin) with verified emails.
 *
 * Usage: npm run seed
 * Guard: Only runs when NODE_ENV = 'development'
 */

require('dotenv').config();

if (process.env.NODE_ENV !== 'development') {
  console.error('[SEED] Refused: NODE_ENV must be "development". Exiting.');
  process.exit(1);
}

const bcrypt = require('bcryptjs');
const db     = require('./index');

const USERS = [
  { email: 'test1@dev.com',  password: 'Test1234!',  displayName: 'Tester One', role: 'user'  },
  { email: 'test2@dev.com',  password: 'Test1234!',  displayName: 'Tester Two', role: 'user'  },
  { email: 'admin@dev.com',  password: 'Admin1234!', displayName: 'Admin User', role: 'admin' },
];

async function seed() {
  process.stdout.write('[SEED] Starting…\n');

  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 12);

    await db.query(
      `INSERT INTO users
         (email, password_hash, display_name, role,
          is_onboarded, email_verified, status,
          age, gender)
       VALUES ($1, $2, $3, $4, true, true, 'offline', 25, 'other')
       ON CONFLICT (email) DO UPDATE
         SET password_hash  = EXCLUDED.password_hash,
             display_name   = EXCLUDED.display_name,
             role           = EXCLUDED.role,
             is_onboarded   = true,
             email_verified = true`,
      [u.email, hash, u.displayName, u.role],
    );

    process.stdout.write(`[SEED] Upserted ${u.email} (${u.role})\n`);
  }

  process.stdout.write('[SEED] Done ✓\n');
  process.exit(0);
}

seed().catch(err => {
  process.stderr.write(`[SEED] Failed: ${err.message}\n`);
  process.exit(1);
});
