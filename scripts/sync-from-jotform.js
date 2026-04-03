/**
 * scripts/sync-from-jotform.js
 *
 * Fetches ALL submissions from the TMW Productions supplier directory form
 * on Jotform, transforms them into the supplier data format, and writes the
 * result to /public/data/suppliers.json.
 *
 * Usage:
 *   JOTFORM_API_KEY=your_key node scripts/sync-from-jotform.js
 *   -- or --
 *   npm run sync-suppliers
 *
 * Requires Node >= 18 (uses built-in fetch).
 *
 * PRIVATE FIELDS: q8 (contact name) and q9 (contact email) are never written
 * to any output file. Only q2–q7 and q10 are included in suppliers.json.
 */

'use strict';

// Load .env if present (so `npm run sync-suppliers` works without prefixing env vars)
try { require('dotenv').config({ quiet: true }); } catch (_) { /* dotenv optional */ }

const fs   = require('fs');
const path = require('path');
const https = require('https');

// ─── Config ──────────────────────────────────────────────────────────────────

const FORM_ID   = '260812287727059';
const API_BASE  = 'https://eu-api.jotform.com';
const LOGOS_DIR = path.join(__dirname, '..', 'public', 'data', 'logos');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract a plain-string answer from a Jotform answers object.
 * Handles both simple string answers and complex objects (fullname, file
 * upload, etc.). Never returns private fields.
 * @param {Object} answers - Submission answers keyed by question number string
 * @param {number} qNum    - Question number (2, 3, 4, …)
 * @returns {string}
 */
function extractAnswer(answers, qNum) {
  const entry = answers[String(qNum)];
  if (!entry) return '';
  const val = entry.answer;
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (Array.isArray(val)) return val.filter(Boolean).join(', ').trim();
  if (typeof val === 'object') {
    // File upload: { filename, url } or just a URL string
    if (typeof val.url === 'string') return val.url.trim();
    // Fullname widget: { first, last, middle }
    if (val.first !== undefined || val.last !== undefined) {
      return [val.first, val.middle, val.last].filter(Boolean).join(' ').trim();
    }
    // Fallback: join all values
    return Object.values(val).filter(Boolean).join(' ').trim();
  }
  return String(val).trim();
}

/**
 * Ensure a URL includes https:// if no protocol is present.
 */
function normalizeUrl(url) {
  if (!url) return null;
  url = url.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}

/**
 * Trim description to the nearest sentence boundary at or below maxLen.
 * Falls back to word boundary if no sentence boundary exists.
 */
function trimDescription(text, maxLen = 400) {
  if (!text) return '';
  text = text.trim();
  if (text.length <= maxLen) return text;

  const sub = text.slice(0, maxLen);

  // Walk backwards from the limit to find a sentence-ending punctuation
  for (let i = sub.length - 1; i > maxLen / 2; i--) {
    if ('.!?'.includes(sub[i])) {
      // Make sure it's a genuine sentence end (followed by space, newline, or end)
      const next = sub[i + 1];
      if (next === undefined || next === ' ' || next === '\n') {
        return text.slice(0, i + 1).trim();
      }
    }
  }

  // Fall back to last word boundary
  const lastSpace = sub.lastIndexOf(' ');
  return text.slice(0, lastSpace > 0 ? lastSpace : maxLen).trim() + '…';
}

/**
 * Sort suppliers alphabetically by name within each category.
 */
function sortSuppliers(suppliers) {
  return [...suppliers].sort((a, b) => {
    const catA = (a.category || '').toLowerCase();
    const catB = (b.category || '').toLowerCase();
    if (catA < catB) return -1;
    if (catA > catB) return 1;
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });
}

/**
 * Transform a raw Jotform submission object into a supplier record.
 * Returns null for incomplete submissions (no name).
 * NEVER includes q8 or q9.
 */
