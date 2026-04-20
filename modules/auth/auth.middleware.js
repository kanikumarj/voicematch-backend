
'use strict';

const jwt = require('jsonwebtoken');

/**
 * Middleware: authenticateToken
 *
 * Validates the Bearer JWT from the Authorization header.
 * Attaches decoded { id, email } to req.user on success.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token      = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail closed — misconfigured environment should not grant access
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const decoded = jwt.verify(token, secret);
    // Attach only what downstream routes need — no full DB row here
    req.user = { id: decoded.id, email: decoded.email };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authenticateToken };
