'use strict';

// NEW: [Feature 5 — Announcement Cron Scheduler]

const db = require('../../db');
const { sendAnnouncement } = require('./announcement.service');

let ioInstance = null;

function startAnnouncementCron(io) {
  ioInstance = io;

  // Check every minute for scheduled announcements
  setInterval(async () => {
    try {
      const due = await db.query(
        `SELECT * FROM announcements
         WHERE status = 'scheduled'
         AND scheduled_at <= NOW()`
      );

      for (const ann of due.rows) {
        process.stdout.write(`[CRON] Sending scheduled announcement: ${ann.title}\n`);
        await sendAnnouncement(ann, ioInstance);
      }
    } catch (err) {
      process.stderr.write(`[CRON] Announcement cron error: ${err.message}\n`);
    }
  }, 60 * 1000);

  process.stdout.write('[CRON] Announcement scheduler started\n');
}

module.exports = { startAnnouncementCron };
