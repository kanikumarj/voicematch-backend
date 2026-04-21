'use strict';

// ─── Sentry removed for production stability ──────────────────────────────


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
app.set('trust proxy', 1); // FIXED: Required for Render to correctly identify client IP
const PORT = process.env.PORT || 4000;

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,   // WebRTC getUserMedia requires this off
  contentSecurityPolicy:     false,   // Managed at CDN/reverse-proxy level
}));

// ─── Global middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: 'https://voicematcho.netlify.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors({
  origin: 'https://voicematcho.netlify.app',
  credentials: true
}));
app.use(express.json({ limit: '16kb' }));
app.use(apiLimiter);

// ─── Passport & Session ───────────────────────────────────────────────────────
const session = require('express-session');
const passport = require('./src/config/passport');

app.use(session({
  secret: process.env.JWT_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());

// ─── REST Routes ────────────────────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRouter);
app.use('/api/call',     callRouter);
app.use('/api/admin',    adminRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/users',    profileRouter);
app.use('/api/profile',  profileRouter); // FIXED: Alias for /api/profile
app.use('/api/friends',  require('./modules/friends/friends.routes'));
app.use('/api/chat',     require('./modules/chat/chat.routes'));

// ─── Admin API (separate from user routes) ────────────────────────────────────
app.use('/admin-api',    require('./modules/admin/admin.routes'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'VoiceMatch API' });
});

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
