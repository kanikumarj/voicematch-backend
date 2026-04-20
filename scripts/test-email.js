'use strict';

/**
 * scripts/test-email.js
 * Quick smoke-test: sends a test email to the address passed as an argument
 * (or the hard-coded default below).
 *
 * Usage:
 *   node scripts/test-email.js kanichiyaan@gmail.com
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

const TO = process.argv[2] || 'kanichiyaan@gmail.com';

// ── Provider builders ──────────────────────────────────────────────────────────
function buildBrevoTransport() {
  const user = process.env.BREVO_SMTP_USER;
  const pass = process.env.BREVO_SMTP_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL || process.env.EMAIL_FROM || user;
  if (!user || !pass) return null;
  return { name: 'Brevo', from: `"VoiceMatch" <${fromEmail}>`, transport: nodemailer.createTransport({
    host:   'smtp-relay.brevo.com',
    port:   587,
    secure: false,
    auth:   { user, pass },
  })};
}

function buildResendTransport() {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.startsWith('re_dev_fake')) return null;
  return { name: 'Resend', from: '"VoiceMatch" <onboarding@resend.dev>', transport: nodemailer.createTransport({
    host:   'smtp.resend.com',
    port:   465,
    secure: true,
    auth:   { user: 'resend', pass: key },
  })};
}

function buildGmailTransport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass || pass === 'your_16_char_app_password_here') return null;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  return { name: 'Gmail', from: `"VoiceMatch" <${user}>`, transport: nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth:   { user, pass },
  })};
}

const providers = [buildBrevoTransport(), buildResendTransport(), buildGmailTransport()]
  .filter(Boolean);

if (providers.length === 0) {
  console.error('❌  No email provider configured in .env — aborting.');
  process.exit(1);
}

console.log(`\n📧  Sending test email to: ${TO}`);
console.log(`🔌  Providers available: ${providers.map(p => p.name).join(', ')}\n`);

const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px">
  <div style="background:linear-gradient(135deg,#6d28d9,#2563eb);padding:28px;border-radius:12px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:28px">🎙 VoiceMatch</h1>
    <p style="color:#e0e7ff;margin:8px 0 0">Email delivery smoke test</p>
  </div>
  <div style="padding:28px 0">
    <p style="font-size:16px;color:#374151">Hello,</p>
    <p style="font-size:15px;color:#6b7280">
      This is an automated test email from your <strong>VoiceMatch</strong> backend.<br>
      If you received this, your email delivery pipeline is working correctly! ✅
    </p>
    <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0">
      <p style="margin:0;font-size:13px;color:#6b7280">Sent at: <strong>${new Date().toISOString()}</strong></p>
      <p style="margin:4px 0 0;font-size:13px;color:#6b7280">Recipient: <strong>${TO}</strong></p>
    </div>
  </div>
  <p style="font-size:12px;color:#9ca3af;text-align:center">VoiceMatch · Automated Test</p>
</body>
</html>
`;

(async () => {
  let sent = false;
  for (const { name, from, transport } of providers) {
    console.log(`⏳  Trying ${name}  (from: ${from}) ...`);
    try {
      const info = await transport.sendMail({
        from,
        to:      TO,
        subject: '✅ VoiceMatch — Email Test',
        html,
      });
      console.log(`✅  Sent via ${name}! Message-ID: ${info.messageId}`);
      sent = true;
      break;
    } catch (err) {
      const detail = err.response || err.message;
      console.error(`❌  ${name} failed (${err.responseCode || 'N/A'}): ${detail}`);
    }
  }

  if (!sent) {
    console.error('\n❌  All providers failed. Check your .env credentials.');
    process.exit(1);
  }
})();