function transformSubmission(sub) {
  const { id, answers, created_at } = sub;

  const name        = extractAnswer(answers, 2);
  const category    = extractAnswer(answers, 3);
  const subcategory = extractAnswer(answers, 4);
  const description = extractAnswer(answers, 5);
  const website     = extractAnswer(answers, 6);
  const area        = extractAnswer(answers, 7);
  // q8 and q9 are intentionally skipped (private: contact name / email)
  const logoRaw     = extractAnswer(answers, 10);

  if (!name) return null; // Skip incomplete submissions

  // Jotform timestamps: "2026-03-23 05:29:00" → ISO 8601
  const added_at = created_at
    ? created_at.replace(' ', 'T').replace(/(\d{2}:\d{2}:\d{2})$/, '$1Z')
    : new Date().toISOString();

  return {
    id,
    name,
    category:    category    || null,
    subcategory: subcategory || null,
    description: trimDescription(description) || null,
    website:     normalizeUrl(website),
    area:        area        || null,
    logo_url:    logoRaw     || null,
    added_at
  };
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all submissions for the form, handling pagination automatically.
 */
async function fetchAllSubmissions(apiKey) {
  const submissions = [];
  const limit = 1000;
  let offset = 0;

  while (true) {
    const url =
      `${API_BASE}/form/${FORM_ID}/submissions` +
      `?apiKey=${encodeURIComponent(apiKey)}` +
      `&limit=${limit}&offset=${offset}` +
      `&orderby=created_at&direction=ASC`;

    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Jotform API returned ${res.status}: ${text}`);
    }

    const data = await res.json();
    if (data.responseCode !== 200) {
      throw new Error(`Jotform API error: ${data.message}`);
    }

    const batch = Array.isArray(data.content) ? data.content : [];
    submissions.push(...batch);

    // resultSet tells us the total; stop when we have everything
    const total = data.resultSet?.count ?? batch.length;
    if (batch.length === 0 || submissions.length >= total) break;
    offset += limit;
  }

  return submissions;
}

// ─── Logo download ────────────────────────────────────────────────────────────

/**
 * Download a logo from a URL and save it to LOGOS_DIR/{id}.{ext}.
 * Returns the local web-relative path, or null if the download fails.
 * Skips download if the file already exists.
 */
function downloadLogo(url, id) {
  return new Promise((resolve) => {
    // Derive extension from the URL filename, default to .jpg
    const urlPath = url.split('?')[0];
    const ext = path.extname(urlPath).toLowerCase() || '.jpg';
    const filename = `${id}${ext}`;
    const localPath = path.join(LOGOS_DIR, filename);
    const webPath = `public/data/logos/${filename}`;

    if (fs.existsSync(localPath)) {
      return resolve(webPath); // Already downloaded
    }

    const encodedUrl = url.replace(/ /g, '%20');
    const tmp = localPath + '.tmp';
    const file = fs.createWriteStream(tmp);

    const cleanup = () => { try { fs.unlinkSync(tmp); } catch (_) {} };

    const request = https.get(encodedUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        cleanup();
        return downloadLogo(res.headers.location, id).then(resolve);
      }
      if (res.statusCode !== 200) {
        file.close();
        cleanup();
        console.warn(`  ⚠ Logo download failed (${res.statusCode}): ${url}`);
        return resolve(null);
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => {
        fs.rename(tmp, localPath, () => resolve(webPath));
      }));
    });

    request.on('error', (err) => {
      file.close();
      cleanup();
      console.warn(`  ⚠ Logo download error: ${err.message}`);
      resolve(null);
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.JOTFORM_API_KEY;
  if (!apiKey) {
    console.error('Error: JOTFORM_API_KEY environment variable is not set.');
    console.error('Set it before running: JOTFORM_API_KEY=xxx npm run sync-suppliers');
    process.exit(1);
  }

  console.log(`Connecting to Jotform EU API (form ${FORM_ID})…`);
  const rawSubmissions = await fetchAllSubmissions(apiKey);
  console.log(`Fetched ${rawSubmissions.length} submission(s).`);

  const suppliers = rawSubmissions
    .map(transformSubmission)
    .filter(Boolean);

  // Download logos locally so they're served from our domain (Jotform blocks hotlinking)
  fs.mkdirSync(LOGOS_DIR, { recursive: true });
  console.log('Downloading supplier logos…');
  for (const supplier of suppliers) {
    if (supplier.logo_url && supplier.logo_url.startsWith('http')) {
      const localPath = await downloadLogo(supplier.logo_url, supplier.id);
      if (localPath) {
        console.log(`  ✓ ${supplier.name}`);
        supplier.logo_url = localPath;
      }
    }
  }

  const sorted = sortSuppliers(suppliers);

  // Ensure output directory exists
  const dataDir = path.join(__dirname, '..', 'public', 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  // Write suppliers.json
  const suppliersPath = path.join(dataDir, 'suppliers.json');
  fs.writeFileSync(suppliersPath, JSON.stringify(sorted, null, 2), 'utf8');
  console.log(`✓ ${sorted.length} supplier(s) written to ${suppliersPath}`);

  // Write sync-meta.json
  const metaPath = path.join(dataDir, 'sync-meta.json');
  const meta = {
    last_synced:      new Date().toISOString(),
    total_suppliers:  sorted.length
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  console.log(`✓ Sync metadata written to ${metaPath}`);

  // Console summary by category
  const byCategory = {};
  for (const s of sorted) {
    const cat = s.category || '(uncategorised)';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }

  console.log('\n── Breakdown by category ──');
  for (const [cat, count] of Object.entries(byCategory).sort()) {
    console.log(`   ${cat}: ${count}`);
  }
  console.log(`   TOTAL: ${sorted.length}`);
}

main().catch(err => {
  console.error('\nSync failed:', err.message);
  process.exit(1);
});
