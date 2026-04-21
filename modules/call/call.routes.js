'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../auth/auth.middleware');
const { getTurnCredentials, submitRating } = require('./call.controller');

const router = Router();

router.get('/turn-credentials', authenticateToken, getTurnCredentials);
router.post('/rating', authenticateToken, submitRating);

module.exports = router;
