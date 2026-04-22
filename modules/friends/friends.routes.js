'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../auth/auth.middleware');
const friendsController = require('./friends.controller');

const router = Router();

router.use(authenticateToken);

router.get('/', friendsController.getFriends);
router.post('/requests/:requestId/accept', friendsController.acceptRequest);
router.post('/requests/:requestId/reject', friendsController.rejectRequest);
router.delete('/:friendshipId', friendsController.removeFriend);
router.get('/:friendshipId/profile', friendsController.getProfile);
router.get('/check/:userId', friendsController.checkFriendship);

module.exports = router;
