'use strict';



function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function globalErrorHandler(err, _req, res, _next) {
  const CODE_MAP = {
    VALIDATION_ERROR:    422,
    EMAIL_EXISTS:        409,
    INVALID_CREDENTIALS: 401,
    ALREADY_ONBOARDED:   409,
    ALREADY_VERIFIED:    409,
    TOKEN_INVALID:       400,
    NOT_FOUND:           404,
    UNAUTHORIZED:        401,
    FORBIDDEN:           403,
    RATE_LIMITED:        429,
  };

  const status = CODE_MAP[err.code] ?? 500;

  // Report unexpected errors to Sentry (not app-level validation errors)
  if (status === 500) {
    console.error('[InternalError]', err);
  }

  if (process.env.NODE_ENV === 'production') {
    process.stderr.write(`[ERROR] ${err.stack}\n`);
    if (status === 500) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    return res.status(status).json({ error: err.message });
  }

  // Non-production: surface full detail for debugging
  process.stderr.write(`[ERROR] ${err.stack}\n`);
  return res.status(status).json({
    error: err.message,
    code:  err.code,
    ...(status === 500 && { stack: err.stack }),
  });
}

// FIXED: Include method and path for easier debugging
function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
}

module.exports = { asyncHandler, globalErrorHandler, notFoundHandler };
