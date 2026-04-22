'use strict';

// NEW: [Feature 2 — Music Sync Socket Events]

const presence = require('../presence/presence.service');

function registerMusicEvents(socket, io) {
  const userId = socket.data.user.id;

  // Helper to get partner's live socket object
  const getPartnerSocket = async () => {
    const partnerId = await presence.getPartner(userId);
    if (!partnerId) return null;
    const partnerSocketId = await presence.getUserSocket(partnerId);
    if (!partnerSocketId) return null;
    return io.sockets.sockets.get(partnerSocketId) || null;
  };

  // User shares a YouTube link
  socket.on('music_share', async ({ videoId, title, thumbnail }) => {
    if (!videoId) return;

    const partnerSocket = await getPartnerSocket();
    if (!partnerSocket) {
      socket.emit('music_error', { message: 'Partner not connected' });
      return;
    }

    // Confirm to sharer
    socket.emit('music_started', {
      videoId, title, thumbnail,
      timestamp: 0, isSharer: true,
    });

    // Send to partner
    partnerSocket.emit('music_started', {
      videoId, title, thumbnail,
      timestamp: 0, isSharer: false,
    });
  });

  // Sync playback control
  socket.on('music_control', async ({ action, timestamp }) => {
    const validActions = ['play', 'pause', 'seek'];
    if (!validActions.includes(action)) return;

    const partnerSocket = await getPartnerSocket();
    if (!partnerSocket) return;

    partnerSocket.emit('music_control', {
      action,
      timestamp: timestamp || 0,
      serverTime: Date.now(),
    });
  });

  // Stop music for both
  socket.on('music_stop', async () => {
    const partnerSocket = await getPartnerSocket();
    if (partnerSocket) {
      partnerSocket.emit('music_stopped');
    }
    socket.emit('music_stopped');
  });
}

module.exports = { registerMusicEvents };
