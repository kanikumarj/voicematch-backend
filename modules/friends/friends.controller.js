'use strict';

const friendsService = require('./friends.service');

async function getFriends(req, res, next) {
  try {
    const data = await friendsService.getFriendsData(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function acceptRequest(req, res, next) {
  try {
    const { friendshipId } = await friendsService.acceptFriendRequest(req.params.requestId, req.user.id);
    res.json({ success: true, friendshipId });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

async function rejectRequest(req, res, next) {
  try {
    await friendsService.rejectFriendRequest(req.params.requestId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

async function removeFriend(req, res, next) {
  try {
    await friendsService.unfriend(req.params.friendshipId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const profile = await friendsService.getFriendProfile(req.params.friendshipId, req.user.id);
    if (!profile) return res.status(404).json({ error: 'Friend not found' });
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

async function checkFriendship(req, res, next) {
  try {
    const isFriend = await friendsService.checkFriendship(req.user.id, req.params.userId);
    res.json({ isFriend });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getFriends,
  acceptRequest,
  rejectRequest,
  removeFriend,
  getProfile,
  checkFriendship
};
