/**
 * Vercel Serverless Function entry point.
 * 
 * This file wraps the Express app as a Vercel serverless function.
 * Socket.IO and other long-running features are disabled in this mode
 * because Vercel functions are stateless and short-lived.
 */
'use strict';

// Set Vercel flag BEFORE loading server.js so modules can detect serverless mode
process.env.VERCEL = '1';

let app;
try {
  app = require('../server.js');
} catch (err) {
  // If server.js fails to load, return a diagnostic Express app
  const express = require('express');
  app = express();
  app.use((req, res) => {
    res.status(500).json({
      error: 'Server failed to initialize',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });
  console.error('[VERCEL] Failed to load server.js:', err.message);
}

module.exports = app;
