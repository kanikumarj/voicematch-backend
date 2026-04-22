'use strict';

// NEW: [Feature 1 — In-Call Report Socket Events]

const { submitInCallReport } = require('./in-call-report.service');

function registerInCallReportEvents(socket, io) {
  const userId = socket.data.user.id;

  socket.on('report_during_call', async ({ sessionId, reason, reportedUserId }) => {
    try {
      if (!sessionId || !reason || !reportedUserId) {
        socket.emit('report_error', { message: 'Missing required fields' });
        return;
      }

      const validReasons = ['inappropriate', 'harassment', 'hate_speech', 'spam', 'other'];
      if (!validReasons.includes(reason)) {
        socket.emit('report_error', { message: 'Invalid report reason' });
        return;
      }

      await submitInCallReport({
        reporterId: userId,
        reportedId: reportedUserId,
        sessionId,
        reason,
      });

      // Confirm to reporter
      socket.emit('report_submitted', {
        success: true,
        message: 'Report submitted. Call continues.',
      });
    } catch (err) {
      if (err.message === 'Already reported this session') {
        socket.emit('report_error', { message: 'Already reported' });
      } else {
        socket.emit('report_error', { message: 'Failed to submit report' });
      }
    }
  });
}

module.exports = { registerInCallReportEvents };
