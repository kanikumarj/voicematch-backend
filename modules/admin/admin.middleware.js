'use strict';

const jwt = require('jsonwebtoken');
const { ADMIN_SECRET } = require('./admin.auth');

/**
 * Middleware: verifyAdminToken
 * Protects ALL /admin-api/* routes.
 * Uses ADMIN_SECRET (separate from user JWT_SECRET).
 */
function verifyAdminToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, ADMIN_SECRET);
    if (decoded.role !== 'superadmin') {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    req.admin = { role: decoded.role };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
}

module.exports = { verifyAdminToken };
