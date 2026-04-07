#!/usr/bin/env node
// update-availability.js
// Fetches a Planning Beats iCal feed and updates availability.json
// with calculated booking percentages for 2026 and 2027.

'use strict';

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const AVAILABILITY_PATH = path.join(__dirname, '..', 'availability.json');
const YEARS = ['2026', '2027'];

// Total bookable weekend days per year (Fri + Sat, 52 weeks each)
// 2026: 52 Fridays + 52 Saturdays = 104
// 2027: 52 Fridays + 53 Saturdays = 105  (Jan 1 2027 is a Friday)
const TOTAL_DATES = { '2026': 104, '2027': 105 };

// ── Label thresholds ──────────────────────────────────────────────────────────

function labelForPercent(pct) {
  if (pct >= 90) return 'Almost fully booked — contact immediately';
  if (pct >= 75) return 'Limited dates remaining';
  if (pct >= 50) return 'Filling fast — check your date soon';
  return 'Dates still available — enquire now';
}

// ── Simple iCal parser ────────────────────────────────────────────────────────
// Extracts unique calendar dates (YYYY-MM-DD strings) from iCal text.
// Handles both:
//   DTSTART;VALUE=DATE:20261015
//   DTSTART:20261015T180000Z
//   DTSTART;TZID=Europe/London:20261015T190000

function parseIcalDates(icalText) {
  const dates = new Set();
  // Match any DTSTART line and capture the date portion
  const re = /^DTSTART[^:]*:(\d{4})(\d{2})(\d{2})/gm;
  let m;
  while ((m = re.exec(icalText)) !== null) {
    dates.add(`${m[1]}-${m[2]}-${m[3]}`);
  }
  return dates;
}

// ── HTTP(S) fetch ─────────────────────────────────────────────────────────────

function fetchUrl(url, apiKey) {
  return new Promise(function(resolve, reject) {
    const client  = url.startsWith('https') ? https : http;
    const options = apiKey ? { headers: { 'Authorization': 'Bearer ' + apiKey } } : {};
    const req = client.get(url, options, function(res) {
      // Follow a single redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error('HTTP ' + res.statusCode + ' fetching iCal feed'));
      }
      const chunks = [];
      res.on('data', function(chunk) { chunks.push(chunk); });
      res.on('end', function() { resolve(Buffer.concat(chunks).toString('utf8')); });
    });
    req.on('error', reject);
    req.setTimeout(15000, function() {
      req.destroy(new Error('Request timed out after 15s'));
    });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const icalUrl = process.env.PLANNING_BEATS_ICAL_URL;
  const apiKey  = process.env.PLANNING_BEATS_API_KEY;

  if (!icalUrl) {
    console.warn('[update-availability] PLANNING_BEATS_ICAL_URL is not set — skipping update.');
    process.exit(0);
  }

  // Read existing availability.json so we can respect override flags
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(AVAILABILITY_PATH, 'utf8'));
  } catch (e) {
    console.warn('[update-availability] Could not read existing availability.json — will create fresh.');
  }

  // Check whether all years are overridden — skip network call if so
  const yearsToUpdate = YEARS.filter(function(yr) {
    return !(existing[yr] && existing[yr].override === true);
  });

  if (yearsToUpdate.length === 0) {
    console.log('[update-availability] All years have override:true — nothing to recalculate.');
    process.exit(0);
  }

  // Fetch iCal feed
  let icalText;
  try {
    console.log('[update-availability] Fetching iCal feed…');
    icalText = await fetchUrl(icalUrl, apiKey);
    console.log('[update-availability] Feed fetched (' + icalText.length + ' bytes).');
  } catch (err) {
    console.error('[update-availability] Network error fetching iCal feed:', err.message);
    console.error('[update-availability] Leaving availability.json unchanged.');
    process.exit(0);
  }

  // Parse all booked dates
  const allDates = parseIcalDates(icalText);

  // Build updated data
  const updated = Object.assign({}, existing);

  for (const yr of yearsToUpdate) {
    // Count how many booked dates fall in this year
    let booked = 0;
    allDates.forEach(function(d) {
      if (d.startsWith(yr + '-')) booked++;
    });

    const total  = TOTAL_DATES[yr] || 104;
    const pct    = Math.round((booked / total) * 100);
    const label  = labelForPercent(pct);

    console.log('[update-availability] ' + yr + ': ' + booked + ' booked / ' + total + ' total = ' + pct + '% — "' + label + '"');

    updated[yr] = { percent: pct, label: label };
    // Preserve any extra fields the year entry had (e.g. override:false)
    if (existing[yr]) {
      const extras = Object.assign({}, existing[yr]);
      delete extras.percent;
      delete extras.label;
      Object.assign(updated[yr], extras);
    }
  }

  // Copy over any overridden years unchanged
  YEARS.forEach(function(yr) {
    if (!yearsToUpdate.includes(yr) && existing[yr]) {
      updated[yr] = existing[yr];
    }
  });

  // Write result
  try {
    fs.writeFileSync(AVAILABILITY_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf8');
    console.log('[update-availability] availability.json updated successfully.');
  } catch (err) {
    console.error('[update-availability] Failed to write availability.json:', err.message);
    process.exit(1);
  }
}

main().catch(function(err) {
  console.error('[update-availability] Unexpected error:', err);
  process.exit(1);
});
