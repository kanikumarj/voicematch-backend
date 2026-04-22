'use strict';

const { Server }             = require('socket.io');
const { socketAuthMiddleware } = require('./socket.auth');
const { registerPresenceEvents } = require('../modules/presence/presence.events');
const { registerMatchmakingEvents } = require('../modules/matchmaking/matchmaking.events');
const { registerSignalingEvents }   = require('../modules/signaling/signaling.events');
const { registerFriendsEvents }     = require('../modules/friends/friends.events');
const { registerDirectCallEvents }  = require('../modules/friends/direct.call.service');
const { registerChatEvents }        = require('../modules/chat/chat.events');
const { getActiveUsersCount }       = require('../modules/presence/presence.service');

let io = null;

/**
 * Emit online_stats to all connected clients.
 * Includes total online count + per-mode searching counts.
 */
async function emitOnlineStats() {
  if (!io) return;
  try {
    const redis = require('../db/redis');
    const [total, voiceSearching, chatSearching] = await Promise.all([
      getActiveUsersCount(),
      redis.hlen('searching_pool:voice').catch(() => 0),
      redis.hlen('searching_pool:chat').catch(() => 0),
    ]);
    io.emit('online_stats', {
      total: total || 0,
      voice: voiceSearching || 0,
      chat:  chatSearching || 0,
    });
    // Also emit legacy event for backward compat
    io.emit('active_users_count', { count: total || 0 });
  } catch (err) {
    // Silently handle — stats are non-critical
    process.stderr.write(`[SOCKET] emitOnlineStats error: ${err.message}\n`);
  }
}

/**
 * Initialize Socket.IO on the existing Node http.Server instance.
 * Must be called ONCE from server.js after http.createServer().
 */
function initSocketServer(httpServer) {
  // FIXED: CORS must include production Netlify URL — was blocking all socket connections
  const allowedOrigins = [
    'https://voicematch-frontend.vercel.app',
    'https://voicematcho.netlify.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4000',
  ];
  if (process.env.CLIENT_ORIGIN) allowedOrigins.push(process.env.CLIENT_ORIGIN);

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS: ' + origin));
        }
      },
      methods:     ['GET', 'POST'],
      credentials: true,
    },
    transports:  ['websocket', 'polling'], // FIXED: allow polling fallback
    pingTimeout:   60_000,  // FIXED: longer timeout for mobile/slow connections
    pingInterval:  25_000,
  });

  // ── Auth middleware — runs before every connection ──────────────────────────
  io.use(socketAuthMiddleware);

  // ── Connection handler ──────────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const { id: userId, email } = socket.data.user;
    process.stdout.write(`[SOCKET] Connected: ${email} (${socket.id})\n`);

    // Register all event namespaces
    registerPresenceEvents(socket, io);
    registerMatchmakingEvents(socket, io);
    registerSignalingEvents(socket, io);
    registerFriendsEvents(socket, io);
    registerDirectCallEvents(socket, io);
    registerChatEvents(socket, io);

    // Initial emit for this client (both new + legacy events)
    const count = await getActiveUsersCount();
    socket.emit('active_users_count', { count });
    
    // Emit updated online stats to all when someone connects
    emitOnlineStats();

    // Emit updated stats on disconnect too
    socket.on('disconnect', () => {
      emitOnlineStats();
    });
  });

  // Broadcast online stats to all clients every 15 seconds
  setInterval(emitOnlineStats, 15000);

  return io;
}

/**
 * Access the io instance from anywhere in the app without circular imports.
 */
function getIO() {
  if (!io) throw new Error('Socket.IO has not been initialized. Call initSocketServer() first.');
  return io;
}

module.exports = { initSocketServer, getIO };
