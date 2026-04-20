'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../auth/auth.middleware');
const chatController = require('./chat.controller');

const router = Router();

router.use(authenticateToken);

router.get('/:friendshipId/messages', chatController.getMessages);
router.delete('/messages/:messageId', chatController.deleteMessage);

module.exports = router;
