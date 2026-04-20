'use strict';

/**
 * utils/response.js
 * Standard response helpers — all controllers must use these.
 * Ensures consistent shape: { success, data } or { success, message, code }
 */

function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function created(res, data) {
  return success(res, data, 201);
}

function error(res, message, statusCode = 400, code = null) {
  const body = { success: false, message };
  if (code) body.code = code;
  return res.status(statusCode).json(body);
}

function paginated(res, data, total, page, limit) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}

function noContent(res) {
  return res.status(204).end();
}

module.exports = { success, created, error, paginated, noContent };
