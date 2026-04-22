'use strict';

// NEW: [Feature 4 — Public Profile Routes]

const express = require('express');
const router  = express.Router();
const { authenticateToken }    = require('../auth/auth.middleware');
const db = require('../../db');
const {
  getPublicProfile,
  assignUsername,
  toggleProfilePublic,
} = require('./public-profile.service');

// PUBLIC — no auth needed
router.get('/u/:username', async (req, res) => {
  try {
    const { username } = req.params;

    if (!username || username.length > 60) {
      return res.status(400).json({ success: false, message: 'Invalid username' });
    }

    const profile = await getPublicProfile(username);

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    return res.status(200).json({ success: true, data: profile });
  } catch (err) {
    process.stderr.write(`[PUBLIC PROFILE] Error: ${err.message}\n`);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PROTECTED — generate/get username
router.post('/generate-username', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch display_name from DB since auth middleware only has id/email
    const userRow = await db.query('SELECT display_name FROM users WHERE id = $1', [userId]);
    const displayName = userRow.rows[0]?.display_name;

    if (!displayName) {
      return res.status(400).json({ success: false, message: 'Display name required' });
    }

    const username = await assignUsername(userId, displayName);

    return res.status(200).json({ success: true, data: { username } });
  } catch (err) {
    process.stderr.write(`[PUBLIC PROFILE] Generate username error: ${err.message}\n`);
    return res.status(500).json({ success: false, message: 'Failed to generate username' });
  }
});

// PROTECTED — toggle profile visibility
router.patch('/visibility', authenticateToken, async (req, res) => {
  try {
    const { isPublic } = req.body;
    if (typeof isPublic !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isPublic must be boolean' });
    }
    await toggleProfilePublic(req.user.id, isPublic);
    return res.status(200).json({ success: true });
  } catch (err) {
    process.stderr.write(`[PUBLIC PROFILE] Visibility error: ${err.message}\n`);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
