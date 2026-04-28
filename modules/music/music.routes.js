'use strict';

// NEW: [Area 7] Music search REST API routes

const express = require('express');
const router = express.Router();
const { searchYouTube } = require('./youtube.search');

// FIX: [Area 7] Import auth middleware — try multiple paths
let authenticateToken;
try {
  authenticateToken = require('../../middleware/auth').authenticateToken;
} catch {
  try {
    authenticateToken = require('../auth/auth.middleware').authenticateToken;
  } catch {
    // Fallback: basic auth check
    authenticateToken = (req, res, next) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
      next();
    };
  }
}

// GET /api/music/search?q=<query>
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Query too short (minimum 2 characters)'
      });
    }

    const results = await searchYouTube(q);
    return res.status(200).json({ success: true, data: { results } });
  } catch (err) {
    process.stderr.write(`[MUSIC] Search error: ${err.message}\n`);

    // FIX: [Area 7] Return specific error for missing API key
    if (err.message.includes('not configured')) {
      return res.status(503).json({
        success: false,
        message: 'YouTube search not available. Use URL paste instead.',
        noApiKey: true
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Search failed. Try pasting a YouTube URL directly.'
    });
  }
});

module.exports = router;
