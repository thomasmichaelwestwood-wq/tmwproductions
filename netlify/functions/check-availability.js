'use strict';

/**
 * TMW Productions — Availability Checker
 * GET /api/check-availability?date=YYYY-MM-DD
 *
 * Fetches the Planning Beats iCal feed and returns whether
 * the requested date is free or booked.
 *
 * Requires env var: PLANNING_BEATS_ICAL_URL
 */

const https = require('https');
const http  = require('http');

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

function respond(statusCode, data) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(data) };
}

// ── Fetch a URL and return the response body as a string ─────────────────────

function fetchText(url, apiKey) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const options = { headers: {} };
    if (apiKey) options.headers['Authorization'] = `Bearer ${apiKey}`;

    const req = client.get(url, options, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location, apiKey).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

// ── iCal parser ───────────────────────────────────────────────────────────────

/**
 * Parse a DTSTART or DTEND value (with or without TZID param) into a Date.
 * Treats all times as local (UK) — good enough for full-day booking checks.
 */
function parseIcalDate(rawLine) {
  // Strip any parameters (e.g. DTSTART;TZID=Europe/London:20260415T180000)
  const val = rawLine.includes(':') ? rawLine.split(':').slice(1).join(':').trim() : rawLine.trim();

  const d = val.replace(/[TZ]/g, '');
  if (d.length < 8) return null;

  return new Date(
    parseInt(d.substr(0, 4), 10),
    parseInt(d.substr(4, 2), 10) - 1,
    parseInt(d.substr(6, 2), 10),
    d.length >= 12 ? parseInt(d.substr(8,  2), 10) : 0,
    d.length >= 14 ? parseInt(d.substr(10, 2), 10) : 0,
    d.length >= 16 ? parseInt(d.substr(12, 2), 10) : 0
  );
}

/**
 * Returns true if the iCal data contains any event that falls on targetDate.
 */
function isDateBooked(icalText, targetDate) {
  const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const dayEnd   = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

  const blocks = icalText.split('BEGIN:VEVENT');
  blocks.shift(); // remove everything before first VEVENT

  for (const block of blocks) {
    const startMatch = block.match(/^DTSTART[^\r\n]*/m);
    const endMatch   = block.match(/^DTEND[^\r\n]*/m);

    if (!startMatch) continue;

    const eventStart = parseIcalDate(startMatch[0]);
    if (!eventStart) continue;

    // Normalise to date-only for overlap check
    const eStart = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate());

    let eEnd;
    if (endMatch) {
      const eventEnd = parseIcalDate(endMatch[0]);
      if (eventEnd) {
        eEnd = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate());
        // iCal all-day DTEND is exclusive (next day), timed events are inclusive date
        // Treat both the same — if eEnd equals eStart the event is single-day
        if (eEnd <= eStart) eEnd = new Date(eStart.getTime() + 86400000);
      }
    }
    if (!eEnd) eEnd = new Date(eStart.getTime() + 86400000); // default: 1 day

    // Overlap: event starts before end of target day AND ends after start of target day
    if (eStart < dayEnd && eEnd > dayStart) return true;
  }

  return false;
}

// ── Extract all events from iCal ──────────────────────────────────────────────

function parseAllEvents(icalText) {
  const events = [];
  const blocks = icalText.split('BEGIN:VEVENT');
  blocks.shift();

  for (const block of blocks) {
    const startMatch   = block.match(/^DTSTART[^\r\n]*/m);
    const summaryMatch = block.match(/^SUMMARY[^\r\n]*/m);
    if (!startMatch) continue;

    const eventStart = parseIcalDate(startMatch[0]);
    if (!eventStart) continue;

    const dateStr  = `${eventStart.getFullYear()}-${String(eventStart.getMonth()+1).padStart(2,'0')}-${String(eventStart.getDate()).padStart(2,'0')}`;
    const summary  = summaryMatch ? summaryMatch[0].replace(/^SUMMARY[^:]*:/i,'').trim() : '';

    events.push({ date: dateStr, summary });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}



exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }

  const params  = event.queryStringParameters || {};
  const dateStr = params.date;
  const mode    = params.mode;

  // ── Debug mode: return raw iCal sample ──────────────────────────────────
  if (mode === 'debug') {
    const icalUrl = process.env.PLANNING_BEATS_ICAL_URL;
    const apiKey  = process.env.PLANNING_BEATS_API_KEY;
    if (!icalUrl) return respond(500, { error: 'Calendar not configured' });
    try {
      const icalText = await fetchText(icalUrl, apiKey);
      const events   = parseAllEvents(icalText);
      return respond(200, {
        total_events: events.length,
        events_sample: events.slice(0, 10),
        raw_sample: icalText.slice(0, 3000)
      });
    } catch (err) {
      return respond(500, { error: err.message });
    }
  }

  // ── List mode: return all booked events ──────────────────────────────────
  if (mode === 'list') {
    const icalUrl = process.env.PLANNING_BEATS_ICAL_URL;
    const apiKey  = process.env.PLANNING_BEATS_API_KEY;
    if (!icalUrl) return respond(500, { error: 'Calendar not configured' });

    try {
      const icalText = await fetchText(icalUrl, apiKey);
      if (!icalText.includes('BEGIN:VCALENDAR')) {
        return respond(502, { error: 'Unexpected response from calendar' });
      }
      const events = parseAllEvents(icalText);
      return respond(200, { events });
    } catch (err) {
      console.error(JSON.stringify({ event: 'list_error', error: err.message }));
      return respond(500, { error: 'Could not fetch calendar' });
    }
  }

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return respond(400, { error: 'Missing or invalid date. Use ?date=YYYY-MM-DD' });
  }

  const icalUrl = process.env.PLANNING_BEATS_ICAL_URL;
  const apiKey  = process.env.PLANNING_BEATS_API_KEY;

  if (!icalUrl) {
    console.error(JSON.stringify({ event: 'availability_error', reason: 'PLANNING_BEATS_ICAL_URL not set' }));
    return respond(500, { error: 'Calendar not configured' });
  }

  try {
    const icalText = await fetchText(icalUrl, apiKey);

    // Sanity check — a valid iCal response contains BEGIN:VCALENDAR
    if (!icalText.includes('BEGIN:VCALENDAR')) {
      console.error(JSON.stringify({
        event:  'availability_error',
        reason: 'Response does not look like iCal',
        preview: icalText.slice(0, 200)
      }));
      return respond(502, { error: 'Unexpected response from calendar' });
    }

    const [y, m, d] = dateStr.split('-').map(Number);
    const target    = new Date(y, m - 1, d);
    const booked    = isDateBooked(icalText, target);

    return respond(200, { available: !booked, date: dateStr });
  } catch (err) {
    console.error(JSON.stringify({ event: 'availability_error', error: err.message, url: icalUrl ? icalUrl.replace(/\/\d+$/, '/***') : 'not set' }));
    return respond(500, { error: 'Could not fetch calendar', detail: err.message });
  }
};
