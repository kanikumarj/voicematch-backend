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

const getClientUrl = () => {
  if (process.env.CLIENT_URL) return process.env.CLIENT_URL;
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) return 'https://voicematchi-backend.vercel.app';
  return 'http://localhost:5173';
};

router.get('/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user, info) => {
      if (err) {
        console.error('Google Auth Database/Server Error:', err.message);
        return res.redirect(`${getClientUrl()}/login?error=database_connection_failed`);
      }
      if (!user) {
        return res.redirect(`${getClientUrl()}/login?error=google_auth_failed`);
      }
      req.user = user;
      next();
    })(req, res, next);
  },
  (req, res) => {
    try {
      const token = jwt.sign(
        { id: req.user.id, email: req.user.email },
        process.env.JWT_SECRET || 'dev-super-secret-jwt-key-voicematch-2024-change-in-prod',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );
      res.redirect(`${getClientUrl()}/auth/callback?token=${token}`);
    } catch (err) {
      console.error('Google Callback Error:', err);
      res.redirect(`${getClientUrl()}/login?error=server_error`);
    }
  }
);

module.exports = router;
