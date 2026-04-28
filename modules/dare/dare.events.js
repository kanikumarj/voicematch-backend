'use strict';

// FIX: [Area 3] Dare Mode Socket Events — updated with category preference

const { getRandomDare, CATEGORY_INFO } = require('./dare.data');
const presence = require('../presence/presence.service');

// In-memory dare sessions (keyed by sessionId)
const dareSessions = new Map();

function registerDareEvents(socket, io) {
  const userId = socket.data.user.id;

  const getPartnerSocket = async () => {
    try {
      const partnerId = await presence.getPartner(userId);
      if (!partnerId) return { partnerId: null, partnerSocket: null };
      const partnerSocketId = await presence.getUserSocket(partnerId);
      return {
        partnerId,
        partnerSocket: partnerSocketId
          ? (io.sockets.sockets.get(partnerSocketId) || null)
          : null,
      };
    } catch (err) {
      process.stderr.write(`[DARE] getPartnerSocket error: ${err.message}\n`);
      return { partnerId: null, partnerSocket: null };
    }
  };

  // User A requests dare mode
  socket.on('dare_request', async ({ fromUser, sessionId }) => {
    try {
      const { partnerSocket } = await getPartnerSocket();
      if (!partnerSocket) {
        socket.emit('dare_error', { message: 'Partner not connected' });
        return;
      }

      // Show waiting state to requester
      socket.emit('dare_request_sent');

      // Send invite to partner
      partnerSocket.emit('dare_invite', { fromUser, sessionId });
    } catch (err) {
      process.stderr.write(`[DARE] dare_request error: ${err.message}\n`);
      socket.emit('dare_error', { message: 'Failed to start dare' });
    }
  });

  // FIX: [Area 3] Partner accepts dare — now with preferredCategory
  socket.on('dare_accept', async ({ sessionId, preferredCategory }) => {
    try {
      const { partnerSocket } = await getPartnerSocket();

      // Initialize dare session
      const usedIds = [];
      const dare = getRandomDare(usedIds, preferredCategory || null);
      usedIds.push(dare.id);

      dareSessions.set(sessionId, {
        usedIds,
        currentDareId: dare.id,
        preferredCategory: preferredCategory || null
      });

      const payload = { dare, categories: CATEGORY_INFO };
      socket.emit('dare_started', payload);
      if (partnerSocket) partnerSocket.emit('dare_started', payload);
    } catch (err) {
      process.stderr.write(`[DARE] dare_accept error: ${err.message}\n`);
      socket.emit('dare_error', { message: 'Failed to start dare' });
    }
  });

  // Partner declines dare
  socket.on('dare_decline', async ({ sessionId }) => {
    try {
      const { partnerSocket } = await getPartnerSocket();
      if (partnerSocket) {
        partnerSocket.emit('dare_declined');
      }
    } catch (err) {
      process.stderr.write(`[DARE] dare_decline error: ${err.message}\n`);
    }
  });

  // FIX: [Area 3] Next dare — now supports category preference
  socket.on('dare_next', async ({ sessionId, preferredCategory }) => {
    try {
      const { partnerSocket } = await getPartnerSocket();

      const session = dareSessions.get(sessionId) || { usedIds: [], preferredCategory: null };
      const category = preferredCategory || session.preferredCategory || null;
      const dare = getRandomDare(session.usedIds, category);
      session.usedIds.push(dare.id);
      session.currentDareId = dare.id;
      if (preferredCategory) session.preferredCategory = preferredCategory;
      dareSessions.set(sessionId, session);

      const payload = { dare };
      socket.emit('dare_new', payload);
      if (partnerSocket) partnerSocket.emit('dare_new', payload);
    } catch (err) {
      process.stderr.write(`[DARE] dare_next error: ${err.message}\n`);
    }
  });

  // Exit dare mode
  socket.on('dare_exit', async ({ sessionId }) => {
    try {
      const { partnerSocket } = await getPartnerSocket();

      dareSessions.delete(sessionId);

      socket.emit('dare_ended');
      if (partnerSocket) partnerSocket.emit('dare_ended');
    } catch (err) {
      process.stderr.write(`[DARE] dare_exit error: ${err.message}\n`);
    }
  });
}

module.exports = { registerDareEvents };
