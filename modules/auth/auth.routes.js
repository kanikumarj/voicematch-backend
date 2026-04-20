'use strict';

const { Router }     = require('express');
const { authenticateToken } = require('./auth.middleware');
const { authLimiter, createLimiter } = require('../../middleware/rateLimiter');
const {
  registerController,
  loginController,
  onboardingController,
  getMeController,
} = require('./auth.controller');
const {
  verifyEmailController,
  resendVerificationController,
  forgotPasswordController,
  resetPasswordController,
} = require('./auth.email.controller');

const router = Router();

// Stricter resend limiter: 3 per hour
const resendLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max:      3,
  prefix:   'rl:resend:',
  message:  'Too many resend requests. Please wait an hour.',
});

// ─── Public routes ────────────────────────────────────────────────────────────
router.post('/register',         authLimiter, registerController);
router.post('/login',            authLimiter, loginController);
router.get('/verify-email',                   verifyEmailController);
router.post('/forgot-password',  authLimiter, forgotPasswordController);
router.post('/reset-password',               resetPasswordController);

// ─── Protected routes ─────────────────────────────────────────────────────────
router.post('/onboarding',        authenticateToken, onboardingController);
router.get('/me',                 authenticateToken, getMeController);
router.post('/resend-verification', authenticateToken, resendLimiter, resendVerificationController);

module.exports = router;
