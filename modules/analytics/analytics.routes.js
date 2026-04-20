'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../auth/auth.middleware');
const { requireAdmin }      = require('../../middleware/requireAdmin');
const { getAllMetrics }      = require('./analytics.service');

const router = Router();

// All analytics routes require valid JWT + admin role
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/admin/analytics?range=24h|7d|30d
 * Returns all metrics in a single response.
 */
router.get('/analytics', async (req, res, next) => {
  try {
    const range   = req.query.range || '24h';
    const metrics = await getAllMetrics(range);
    return res.json(metrics);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
