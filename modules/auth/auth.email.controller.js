'use strict';

const {
  verifyEmailToken,
  resendVerification,
  sendPasswordResetEmail,
  resetPassword,
} = require('../email/email.service');

// ─── GET /api/auth/verify-email?token=xxx ─────────────────────────────────────
async function verifyEmailController(req, res, next) {
  try {
    const { token } = req.query;
    const userId    = await verifyEmailToken(token);

    if (!userId) {
      return res.status(400).json({ error: 'Verification link is invalid or has expired' });
    }

    return res.status(200).json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    return next(err);
  }
}

// ─── POST /api/auth/resend-verification ──────────────────────────────────────
async function resendVerificationController(req, res, next) {
  try {
    await resendVerification(req.user.id);
    return res.status(200).json({ success: true, message: 'Verification email sent' });
  } catch (err) {
    if (err.code === 'ALREADY_VERIFIED') {
      return res.status(409).json({ error: err.message });
    }
    return next(err);
  }
}

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
async function forgotPasswordController(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(422).json({ error: 'Email is required' });

    // Service always resolves — no info leak
    await sendPasswordResetEmail(email);

    return res.status(200).json({
      message: 'If an account with that email exists, a reset link has been sent',
    });
  } catch (err) {
    return next(err);
  }
}

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
async function resetPasswordController(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    await resetPassword(token, newPassword);
    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    if (err.code === 'VALIDATION_ERROR' || err.code === 'TOKEN_INVALID') {
      return res.status(err.code === 'TOKEN_INVALID' ? 400 : 422).json({ error: err.message });
    }
    return next(err);
  }
}

module.exports = {
  verifyEmailController,
  resendVerificationController,
  forgotPasswordController,
  resetPasswordController,
};
