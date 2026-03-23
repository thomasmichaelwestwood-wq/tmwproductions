/**
 * TMW Productions — Jotform Supplier Directory Webhook
 * Netlify Function: /api/jotform-webhook
 *
 * Receives a Jotform webhook POST the moment a new supplier submission
 * arrives, then commits the updated suppliers.json to GitHub so that
 * Netlify re-deploys automatically — making the new supplier live within
 * ~60 seconds.
 *
 * WEBHOOK URL FORMAT (enter this in Jotform → Settings → Integrations → WebHooks):
 *   https://yourdomain.com/api/jotform-webhook?secret=YOUR_WEBHOOK_SECRET
 *
 * Required environment variables:
 *   JOTFORM_WEBHOOK_SECRET  — shared secret validated via ?secret= query param
 *   GITHUB_TOKEN            — PAT with Contents: Read & Write scope (classic)
 *                             or a fine-grained PAT with "Contents" write permission
 *   GITHUB_OWNER            — GitHub username or org name
 *   GITHUB_REPO             — Repository name
 *   GITHUB_BRANCH           — Branch to commit to (default: main)
 *
 * How it works:
 *   1. Validate the shared secret and formID.
 *   2. Parse the Jotform payload (URL-encoded POST body, rawRequest JSON).
 *   3. Fetch the current suppliers.json from GitHub.
 *   4. Check for duplicate submission IDs (idempotent).
 *   5. Append, re-sort, and commit the updated files back to GitHub.
 *   6. Netlify's GitHub integration picks up the commit and deploys.
 *
 * If GITHUB_TOKEN is not configured, the function logs the submission and
 * returns 200 — the daily GitHub Actions sync will pick it up within 24 hours.
 *
 * PRIVATE FIELDS: q8 (contact name) and q9 (contact email) are never
 * written to any file or log.
 */

'use strict';

const FORM_ID = '260812287727059';

// ─── Helpers (mirrors sync-from-jotform.js logic) ────────────────────────────

function extractAnswer(answers, qNum) {
  const entry = answers[String(qNum)];
  if (!entry) return '';
  const val = entry.answer;
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (Array.isArray(val)) return val.filter(Boolean).join(', ').trim();
  if (typeof val === 'object') {
    if (typeof val.url === 'string') return val.url.trim();
    if (val.first !== undefined || val.last !== undefined) {
      return [val.first, val.middle, val.last].filter(Boolean).join(' ').trim();
    }
    return Object.values(val).filter(Boolean).join(' ').trim();
  }
  return String(val).trim();
}

/**
 * Parse rawRequest from Jotform's webhook payload.
 *
 * Jotform sends submissions as URL-encoded form data. The `rawRequest`
 * field contains a JSON string of answers. Two key formats exist:
 *
 *   Format A (question numbers as keys):
 *     { "2": { "name": "q2", "answer": "KDS Calligraphy" }, "3": { ... } }
 *
 *   Format B (qN_fieldName as keys, flat string values):
 *     { "q2_supplierName": "KDS Calligraphy", "q3_category": "Other" }
 *
 * We support both here.
 */
function parseRawRequest(rawRequest) {
  let parsed;
  try {
    parsed = JSON.parse(rawRequest);
  } catch {
    return null;
  }

  // Detect Format A vs Format B
  if (parsed['2'] !== undefined || parsed['3'] !== undefined) {
    // Format A — answers keyed by question number
    return parsed;
  }

  // Format B — flat qN_fieldName keys; convert to Format A shape
  const converted = {};
  for (const [key, value] of Object.entries(parsed)) {
    const match = key.match(/^q(\d+)_/);
    if (match) {
      const num = match[1];
      converted[num] = { answer: typeof value === 'string' ? value.trim() : value };
    }
  }
  return Object.keys(converted).length > 0 ? converted : parsed;
}

function normalizeUrl(url) {
  if (!url) return null;
  url = url.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}

function trimDescription(text, maxLen = 400) {
  if (!text) return '';
  text = text.trim();
  if (text.length <= maxLen) return text;
  const sub = text.slice(0, maxLen);
  for (let i = sub.length - 1; i > maxLen / 2; i--) {
    if ('.!?'.includes(sub[i])) {
      const next = sub[i + 1];
      if (next === undefined || next === ' ' || next === '\n') {
        return text.slice(0, i + 1).trim();
      }
    }
  }
  const lastSpace = sub.lastIndexOf(' ');
  return text.slice(0, lastSpace > 0 ? lastSpace : maxLen).trim() + '…';
}

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
 * Parse an application/x-www-form-urlencoded body string into a plain object.
 */
function parseFormEncoded(body) {
  if (!body) return {};
  return Object.fromEntries(
    body.split('&').map(pair => {
      const [k, v = ''] = pair.split('=');
      return [decodeURIComponent(k.replace(/\+/g, ' ')), decodeURIComponent(v.replace(/\+/g, ' '))];
    })
  );
}

// ─── GitHub API helpers ───────────────────────────────────────────────────────

/**
 * Fetch a file from GitHub and return its content (parsed JSON) and current SHA.
 */
