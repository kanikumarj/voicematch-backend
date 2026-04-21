'use strict';

const jwt = require('jsonwebtoken');

// FIXED: Hardcoded admin credentials — no DB lookup
const ADMIN_USERNAME = 'Chiyaan';
const ADMIN_PASSWORD = 'Kani@1106';
const ADMIN_SECRET   = process.env.ADMIN_JWT_SECRET || 'admin-fallback-secret-change-in-prod';

/**
 * POST /admin-api/auth
 * Validates hardcoded admin credentials, returns JWT signed with ADMIN_SECRET.
 */
async function adminLogin(req, res) {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign(
      { role: 'superadmin' },
      ADMIN_SECRET,
      { expiresIn: '8h' }
    );

    console.log('[ADMIN] Login successful from', req.ip);
    return res.json({ success: true, token });
  }

  // FIXED: Generic error — do not reveal admin exists
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
}

module.exports = { adminLogin, ADMIN_SECRET };
