'use strict';

// NEW: [Feature 5 — Announcement Routes]

const express = require('express');
const router  = express.Router();
const db      = require('../../db');
const { verifyAdminToken } = require('./admin.middleware');
const {
  createAnnouncement,
  sendAnnouncement,
  getAnnouncements,
  getEstimatedRecipients,
  cancelAnnouncement,
} = require('./announcement.service');

let ioInstance = null;
function setIO(io) { ioInstance = io; }

// Get all announcements
router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const { status = 'all', page = 1 } = req.query;
    const result = await getAnnouncements({ status, page: parseInt(page) });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    process.stderr.write(`[ANNOUNCEMENT ROUTE] List error: ${err.message}\n`);
    return res.status(500).json({ success: false, message: 'Failed to get announcements' });
  }
});

// Get estimated recipients for a segment
router.get('/estimate', verifyAdminToken, async (req, res) => {
  try {
    const { segment, targetUserId } = req.query;
    const count = await getEstimatedRecipients(segment, targetUserId);
    return res.status(200).json({ success: true, data: { count } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to estimate' });
  }
});

// Create and optionally send announcement
router.post('/', verifyAdminToken, async (req, res) => {
  try {
    const {
      title, message, type = 'info', segment = 'all',
      targetUserId, scheduledAt, sendNow = false,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }
    if (message.length > 200) {
      return res.status(400).json({ success: false, message: 'Message max 200 characters' });
    }

    const ann = await createAnnouncement({
      title, message, type, segment,
      targetUserId, scheduledAt,
    });

    let sendResult = null;
    if (sendNow || !scheduledAt) {
      sendResult = await sendAnnouncement(ann, ioInstance);
    }

    return res.status(201).json({ success: true, data: { announcement: ann, sendResult } });
  } catch (err) {
    process.stderr.write(`[ANNOUNCEMENT ROUTE] Create error: ${err.message}\n`);
    return res.status(500).json({ success: false, message: 'Failed to create announcement' });
  }
});

// Force send a scheduled announcement
router.patch('/:id/send', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM announcements WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    const sendResult = await sendAnnouncement(result.rows[0], ioInstance);
    return res.status(200).json({ success: true, data: sendResult });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to send' });
  }
});

// Cancel scheduled announcement
router.delete('/:id', verifyAdminToken, async (req, res) => {
  try {
    const cancelled = await cancelAnnouncement(req.params.id);
    if (!cancelled) {
      return res.status(400).json({ success: false, message: 'Cannot cancel — already sent or not found' });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to cancel' });
  }
});

module.exports = { router, setIO };
