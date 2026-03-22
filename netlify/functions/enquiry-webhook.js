/**
 * TMW Productions — WhatsApp Enquiry Webhook
 * Netlify Function: /api/enquiry-webhook
 *
 * Receives form submission data, validates WhatsApp consent,
 * and sends a one-time confirmation message via Twilio.
 *
 * UK GDPR / PECR notes:
 *  - A message is only sent when whatsapp_consent === true (explicit opt-in).
 *  - The opt-in is granular: it covers this single confirmation only.
 *  - Mobile numbers are never written to disk or logged.
 *  - Consent records (name + status, no mobile) are written to consent-log.json.
 *
 * ─── PRODUCTION TEMPLATE REQUIREMENT ────────────────────────────────────────
 * WhatsApp Business API (used via Twilio) requires pre-approved message
 * templates for messages sent outside a 24-hour customer-initiated window.
 * Before going live, submit your message template to Meta via the Twilio
 * console: https://console.twilio.com → Messaging → WhatsApp Senders →
 * Message Templates. The template must match EXACTLY what is sent below.
 * During development, use the Twilio Sandbox (no template approval needed).
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const twilio = require('twilio');
const fs     = require('fs');
const path   = require('path');

// ─── Consent log path ────────────────────────────────────────────────────────
// NOTE: In a Netlify Function (serverless/Lambda), the filesystem is
// read-only except for /tmp. consent-log.json in /tmp is ephemeral —
// it resets between function cold-starts. For a persistent audit trail
// in production, replace this with an append to Airtable, Google Sheets,
// a managed database, or a logging service such as Papertrail.
const LOG_PATH = process.env.CONSENT_LOG_PATH || '/tmp/consent-log.json';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalise a UK mobile number to E.164 format (+44...).
 * Handles: 07xxx, 447xxx, +447xxx, international numbers left as-is.
 * Returns null if the input is empty or clearly invalid.
 */
function normaliseUKMobile(raw) {
  if (!raw) return null;
  // Strip whitespace, dashes, parentheses
  let n = raw.replace(/[\s\-().]/g, '');
  if (!n) return null;
  if (n.startsWith('0'))   n = '+44' + n.slice(1);
  if (n.startsWith('44'))  n = '+' + n;
  // Basic sanity: E.164 is + followed by 7–15 digits
  if (!/^\+\d{7,15}$/.test(n)) return null;
  return n;
}

/**
 * Append a single entry to the consent log file.
 * Only writes: timestamp, name, consent status, send status.
 * Mobile numbers are never included — ICO guidance for small businesses.
 */
function appendConsentLog(entry) {
  try {
    let log = [];
    if (fs.existsSync(LOG_PATH)) {
      try { log = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')); } catch (_) { log = []; }
    }
    log.push(entry);
    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2), 'utf8');
  } catch (err) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'consent_log_write_error',
      error: err.message
    }));
  }
}

/**
 * Structured console log — no mobile numbers ever appear here.
 */
function structuredLog(data) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...data }));
}

// ─── Handler ─────────────────────────────────────────────────────────────────

exports.handler = async function (event) {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // ── Secret verification ───────────────────────────────────────────────────
  // sendBeacon cannot set custom headers, so the secret is passed as a query
  // param when the front-end includes it. If WEBHOOK_SECRET is not set in env,
  // the check is skipped (useful during local development).
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (expectedSecret) {
    const params      = event.queryStringParameters || {};
    const givenSecret = params.secret || '';
    if (givenSecret !== expectedSecret) {
      structuredLog({ event: 'auth_failure', reason: 'invalid_secret' });
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorised' }) };
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { name = '', mobile = '', whatsapp_consent, message = '' } = body;
  const consentGiven = whatsapp_consent === true || whatsapp_consent === 'true';

  structuredLog({
    event:          'enquiry_received',
    name:           name || '(unnamed)',
    consent_given:  consentGiven
  });

  // ── No consent or no mobile — log and exit cleanly ────────────────────────
  if (!consentGiven) {
    structuredLog({ event: 'no_whatsapp_sent', reason: 'consent_not_given', name });
    return { statusCode: 200, body: JSON.stringify({ ok: true, whatsapp: 'skipped_no_consent' }) };
  }

  if (!mobile) {
    structuredLog({ event: 'no_whatsapp_sent', reason: 'mobile_missing', name });
    return { statusCode: 200, body: JSON.stringify({ ok: true, whatsapp: 'skipped_no_mobile' }) };
  }

  // ── Normalise number ──────────────────────────────────────────────────────
  const e164 = normaliseUKMobile(mobile);
  if (!e164) {
    structuredLog({ event: 'no_whatsapp_sent', reason: 'mobile_invalid', name });
    return { statusCode: 200, body: JSON.stringify({ ok: true, whatsapp: 'skipped_invalid_mobile' }) };
  }

  // ── Validate Twilio env vars ──────────────────────────────────────────────
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_NUMBER,
    BUSINESS_NAME = 'TMW Productions'
  } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
    structuredLog({ event: 'no_whatsapp_sent', reason: 'twilio_env_missing', name });
    return { statusCode: 500, body: JSON.stringify({ error: 'Twilio configuration missing' }) };
  }

  // ── Build message ─────────────────────────────────────────────────────────
  // IMPORTANT: For production (outside the Twilio Sandbox), this exact text
  // must be submitted to Meta as an approved message template via:
  // Twilio Console → Messaging → WhatsApp Senders → Message Templates.
  // The template name and variables must match your approved submission.
  // During sandbox testing no approval is required.
  const firstName = name.split(' ')[0] || name;
  const messageBody =
    `Hi ${firstName}, thanks for getting in touch — I've received your enquiry ` +
    `and will get back to you as soon as possible.\n— ${BUSINESS_NAME}`;

  // ── Send via Twilio ───────────────────────────────────────────────────────
  let sendStatus = 'failed';
  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const result = await client.messages.create({
      from: TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:')
        ? TWILIO_WHATSAPP_NUMBER
        : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
      to:   `whatsapp:${e164}`,
      body: messageBody
    });

    sendStatus = 'sent';
    structuredLog({
      event:      'whatsapp_sent',
      name,
      twilio_sid: result.sid,
      status:     result.status
    });
  } catch (err) {
    sendStatus = 'failed';
    structuredLog({
      event:        'whatsapp_send_error',
      name,
      twilio_code:  err.code   || null,
      twilio_msg:   err.message || String(err)
    });
  }

  // ── Write consent record ──────────────────────────────────────────────────
  appendConsentLog({
    timestamp:     new Date().toISOString(),
    name:          name || '(unnamed)',
    consent_given: true,
    send_status:   sendStatus
    // mobile intentionally omitted — GDPR compliance
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, whatsapp: sendStatus })
  };
};
