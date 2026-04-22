'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../auth/auth.middleware');
const {
  getProfileController,
  updateProfileController,
  deleteAccountController,
  getBlockedUsersController,
  unblockUserController,
} = require('./profile.controller');
const { blockUser } = require('../moderation/block.service');

const router = Router();
router.use(authenticateToken);

router.get('/me',                  getProfileController);
router.patch('/me',                updateProfileController);
router.put('/me',                  updateProfileController); // FIXED: Alias for PUT — frontend sends PUT
router.delete('/me',               deleteAccountController);
router.get('/blocks',              getBlockedUsersController);
router.delete('/block/:userId',    unblockUserController);

// POST /api/users/block/:userId
router.post('/block/:userId', async (req, res, next) => {
  try {
    const result = await blockUser(req.user.id, req.params.userId);
    return res.status(201).json(result);
  } catch (err) {
    if (err.code === 'VALIDATION_ERROR') return res.status(422).json({ error: err.message });
    return next(err);
  }
});

// GET /api/users/:userId/status
router.get('/:userId/status', async (req, res, next) => {
  try {
    const { rows } = await require('../../db').query(
      'SELECT is_online AS "isOnline", last_seen AS "lastSeen" FROM users WHERE id = $1',
      [req.params.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
