'use strict';

const db    = require('../../db');
const redis = require('../../db/redis');
const { updateTrustScore } = require('../moderation/trust.service');
const { createReport }     = require('../moderation/report.service');
const { updateStreak }     = require('../retention/streak.service');

// ─── Submit feedback after a call ─────────────────────────────────────────────
async function submitFeedback(reviewerId, sessionId, data) {
  const { rating, wasReported, reportReason, reportDetail } = data;

  // ── Validate rating ────────────────────────────────────────────────────────
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw Object.assign(new Error('Rating must be an integer between 1 and 5'), { code: 'VALIDATION_ERROR' });
  }
  if (wasReported && !reportReason) {
    throw Object.assign(new Error('Report reason is required when reporting a user'), { code: 'VALIDATION_ERROR' });
  }

  const VALID_REASONS = ['harassment', 'hate_speech', 'spam', 'inappropriate', 'other'];
  if (reportReason && !VALID_REASONS.includes(reportReason)) {
    throw Object.assign(new Error('Invalid report reason'), { code: 'VALIDATION_ERROR' });
  }

  // ── Validate session ownership + recency ──────────────────────────────────
  const { rows: sessionRows } = await db.query(
    `SELECT user_a_id, user_b_id, ended_at, started_at
     FROM sessions WHERE id = $1`,
    [sessionId],
  );

  if (!sessionRows[0]) {
    throw Object.assign(new Error('Session not found'), { code: 'NOT_FOUND' });
  }

  const session = sessionRows[0];
  const isParticipant = [session.user_a_id, session.user_b_id].includes(reviewerId);
  if (!isParticipant) {
    throw Object.assign(new Error('You were not part of this session'), { code: 'FORBIDDEN' });
  }

  if (!session.ended_at) {
    throw Object.assign(new Error('Cannot submit feedback for an active call'), { code: 'VALIDATION_ERROR' });
  }

  const ageHours = (Date.now() - new Date(session.ended_at).getTime()) / (1000 * 60 * 60);
  if (ageHours > 24) {
    throw Object.assign(new Error('Feedback window has expired (24 hours)'), { code: 'VALIDATION_ERROR' });
  }

  // Determine who is being reviewed
  const reviewedId = session.user_a_id === reviewerId ? session.user_b_id : session.user_a_id;

  // ── Insert feedback (UNIQUE constraint handles duplicate) ─────────────────
  try {
    await db.query(
      `INSERT INTO call_feedback
         (session_id, reviewer_id, reviewed_id, rating, was_reported, report_reason, report_detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sessionId, reviewerId, reviewedId, rating, wasReported ?? false, reportReason ?? null, reportDetail ?? null],
    );
  } catch (err) {
    if (err.code === '23505') {
      throw Object.assign(new Error('Feedback already submitted for this session'), { code: 'ALREADY_SUBMITTED' });
    }
    throw err;
  }

  // ── Side-effects (non-blocking) ────────────────────────────────────────────
  // Trust score update — fire and forget
  updateTrustScore(reviewedId).catch(err =>
    process.stderr.write(`[FEEDBACK] Trust update failed for ${reviewedId}: ${err.message}\n`),
  );

  // Report creation if flagged
  if (wasReported) {
    createReport(reviewerId, reviewedId, sessionId, reportReason, reportDetail ?? null).catch(err =>
      process.stderr.write(`[FEEDBACK] Report creation failed: ${err.message}\n`),
    );
  }

  // Streak update — only if call lasted > 60 seconds
  const callDuration = session.ended_at
    ? (new Date(session.ended_at) - new Date(session.started_at)) / 1000
    : 0;

  if (callDuration >= 60) {
    updateStreak(reviewerId).catch(err =>
      process.stderr.write(`[STREAK] Update failed for ${reviewerId}: ${err.message}\n`),
    );
  }

  return { success: true };
}

// ─── Get feedback summary for a user (admin / profile view) ──────────────────
async function getUserFeedbackSummary(userId) {
  const { rows } = await db.query(
    `SELECT
       COUNT(*)::int                      AS total_ratings,
       ROUND(AVG(rating)::numeric, 1)     AS avg_rating,
       COUNT(*) FILTER (WHERE rating = 5)::int AS five_star,
       COUNT(*) FILTER (WHERE rating = 1)::int AS one_star,
       COUNT(*) FILTER (WHERE was_reported)::int AS report_count
     FROM call_feedback
     WHERE reviewed_id = $1`,
    [userId],
  );
  return rows[0];
}

module.exports = { submitFeedback, getUserFeedbackSummary };
