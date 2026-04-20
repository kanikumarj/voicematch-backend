'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../auth/auth.middleware');
const { apiLimiter }        = require('../../middleware/rateLimiter');
const {
  submitFeedbackController,
  getFeedbackSummaryController,
} = require('./feedback.controller');

const router = Router();
router.use(authenticateToken);

// POST /api/feedback
router.post('/', apiLimiter, submitFeedbackController);

// GET /api/feedback/summary
router.get('/summary', getFeedbackSummaryController);

module.exports = router;
