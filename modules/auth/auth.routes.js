'use strict';

const { Router }     = require('express');
const passport       = require('passport');
const jwt            = require('jsonwebtoken');
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

// ─── Google OAuth ─────────────────────────────────────────────────────────────
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

router.get('/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=google`
  }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/callback?token=${token}`);
  }
);

module.exports = router;
