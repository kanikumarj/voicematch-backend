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
  io = new Server(httpServer, {
    cors: {
      origin:      process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      methods:     ['GET', 'POST'],
      credentials: true,
    },
    // Prevent zombie connections eating memory
    pingTimeout:   20_000,
    pingInterval:  25_000,
  });

  // ── Auth middleware — runs before every connection ──────────────────────────
  io.use(socketAuthMiddleware);

  // ── Connection handler ──────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const { id: userId, email } = socket.data.user;
    process.stdout.write(`[SOCKET] Connected: ${email} (${socket.id})\n`);

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
