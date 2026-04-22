'use strict';

// NEW: [Feature 3 — Dare Mode Socket Events]

const { getRandomDare } = require('./dare.data');
const presence = require('../presence/presence.service');

// In-memory dare sessions (keyed by sessionId)
const dareSessions = new Map();

function registerDareEvents(socket, io) {
  const userId = socket.data.user.id;

  const getPartnerSocket = async () => {
    const partnerId = await presence.getPartner(userId);
    if (!partnerId) return { partnerId: null, partnerSocket: null };
    const partnerSocketId = await presence.getUserSocket(partnerId);
    return {
      partnerId,
      partnerSocket: partnerSocketId
        ? (io.sockets.sockets.get(partnerSocketId) || null)
        : null,
    };
  };

  // User A requests dare mode
  socket.on('dare_request', async ({ fromUser, sessionId }) => {
    const { partnerSocket } = await getPartnerSocket();
    if (!partnerSocket) {
      socket.emit('dare_error', { message: 'Partner not connected' });
      return;
    }

    // Show waiting state to requester
    socket.emit('dare_request_sent');

    // Send invite to partner
    partnerSocket.emit('dare_invite', { fromUser, sessionId });
  });

  // Partner accepts dare
  socket.on('dare_accept', async ({ sessionId }) => {
    const { partnerSocket } = await getPartnerSocket();

    // Initialize dare session
    const usedIds = [];
    const dare = getRandomDare(usedIds);
    usedIds.push(dare.id);

    dareSessions.set(sessionId, { usedIds, currentDareId: dare.id });

    const payload = { dare };
    socket.emit('dare_started', payload);
    if (partnerSocket) partnerSocket.emit('dare_started', payload);
  });

  // Partner declines dare
  socket.on('dare_decline', async ({ sessionId }) => {
    const { partnerSocket } = await getPartnerSocket();
    if (partnerSocket) {
      partnerSocket.emit('dare_declined');
    }
  });

  // Next dare
  socket.on('dare_next', async ({ sessionId }) => {
    const { partnerSocket } = await getPartnerSocket();

    const session = dareSessions.get(sessionId) || { usedIds: [] };
    const dare = getRandomDare(session.usedIds);
    session.usedIds.push(dare.id);
    session.currentDareId = dare.id;
    dareSessions.set(sessionId, session);

    const payload = { dare };
    socket.emit('dare_new', payload);
    if (partnerSocket) partnerSocket.emit('dare_new', payload);
  });

  // Exit dare mode
  socket.on('dare_exit', async ({ sessionId }) => {
    const { partnerSocket } = await getPartnerSocket();

    dareSessions.delete(sessionId);

    socket.emit('dare_ended');
    if (partnerSocket) partnerSocket.emit('dare_ended');
  });
}

module.exports = { registerDareEvents };
