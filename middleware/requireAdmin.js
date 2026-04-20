'use strict';

const db = require('../db');

/**
 * requireAdmin middleware.
 *
 * Must be used AFTER authenticateToken (needs req.user to be populated).
 * Fetches role from DB — not embedded in JWT so that role changes
 * take effect without requiring token re-issue.
 */
async function requireAdmin(req, res, next) {
  try {
    const { rows } = await db.query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.id],
    );

    if (!rows[0] || rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAdmin };
