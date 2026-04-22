'use strict';

// NEW: [Feature 5 — Announcement Service]

const db = require('../../db');

async function getUsersBySegment(segment, targetUserId = null) {
  let query = '';

  switch (segment) {
    case 'all':
      query = `SELECT id FROM users WHERE status != 'banned'`;
      break;
    case 'inactive_7d':
      query = `SELECT id FROM users
               WHERE (last_active_date < NOW() - INTERVAL '7 days'
                 OR last_active_date IS NULL)
               AND status != 'banned'
               AND created_at < NOW() - INTERVAL '1 day'`;
      break;
    case 'no_friends':
      query = `SELECT u.id FROM users u
               LEFT JOIN friendships f
                 ON u.id = f.user_a_id OR u.id = f.user_b_id
               WHERE f.id IS NULL
               AND u.status != 'banned'`;
      break;
    case 'new_users':
      query = `SELECT id FROM users
               WHERE created_at > NOW() - INTERVAL '3 days'
               AND status != 'banned'`;
      break;
    case 'high_trust':
      query = `SELECT id FROM users
               WHERE trust_score >= 80
               AND status != 'banned'`;
      break;
    case 'specific_user':
      return targetUserId ? [{ id: targetUserId }] : [];
    default:
      return [];
  }

  const result = await db.query(query);
  return result.rows;
}

async function createAnnouncement({ title, message, type = 'info', segment = 'all', targetUserId = null, scheduledAt = null }) {
  const status = scheduledAt ? 'scheduled' : 'draft';

  const result = await db.query(
    `INSERT INTO announcements
     (title, message, type, segment, target_user_id, status, scheduled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [title, message, type, segment, targetUserId, status, scheduledAt]
  );

  return result.rows[0];
}

async function sendAnnouncement(announcement, io) {
  try {
    const users = await getUsersBySegment(
      announcement.segment,
      announcement.target_user_id
    );

    let sentCount = 0;

    // Emit to online users via Socket.IO
    if (io) {
      const sockets = await io.fetchSockets();
      for (const user of users) {
        const userSocket = sockets.find(s => s.data?.user?.id === user.id);
        if (userSocket) {
          userSocket.emit('system_announcement', {
            id:      announcement.id,
            title:   announcement.title,
            message: announcement.message,
            type:    announcement.type,
          });
          sentCount++;
        }
      }
    }

    // Update announcement status
    await db.query(
      `UPDATE announcements
       SET status = 'sent', sent_at = NOW(), sent_count = $1
       WHERE id = $2`,
      [sentCount, announcement.id]
    );

    process.stdout.write(JSON.stringify({
      level: 'info',
      event: 'announcement_sent',
      id: announcement.id,
      title: announcement.title,
      sentCount,
      totalTargets: users.length,
    }) + '\n');

    return { sentCount, totalTargets: users.length };
  } catch (err) {
    process.stderr.write(`[ANNOUNCEMENT] Send error: ${err.message}\n`);
    throw err;
  }
}

async function getAnnouncements({ status = 'all', page = 1 }) {
  const limit  = 20;
  const offset = (page - 1) * limit;

  const whereClause = status === 'all' ? '' : `WHERE status = $3`;
  const params = status === 'all'
    ? [limit, offset]
    : [limit, offset, status];

  const result = await db.query(
    `SELECT * FROM announcements
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );

  const countParams = status === 'all' ? [] : [status];
  const countWhere  = status === 'all' ? '' : `WHERE status = $1`;
  const countResult = await db.query(
    `SELECT COUNT(*) FROM announcements ${countWhere}`,
    countParams
  );

  return {
    announcements: result.rows,
    total: parseInt(countResult.rows[0].count),
    page,
    pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
  };
}

async function getEstimatedRecipients(segment, targetUserId) {
  const users = await getUsersBySegment(segment, targetUserId);
  return users.length;
}

async function cancelAnnouncement(id) {
  const result = await db.query(
    `UPDATE announcements SET status = 'cancelled'
     WHERE id = $1 AND status = 'scheduled'
     RETURNING id`,
    [id]
  );
  return result.rows.length > 0;
}

module.exports = {
  createAnnouncement,
  sendAnnouncement,
  getAnnouncements,
  getEstimatedRecipients,
  cancelAnnouncement,
};
