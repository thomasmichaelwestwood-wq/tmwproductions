'use strict';

/**
 * TMW Productions — Google Reviews
 * GET /api/google-reviews
 *
 * Fetches genuine reviews for the business from the Google Places API and
 * returns a trimmed, front-end-friendly JSON payload. The response is cached
 * at Netlify's CDN for 6 hours so we don't hit the Google API (or its billing)
 * on every page view.
 *
 * Requires env vars (set in Netlify → Site settings → Environment variables):
 *   GOOGLE_PLACES_API_KEY   your Google Cloud "Places API" key
 *   GOOGLE_PLACE_ID         your business's Place ID
 *
 * Notes / limitations:
 *   - The Google Places Details endpoint returns a maximum of 5 reviews.
 *     For a homepage that's plenty — we surface the best of them.
 *   - `min_rating` (default 4) filters out anything below that star rating.
 */

const https = require('https');

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  // Cache at the CDN for 6h, serve stale for a day while revalidating.
  'Cache-Control': 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400'
};

function respond(statusCode, data) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(data) };
}

// ── Fetch a URL and parse JSON ───────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Bad JSON from Google Places API')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Google Places request timed out')); });
  });
}

exports.handler = async function (event) {
  const params    = event.queryStringParameters || {};
  const apiKey    = process.env.GOOGLE_PLACES_API_KEY;
  const placeId   = process.env.GOOGLE_PLACE_ID;
  const minRating = parseInt(params.min_rating, 10) || 4;
  // 'most_relevant' (default) usually surfaces the strongest reviews;
  // pass ?sort=newest to get the most recent instead.
  const sort      = params.sort === 'newest' ? 'newest' : 'most_relevant';

  // Graceful, non-breaking response until the env vars are configured.
  if (!apiKey || !placeId) {
    return respond(200, {
      configured: false,
      reviews: [],
      message: 'Set GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID in Netlify to enable live Google reviews.'
    });
  }

  try {
    const url =
      'https://maps.googleapis.com/maps/api/place/details/json' +
      `?place_id=${encodeURIComponent(placeId)}` +
      '&fields=name,rating,user_ratings_total,reviews' +
      `&reviews_sort=${sort}` +
      '&reviews_no_translations=true' +
      '&language=en' +
      `&key=${encodeURIComponent(apiKey)}`;

    const json = await fetchJson(url);

    if (json.status !== 'OK') {
      return respond(502, {
        configured: true,
        error: json.status,
        message: json.error_message || 'Google Places API returned an error.',
        reviews: []
      });
    }

    const result  = json.result || {};
    const reviews = (result.reviews || [])
      .filter((r) => (r.rating || 0) >= minRating && r.text && r.text.trim())
      .map((r) => ({
        author: r.author_name,
        rating: r.rating,
        text: r.text.trim(),
        when: r.relative_time_description,
        time: r.time,
        photo: r.profile_photo_url || null,
        url: r.author_url || null
      }))
      .sort((a, b) => (b.rating - a.rating) || (b.time - a.time));

    return respond(200, {
      configured: true,
      name: result.name || 'TMW Productions',
      rating: result.rating || null,
      total: result.user_ratings_total || null,
      count: reviews.length,
      reviews
    });
  } catch (err) {
    return respond(500, { configured: true, error: 'fetch_failed', message: err.message, reviews: [] });
  }
};
