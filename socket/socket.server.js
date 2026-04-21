'use strict';

const { Server }             = require('socket.io');
const { socketAuthMiddleware } = require('./socket.auth');
const { registerPresenceEvents } = require('../modules/presence/presence.events');
const { registerMatchmakingEvents } = require('../modules/matchmaking/matchmaking.events');
const { registerSignalingEvents }   = require('../modules/signaling/signaling.events');
const { registerFriendsEvents }     = require('../modules/friends/friends.events');
const { registerDirectCallEvents }  = require('../modules/friends/direct.call.service');
const { registerChatEvents }        = require('../modules/chat/chat.events');

let io = null;

/**
 * Initialize Socket.IO on the existing Node http.Server instance.
 * Must be called ONCE from server.js after http.createServer().
 */
function initSocketServer(httpServer) {
  // FIXED: CORS must include production Netlify URL — was blocking all socket connections
  const allowedOrigins = [
    'https://voicematcho.netlify.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4000',
  ];
  if (process.env.CLIENT_ORIGIN) allowedOrigins.push(process.env.CLIENT_ORIGIN);

  io = new Server(httpServer, {
    cors: {
      origin:      allowedOrigins,
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

    // FIXED: Kill any existing socket for this user
    try {
      const allSockets = await io.fetchSockets();
      for (const s of allSockets) {
        if (s.data && s.data.user && s.data.user.id === userId && s.id !== socket.id) {
          process.stdout.write(`[SOCKET] Killing duplicate socket for ${userId} (${s.id})\n`);
          s.disconnect(true);
        }
      }
    } catch (err) {
      process.stderr.write(`[SOCKET] Error fetching sockets for duplicate check: ${err.message}\n`);
    }

    // Register all event namespaces
    registerPresenceEvents(socket, io);
    registerMatchmakingEvents(socket, io);
    registerSignalingEvents(socket, io);
    registerFriendsEvents(socket, io);
    registerDirectCallEvents(socket, io);
    registerChatEvents(socket, io);
  });

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
