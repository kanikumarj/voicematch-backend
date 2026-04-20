'use strict';

const { submitFeedback, getUserFeedbackSummary } = require('./feedback.service');

async function submitFeedbackController(req, res, next) {
  try {
    const { sessionId, rating, wasReported, reportReason, reportDetail } = req.body;

    if (!sessionId) return res.status(422).json({ error: 'sessionId is required' });
    if (rating === undefined) return res.status(422).json({ error: 'rating is required' });

    const result = await submitFeedback(req.user.id, sessionId, {
      rating:       Number(rating),
      wasReported:  Boolean(wasReported),
      reportReason: reportReason ?? null,
      reportDetail: reportDetail ?? null,
    });

    return res.status(201).json(result);
  } catch (err) {
    if (err.code === 'ALREADY_SUBMITTED') return res.status(409).json({ error: err.message });
    return next(err);
  }
}

async function getFeedbackSummaryController(req, res, next) {
  try {
    const summary = await getUserFeedbackSummary(req.user.id);
    return res.json(summary);
  } catch (err) {
    return next(err);
  }
}

module.exports = { submitFeedbackController, getFeedbackSummaryController };
