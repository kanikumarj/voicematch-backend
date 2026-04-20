'use strict';

const jwt = require('jsonwebtoken');

/**
 * Socket.IO handshake JWT validator.
 * Called as middleware BEFORE the connection event fires.
 *
 * Client must pass token as:
 *   socket = io(URL, { auth: { token: '<JWT>' } })
 */
function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('AUTH_MISSING: token required'));
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(new Error('SERVER_ERROR: misconfigured'));
  }

  try {
    const decoded = jwt.verify(token, secret);
    // Attach user to socket — available in all event handlers as socket.data.user
    socket.data.user = { id: decoded.id, email: decoded.email };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new Error('AUTH_EXPIRED: token expired'));
    }
    return next(new Error('AUTH_INVALID: token invalid'));
  }
}

module.exports = { socketAuthMiddleware };
