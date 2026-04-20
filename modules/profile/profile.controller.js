'use strict';

const { getProfile, updateProfile, deleteAccount } = require('./profile.service');
const { getBlockedUsers, unblockUser }             = require('../moderation/block.service');

async function getProfileController(req, res, next) {
  try {
    const profile = await getProfile(req.user.id);
    return res.json(profile);
  } catch (err) { return next(err); }
}

async function updateProfileController(req, res, next) {
  try {
    const updated = await updateProfile(req.user.id, req.body);
    return res.json({ success: true, user: updated });
  } catch (err) {
    if (err.code === 'VALIDATION_ERROR') return res.status(422).json({ error: err.message });
    return next(err);
  }
}

async function deleteAccountController(req, res, next) {
  try {
    await deleteAccount(req.user.id);
    return res.json({ success: true });
  } catch (err) { return next(err); }
}

async function getBlockedUsersController(req, res, next) {
  try {
    const blockedUsers = await getBlockedUsers(req.user.id);
    return res.json({ blockedUsers });
  } catch (err) { return next(err); }
}

async function unblockUserController(req, res, next) {
  try {
    await unblockUser(req.user.id, req.params.userId);
    return res.json({ success: true });
  } catch (err) { return next(err); }
}

module.exports = {
  getProfileController,
  updateProfileController,
  deleteAccountController,
  getBlockedUsersController,
  unblockUserController,
};
