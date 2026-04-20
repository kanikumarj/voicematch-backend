
'use strict';

const {
  registerUser,
  loginUser,
  completeOnboarding,
  getUserById,
} = require('./auth.service');

// ─── Register ────────────────────────────────────────────────────────────────
async function registerController(req, res) {
  try {
    const result = await registerUser(req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err.code === 'VALIDATION_ERROR') {
      return res.status(422).json({ error: err.message });
    }
    if (err.code === 'EMAIL_EXISTS') {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Login ───────────────────────────────────────────────────────────────────
async function loginController(req, res) {
  try {
    const result = await loginUser(req.body);
    return res.status(200).json(result);
  } catch (err) {
    if (err.code === 'VALIDATION_ERROR') {
      return res.status(422).json({ error: err.message });
    }
    if (err.code === 'INVALID_CREDENTIALS') {
      // Generic message — no info leak on email existence
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Onboarding ──────────────────────────────────────────────────────────────
async function onboardingController(req, res) {
  try {
    const result = await completeOnboarding(req.user.id, req.body);
    return res.status(200).json(result);
  } catch (err) {
    if (err.code === 'VALIDATION_ERROR') {
      return res.status(422).json({ error: err.message });
    }
    if (err.code === 'ALREADY_ONBOARDED') {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Me ──────────────────────────────────────────────────────────────────────
async function getMeController(req, res) {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json(user);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  registerController,
  loginController,
  onboardingController,
  getMeController,
};