async function githubGetFile(token, owner, repo, filePath, branch) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept:        'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (res.status === 404) return { content: null, sha: null };
  if (!res.ok) throw new Error(`GitHub GET ${filePath}: ${res.status}`);
  const data = await res.json();
  const raw  = Buffer.from(data.content, 'base64').toString('utf8');
  return { content: JSON.parse(raw), sha: data.sha };
}

/**
 * Commit a file to GitHub (create or update).
 */
async function githubPutFile(token, owner, repo, filePath, branch, message, content, sha) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const body = {
    message,
    content: Buffer.from(JSON.stringify(content, null, 2), 'utf8').toString('base64'),
    branch
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method:  'PUT',
    headers: {
      Authorization:  `Bearer ${token}`,
      Accept:         'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`GitHub PUT ${filePath}: ${res.status} — ${err}`);
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

exports.handler = async function (event) {
  // Accept POST only
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // ── 1. Validate shared secret ────────────────────────────────────────────
  const expectedSecret = process.env.JOTFORM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const params      = event.queryStringParameters || {};
    const givenSecret = params.secret || '';
    if (givenSecret !== expectedSecret) {
      console.log(JSON.stringify({ event: 'webhook_auth_failure', reason: 'invalid_secret' }));
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
  }

  // ── 2. Parse the URL-encoded body ────────────────────────────────────────
  const body = parseFormEncoded(event.body || '');

  // ── 3. Validate formID ───────────────────────────────────────────────────
  if (body.formID && body.formID !== FORM_ID) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Form ID mismatch', received: body.formID })
    };
  }

  // ── 4. Parse rawRequest ──────────────────────────────────────────────────
  const rawAnswers = parseRawRequest(body.rawRequest || '{}');
  if (!rawAnswers) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Could not parse rawRequest' }) };
  }

  const submissionId = body.submissionID || `webhook_${Date.now()}`;

  // Extract fields — q8 and q9 intentionally omitted
  const name        = extractAnswer(rawAnswers, 2);
  const category    = extractAnswer(rawAnswers, 3);
  const subcategory = extractAnswer(rawAnswers, 4);
  const description = extractAnswer(rawAnswers, 5);
  const website     = extractAnswer(rawAnswers, 6);
  const area        = extractAnswer(rawAnswers, 7);
  const logoRaw     = extractAnswer(rawAnswers, 10);

  if (!name) {
    console.log(JSON.stringify({ event: 'webhook_skipped', reason: 'no_name', submissionId }));
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'no_name' }) };
  }

  console.log(JSON.stringify({ event: 'webhook_received', name, submissionId }));

  const newSupplier = {
    id:          submissionId,
    name,
    category:    category    || null,
    subcategory: subcategory || null,
    description: trimDescription(description) || null,
    website:     normalizeUrl(website),
    area:        area        || null,
    logo_url:    logoRaw     || null,
    added_at:    new Date().toISOString()
  };

  // ── 5. Commit via GitHub API (if configured) ─────────────────────────────
  const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
  const GITHUB_OWNER  = process.env.GITHUB_OWNER;
  const GITHUB_REPO   = process.env.GITHUB_REPO;
  const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    // No GitHub config — log and return. The daily sync will pick it up.
    console.log(JSON.stringify({
      event:   'webhook_no_github_config',
      message: 'Submission logged. Set GITHUB_TOKEN/OWNER/REPO for real-time updates.',
      name
    }));
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, note: 'Submission received; daily sync will publish it.' })
    };
  }

  try {
    // Fetch current suppliers.json from GitHub
    const SUPPLIERS_PATH  = 'public/data/suppliers.json';
    const META_PATH       = 'public/data/sync-meta.json';

    const { content: currentSuppliers, sha: suppliersSha } =
      await githubGetFile(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, SUPPLIERS_PATH, GITHUB_BRANCH);

    const suppliers = Array.isArray(currentSuppliers) ? currentSuppliers : [];

    // Idempotency check — skip if submission already exists
    if (suppliers.some(s => s.id === submissionId)) {
      console.log(JSON.stringify({ event: 'webhook_duplicate', submissionId }));
      return { statusCode: 200, body: JSON.stringify({ ok: true, duplicate: true }) };
    }

    // Append, sort, and commit
    const updated = sortSuppliers([...suppliers, newSupplier]);

    await githubPutFile(
      GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO,
      SUPPLIERS_PATH, GITHUB_BRANCH,
      `chore: add supplier "${name}" via webhook [skip ci]`,
      updated,
      suppliersSha
    );

    // Update sync-meta.json
    const { sha: metaSha } = await githubGetFile(
      GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, META_PATH, GITHUB_BRANCH
    );
    const meta = {
      last_synced:     new Date().toISOString(),
      total_suppliers: updated.length
    };
    await githubPutFile(
      GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO,
      META_PATH, GITHUB_BRANCH,
      `chore: update sync-meta for "${name}" [skip ci]`,
      meta,
      metaSha
    );

    console.log(JSON.stringify({
      event: 'webhook_success',
      name,
      submissionId,
      totalSuppliers: updated.length
    }));

    return { statusCode: 200, body: JSON.stringify({ ok: true, name, id: submissionId }) };

  } catch (err) {
    console.error(JSON.stringify({
      event:   'webhook_error',
      message: err.message,
      name
    }));
    // Return 200 so Jotform doesn't keep retrying — the daily sync is the backup
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
