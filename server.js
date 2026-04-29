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
// NEW: [Area 2] Call watchdog
const { startCallWatchdog } = require('./modules/resilience/call-watchdog');
// NEW: [Feature 4] Public profile routes
const publicProfileRoutes = require('./modules/profile/public-profile.routes');
// NEW: [Feature 5] Announcement system
const { router: announcementRouter, setIO: setAnnouncementIO } = require('./modules/admin/announcement.routes');
const { startAnnouncementCron } = require('./modules/admin/announcement.cron');

const app  = express();
app.set('trust proxy', 1); // FIXED: Required for Render to correctly identify client IP
const PORT = process.env.PORT || 4000;

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,   // WebRTC getUserMedia requires this off
  contentSecurityPolicy:     false,   // Managed at CDN/reverse-proxy level
}));

// ─── Global middleware ────────────────────────────────────────────────────────
const allowedOrigins = [
  'https://voicematch-frontend.vercel.app',
  'https://voicematcho.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
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
// NEW: [Area 7] Music search API
app.use('/api/music',    require('./modules/music/music.routes'));

// ─── Admin API (separate from user routes) ────────────────────────────────────
app.use('/admin-api',    require('./modules/admin/admin.routes'));
// NEW: [Feature 4] Public profile
app.use('/api/public',   publicProfileRoutes);
// NEW: [Feature 5] Announcements
app.use('/admin-api/announcements', announcementRouter);

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
const io = initSocketServer(httpServer);

// NEW: [Feature 5] Init announcement system with socket.io instance
setAnnouncementIO(io);
startAnnouncementCron(io);

if (!process.env.VERCEL) {
  httpServer.listen(PORT, async () => {
    process.stdout.write(`[SERVER] Listening on port ${PORT}\n`);
    await runStartupCleanup();
    // NEW: [Area 2] Start call watchdog — cleans stuck sessions every 5 minutes
    startCallWatchdog(io);
  });
}

module.exports = app;
