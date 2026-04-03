#!/usr/bin/env node
/**
 * scripts/sync-gallery.js
 *
 * Syncs photos from a public Google Drive folder into images/gallery/
 * and regenerates data/gallery.json.
 *
 * Required environment variables:
 *   GOOGLE_API_KEY    — Google Cloud API key with Drive API enabled
 *   GALLERY_FOLDER_ID — The folder ID from your Google Drive folder URL
 *
 * If either variable is missing the script exits cleanly without changing
 * anything, so local dev / CI without credentials still works fine.
 *
 * HOW TO UPDATE THE GALLERY:
 *   1. Open the Google Drive folder on your phone
 *   2. Upload photos directly from your camera roll
 *   3. The weekly GitHub Action will pick them up automatically
 *   4. Or trigger a manual run from the GitHub Actions tab
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const API_KEY   = process.env.GOOGLE_API_KEY;
const FOLDER_ID = process.env.GALLERY_FOLDER_ID;

const IMAGES_DIR  = path.join(__dirname, '..', 'images', 'gallery');
const GALLERY_JSON = path.join(__dirname, '..', 'data', 'gallery.json');

// ── Bail out gracefully if credentials are missing ───────────────────────────
if (!API_KEY || !FOLDER_ID) {
  console.log('GOOGLE_API_KEY or GALLERY_FOLDER_ID not set — skipping gallery sync.');
  process.exit(0);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const tmp = dest + '.tmp';
    const file = fs.createWriteStream(tmp);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(tmp, () => {});
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => fs.rename(tmp, dest, resolve)));
    }).on('error', (err) => {
      fs.unlink(tmp, () => {});
      reject(err);
    });
  });
}

/** Lowercase, replace spaces and unsafe chars with hyphens. */
function sanitiseName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/-{2,}/g, '-');
}

/** Turn a filename into readable alt text, e.g. "quorn-shoot-2024" → "Quorn Shoot 2024" */
function altFromName(filename) {
  return path
    .basename(filename, path.extname(filename))
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  // 1. List all image files in the Drive folder
  const q = encodeURIComponent(`'${FOLDER_ID}' in parents and trashed = false`);
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&key=${API_KEY}&fields=files(id,name,mimeType)&orderBy=name&pageSize=1000`;
  const listData = JSON.parse(await get(listUrl));

  if (listData.error) {
    console.error('Google Drive API error:', JSON.stringify(listData.error, null, 2));
    process.exit(1);
  }

  const driveFiles = (listData.files || []).filter(f => /^image\//.test(f.mimeType));
  console.log(`Found ${driveFiles.length} image(s) in Drive folder.`);

  // 2. Load existing gallery.json so we can preserve any custom alt text
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(GALLERY_JSON, 'utf8'));
  } catch {
    // No existing file or unreadable — start fresh
  }
  // Map src path → existing entry (to preserve hand-edited alt text)
  const existingMap = new Map(existing.map(e => [e.src, e]));

  // 3. Download new images; build updated Drive entry list
  const driveWebPaths = new Set();
  const driveItems = [];

  for (const file of driveFiles) {
    const safeName = sanitiseName(file.name);
    const localPath = path.join(IMAGES_DIR, safeName);
    const webPath   = `images/gallery/${safeName}`;
    driveWebPaths.add(webPath);

    if (!fs.existsSync(localPath)) {
      console.log(`  ↓ Downloading: ${file.name} → ${safeName}`);
      const dlUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${API_KEY}`;
      await downloadFile(dlUrl, localPath);
    } else {
      console.log(`  ✓ Already have: ${safeName}`);
    }

    // Keep custom alt text if the user has edited it previously
    driveItems.push(
      existingMap.get(webPath) || { src: webPath, alt: altFromName(file.name) }
    );
  }

  // 4. Keep any manually added entries (images NOT in images/gallery/)
  const manualItems = existing.filter(e => !e.src.startsWith('images/gallery/'));

  // 5. Remove stale local files that were deleted from Drive
  for (const f of fs.readdirSync(IMAGES_DIR)) {
    if (f === '.gitkeep') continue;
    const webPath = `images/gallery/${f}`;
    if (!driveWebPaths.has(webPath)) {
      console.log(`  ✗ Removing stale: ${f}`);
      fs.unlinkSync(path.join(IMAGES_DIR, f));
    }
  }

  // 6. Write gallery.json — manual entries first, then Drive-synced entries
  const allItems = [...manualItems, ...driveItems];
  // Must be valid JSON — no comments. The browser fetches this directly.
  fs.writeFileSync(GALLERY_JSON, JSON.stringify(allItems, null, 2) + '\n');
  console.log(`\ngallery.json updated — ${allItems.length} photo(s) total.`);
}

main().catch(err => {
  console.error('Gallery sync failed:', err.message);
  process.exit(1);
});
