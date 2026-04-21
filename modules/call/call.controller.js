'use strict';

const crypto = require('crypto');

/**
 * POST /api/call/turn-credentials
 * Generates time-limited TURN credentials using HMAC-SHA1 (Coturn standard).
 *
 * Never exposes TURN_SECRET to the client.
 * Credentials expire in 1 hour.
 */
function getTurnCredentials(req, res) {
  const secret = process.env.TURN_SECRET;
  const turnUrl = process.env.TURN_URL || (process.env.TURN_HOST ? `turn:${process.env.TURN_HOST}:${process.env.TURN_PORT || 3478}` : null);

  if (!secret || !turnUrl) {
    // FIXED: Fallback to Metered free TURN relay if custom TURN isn't configured.
    // This ensures calls work across different networks (NAT/firewalls).
    return res.status(200).json({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
    });
  }

  // Coturn time-limited credential format:
  //   username = "<unix_timestamp_expiry>:<userId>"
  //   credential = HMAC-SHA1(username, TURN_SECRET) → base64
  const expiry    = Math.floor(Date.now() / 1000) + 3600;  // 1 hour
  const username  = `${expiry}:${req.user.id}`;
  const credential = crypto
    .createHmac('sha1', secret)
    .update(username)
    .digest('base64');

  return res.status(200).json({
    iceServers: [
      // Public STUN — free, no credentials
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Authenticated TURN
      {
        urls:       turnUrl,
        username,
        credential,
      },
    ],
  });
}

module.exports = { getTurnCredentials };
