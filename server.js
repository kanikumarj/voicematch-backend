'use strict';

// ─── Sentry MUST be initialised before any other requires ────────────────────
const { initSentry } = require('./config/sentry');
initSentry();

require('dotenv').config();

const http    = require('http');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');

const { initSocketServer }  = require('./socket/socket.server');
const authRouter            = require('./modules/auth/auth.routes');
const callRouter            = require('./modules/call/call.routes');
const adminRouter           = require('./modules/analytics/analytics.routes');
const feedbackRouter        = require('./modules/feedback/feedback.routes');
const profileRouter         = require('./modules/profile/profile.routes');
const { apiLimiter }        = require('./middleware/rateLimiter');
const { globalErrorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { runStartupCleanup } = require('./modules/resilience/startup.cleanup');

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,   // WebRTC getUserMedia requires this off
  contentSecurityPolicy:     false,   // Managed at CDN/reverse-proxy level
}));

// ─── Global middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '16kb' }));
app.use(apiLimiter);

// ─── REST Routes ────────────────────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRouter);
app.use('/api/call',     callRouter);
app.use('/api/admin',    adminRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/users',    profileRouter);
app.use('/api/friends',  require('./modules/friends/friends.routes'));
app.use('/api/chat',     require('./modules/chat/chat.routes'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
  status:    'ok',
  timestamp: new Date().toISOString(),
}));

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─── HTTP server + Socket.IO ──────────────────────────────────────────────────
const httpServer = http.createServer(app);
initSocketServer(httpServer);

httpServer.listen(PORT, async () => {
  process.stdout.write(`[SERVER] Listening on port ${PORT}\n`);
  await runStartupCleanup();
});

module.exports = app;
