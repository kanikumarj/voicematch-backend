'use strict';
require('dotenv').config();
const nodemailer = require('nodemailer');

const user = process.env.BREVO_SMTP_USER;
const pass = process.env.BREVO_SMTP_KEY;

if (!user || !pass) {
  console.error('Missing BREVO_SMTP_USER or BREVO_SMTP_KEY in .env');
  process.exit(1);
}

const t = nodemailer.createTransport({
  host:   'smtp-relay.brevo.com',
  port:   587,
  secure: false,
  auth:   { user, pass },
});

t.sendMail({
  from:    'VoiceMatch <' + user + '>',
  to:      user,          // sends to the brevo smtp login itself as a sanity test
  subject: 'VoiceMatch — Signup / Resend email fix test',
  html:    '<h2>It works!</h2><p>The from-address fix is working. Signup and resend-verification emails will now be delivered.</p>',
  replyTo: process.env.EMAIL_FROM,
}).then(function(info) {
  console.log('[OK] Email sent! messageId:', info.messageId);
  console.log('     Check your Brevo dashboard Logs — you should see it there now.');
}).catch(function(err) {
  var detail = err.response || err.message;
  console.error('[FAIL] code=' + (err.responseCode || 'N/A'), detail);
});
