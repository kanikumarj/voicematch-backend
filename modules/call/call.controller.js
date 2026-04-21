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
  const expiry = Math.floor(Date.now() / 1000) + 3600;  // 1 hour
  const username = `${expiry}:${req.user.id}`;
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
        urls: turnUrl,
        username,
        credential,
      },
    ],
  });
}

const db = require('../../db');

async function submitRating(req, res) {
  const { callId, ratedUserId, rating } = req.body;
  const raterId = req.user.id;

  try {
    // Only insert if all fields are provided (callId can be null if needed, but ratedUserId and rating are required)
    if (!ratedUserId || !rating) {
      return res.status(400).json({ error: 'ratedUserId and rating are required' });
    }

    await db.query(`
      INSERT INTO call_ratings (call_id, rater_id, rated_id, rating)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
    `, [callId || null, raterId, ratedUserId, rating]);

    // Update avg rating for rated user
    await db.query(`
      UPDATE users SET
        avg_rating = (
          SELECT COALESCE(AVG(rating), 0) FROM call_ratings WHERE rated_id = $1
        ),
        total_ratings = (
          SELECT COUNT(*) FROM call_ratings WHERE rated_id = $1
        )
      WHERE id = $1
    `, [ratedUserId]);

    res.json({ success: true });
  } catch (err) {
    console.error('[RATING] submitRating error:', err.message);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
}

module.exports = { getTurnCredentials, submitRating };
