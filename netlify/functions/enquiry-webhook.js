/**
 * TMW Productions — Enquiry Webhook
 * Netlify Function: /api/enquiry-webhook
 *
 * Receives form submission data and sends a notification email to the owner.
 * Requires: GMAIL_USER, GMAIL_APP_PASSWORD environment variables in Netlify.
 * Optional: NOTIFICATION_EMAIL (defaults to GMAIL_USER), WEBHOOK_SECRET.
 */

'use strict';

const nodemailer = require('nodemailer');

function structuredLog(data) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...data }));
}

async function sendEnquiryEmail({ name, email, mobile, eventType, eventDate, startTime, endTime, venue, message }) {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
  });

  const rows = [
    ['Name',       name       || '—'],
    ['Email',      email      || '—'],
    ['Phone',      mobile     || '—'],
    ['Event Type', eventType  || '—'],
    ['Event Date', eventDate  || '—'],
    ['Start Time', startTime  || '—'],
    ['End Time',   endTime    || '—'],
    ['Venue',      venue      || '—'],
    ['Message',    message    || '—'],
  ];

  const tableRows = rows
    .map(([label, val]) =>
      `<tr>
        <td style="padding:6px 12px;font-weight:600;white-space:nowrap;color:#722E80;">${label}</td>
        <td style="padding:6px 12px;">${val}</td>
      </tr>`)
    .join('');

  await transporter.sendMail({
    from:    `TMW Productions <${GMAIL_USER}>`,
    to:      process.env.NOTIFICATION_EMAIL || GMAIL_USER,
    replyTo: email || undefined,
    subject: `New Enquiry — ${name || 'Unknown'}${eventType ? ` — ${eventType}` : ''}${eventDate ? ` (${eventDate})` : ''}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="background:#722E80;color:#fff;margin:0;padding:20px 24px;font-size:18px;">
          New Enquiry — TMW Productions
        </h2>
        <table style="width:100%;border-collapse:collapse;font-size:15px;">
          ${tableRows}
        </table>
        <p style="margin:24px;font-size:13px;color:#888;">
          Sent from tmwproductions.co.uk contact form
        </p>
      </div>`
  });
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (expectedSecret) {
    const params = event.queryStringParameters || {};
    if ((params.secret || '') !== expectedSecret) {
      structuredLog({ event: 'auth_failure', reason: 'invalid_secret' });
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorised' }) };
    }
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const {
    name = '', mobile = '', message = '',
    email = '', eventType = '', eventDate = '', startTime = '', endTime = '', venue = ''
  } = body;

  structuredLog({ event: 'enquiry_received', name: name || '(unnamed)' });

  try {
    await sendEnquiryEmail({ name, email, mobile, eventType, eventDate, startTime, endTime, venue, message });
    structuredLog({ event: 'email_sent', name });
  } catch (err) {
    structuredLog({ event: 'email_error', name, error: err.message });
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
