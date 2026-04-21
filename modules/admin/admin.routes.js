'use strict';

const { Router } = require('express');
const { adminLogin }       = require('./admin.auth');
const { verifyAdminToken }  = require('./admin.middleware');
const { createLimiter }     = require('../../middleware/rateLimiter');
const svc                   = require('./admin.service');

const router = Router();

// ─── Rate limit admin login: 3 attempts / 15 min ─────────────────────────────
const adminAuthLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 3 });

// ─── Public: admin login ──────────────────────────────────────────────────────
router.post('/auth', adminAuthLimiter, adminLogin);

// ─── All routes below require admin token ─────────────────────────────────────
router.use(verifyAdminToken);

// ─── Overview ─────────────────────────────────────────────────────────────────
router.get('/overview', async (req, res) => {
  try {
    const data = await svc.getOverview();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[ADMIN] overview error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Users ────────────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const data = await svc.getUsers(req.query);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[ADMIN] users error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const data = await svc.getUserDetail(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data });
  } catch (err) {
    console.error('[ADMIN] user detail error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.patch('/users/:id/status', async (req, res) => {
  try {
    const result = await svc.updateUserStatus(req.params.id, req.body.status);
    await svc.logAudit('update_status', 'user', req.params.id, req.body, req.ip);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[ADMIN] status update error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/users/:id/ban', async (req, res) => {
  try {
    await svc.banUser(req.params.id, req.body);
    await svc.logAudit('ban_user', 'user', req.params.id, req.body, req.ip);
    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] ban error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.delete('/users/:id/ban', async (req, res) => {
  try {
    await svc.unbanUser(req.params.id);
    await svc.logAudit('unban_user', 'user', req.params.id, null, req.ip);
    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] unban error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Live Calls ───────────────────────────────────────────────────────────────
router.get('/calls/live', async (req, res) => {
  try {
    const data = await svc.getLiveCalls();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[ADMIN] live calls error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.delete('/calls/:sessionId', async (req, res) => {
  try {
    const result = await svc.forceEndCall(req.params.sessionId);
    if (!result) return res.status(404).json({ success: false, message: 'Session not found' });
    await svc.logAudit('force_end_call', 'session', req.params.sessionId, null, req.ip);

    // Emit socket event to both users
    try {
      const { getIO } = require('../../socket/socket.server');
      const io = getIO();
      const redis = require('../../db/redis');
      for (const uid of [result.user_a_id, result.user_b_id]) {
        const sid = await redis.hget('user_socket_map', uid);
        if (sid) io.to(sid).emit('force_end_call', { reason: 'Admin ended call' });
      }
    } catch {}

    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] force end error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Reports ──────────────────────────────────────────────────────────────────
router.get('/reports', async (req, res) => {
  try {
    const data = await svc.getReports(req.query);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[ADMIN] reports error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.patch('/reports/:id', async (req, res) => {
  try {
    const result = await svc.updateReport(req.params.id, req.body.status);
    await svc.logAudit('update_report', 'report', req.params.id, req.body, req.ip);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[ADMIN] report update error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Banned ───────────────────────────────────────────────────────────────────
router.get('/banned', async (req, res) => {
  try {
    const data = await svc.getBannedUsers(req.query);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[ADMIN] banned error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Analytics ────────────────────────────────────────────────────────────────
router.get('/analytics', async (req, res) => {
  try {
    const data = await svc.getAnalytics(req.query.range);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[ADMIN] analytics error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── System ───────────────────────────────────────────────────────────────────
router.get('/system/health', async (req, res) => {
  try {
    const data = await svc.getSystemHealth();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/system/broadcast', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message required' });

    const { getIO } = require('../../socket/socket.server');
    getIO().emit('system_broadcast', { message, timestamp: new Date().toISOString() });

    await svc.logAudit('broadcast', null, null, { message }, req.ip);
    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] broadcast error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/system/reset-statuses', async (req, res) => {
  try {
    const db = require('../../db');
    await db.query(`UPDATE users SET status = 'offline' WHERE status != 'offline' AND status != 'banned'`);
    await svc.logAudit('reset_statuses', null, null, null, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/system/clear-pool', async (req, res) => {
  try {
    const redis = require('../../db/redis');
    await redis.del('searching_pool');
    await svc.logAudit('clear_pool', null, null, null, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Audit Log ────────────────────────────────────────────────────────────────
router.get('/audit-log', async (req, res) => {
  try {
    const data = await svc.getAuditLog(req.query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
