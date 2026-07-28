'use strict';

/**
 * TMW Productions — Google Reviews  (Places API — NEW)
 * GET /api/google-reviews
 *
 * Fetches genuine reviews for the business from the Google Places API (New)
 * and returns a trimmed, front-end-friendly JSON payload. Cached at Netlify's
 * CDN for 6 hours so we don't hit the Google API (or its billing) per view.
 *
 * Requires env vars (Netlify → Site settings → Environment variables):
 *   GOOGLE_PLACES_API_KEY   Google Cloud API key with "Places API (New)" enabled  (required)
 *   GOOGLE_PLACE_ID         business Place ID (ChIJ…)                              (optional)
 *   GOOGLE_PLACE_QUERY      business name to look up                              (optional)
 *
 * You only need the API key. If GOOGLE_PLACE_ID isn't set, the function resolves
 * it automatically from GOOGLE_PLACE_QUERY (default "TMW Productions Leicester")
 * via Text Search (New).
 *
 * Notes / limitations:
 *   - Places API (New) returns a maximum of 5 reviews. For a homepage that's plenty.
 *   - `min_rating` (default 4) filters out anything below that star rating.
 *   - Enable "Places API (New)" in Google Cloud — NOT the legacy "Places API".
 */

const https = require('https');

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400'
};

function respond(statusCode, data) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(data) };
}

// ── Generic JSON request (GET or POST) ───────────────────────────────────────
function request(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {})
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: data ? JSON.parse(data) : {} }); }
        catch (e) { reject(new Error('Bad JSON from Google Places API (New)')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Google Places request timed out')); });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// ── Resolve a Place ID from a business name via Text Search (New) ─────────────
async function resolvePlaceId(query, apiKey) {
  const { json } = await request(
    'POST',
    'https://places.googleapis.com/v1/places:searchText',
    { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'places.id' },
    { textQuery: query }
  );
  if (json.places && json.places.length) return json.places[0].id;
  return null;
}

exports.handler = async function (event) {
  const params    = event.queryStringParameters || {};
  const apiKey    = process.env.GOOGLE_PLACES_API_KEY;
  const query     = process.env.GOOGLE_PLACE_QUERY || 'TMW Productions Leicester';
  // TMW's Google listing is a service-area business (address hidden), so name
  // search can't resolve it — default to the known Place ID. It's a public,
  // non-sensitive identifier and exposes no address. Override via env if needed.
  let   placeId   = process.env.GOOGLE_PLACE_ID || 'ChIJO57iTpq5lQoRPV0ZdScesmY';
  const minRating = parseInt(params.min_rating, 10) || 4;

  if (!apiKey) {
    return respond(200, {
      configured: false,
      reviews: [],
      message: 'Set GOOGLE_PLACES_API_KEY in Netlify (with "Places API (New)" enabled) to show live Google reviews.'
    });
  }

  try {
    // Auto-resolve the Place ID from the business name if not provided.
    if (!placeId) {
      placeId = await resolvePlaceId(query, apiKey);
      if (!placeId) {
        return respond(200, {
          configured: true,
          reviews: [],
          resolvedFrom: query,
          message: 'Could not resolve a Place ID. Check the business name, or set GOOGLE_PLACE_ID explicitly.'
        });
      }
    }

    // Place Details (New) — request only the fields we need.
    const fieldMask = 'id,displayName,rating,userRatingCount,googleMapsUri,reviews';
    const { status, json } = await request(
      'GET',
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`,
      { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': fieldMask }
    );

    if (status !== 200 || json.error) {
      return respond(502, {
        configured: true,
        error: (json.error && json.error.status) || 'API_ERROR',
        message: (json.error && json.error.message) || 'Google Places API (New) returned an error.',
        reviews: []
      });
    }

    const reviews = (json.reviews || [])
      .map((r) => ({
        author: (r.authorAttribution && r.authorAttribution.displayName) || 'Google reviewer',
        rating: r.rating,
        text: (r.text && r.text.text) || (r.originalText && r.originalText.text) || '',
        when: r.relativePublishTimeDescription || '',
        time: r.publishTime ? Date.parse(r.publishTime) : 0,
        photo: (r.authorAttribution && r.authorAttribution.photoUri) || null,
        url: (r.authorAttribution && r.authorAttribution.uri) || null
      }))
      .filter((r) => (r.rating || 0) >= minRating && r.text.trim())
      .sort((a, b) => (b.rating - a.rating) || (b.time - a.time));

    return respond(200, {
      configured: true,
      placeId: placeId,
      name: (json.displayName && json.displayName.text) || 'TMW Productions',
      rating: json.rating || null,
      total: json.userRatingCount || null,
      mapsUri: json.googleMapsUri || null,
      count: reviews.length,
      reviews
    });
  } catch (err) {
    return respond(500, { configured: true, error: 'fetch_failed', message: err.message, reviews: [] });
  }
};
