'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../auth/auth.middleware');
const { getTurnCredentials } = require('./call.controller');

const router = Router();

router.get('/turn-credentials', authenticateToken, getTurnCredentials);

module.exports = router;
