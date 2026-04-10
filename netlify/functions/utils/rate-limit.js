/**
 * Simple in-memory rate limiter for Netlify functions.
 *
 * Note: In-memory stores reset on cold starts and are per-instance,
 * so this provides best-effort protection rather than strict enforcement.
 * For stricter limits, use a Firestore-based counter.
 *
 * @param {number} windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @param {number} maxRequests - Max requests per IP per window (default: 10)
 */

const requestCounts = new Map();

// Clean up old entries periodically to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastCleanup = Date.now();

function cleanup(windowMs) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of requestCounts) {
    if (now - entry.windowStart > windowMs * 2) {
      requestCounts.delete(key);
    }
  }
}

/**
 * Check if the request is rate limited.
 * @param {object} event - Netlify function event
 * @param {object} [options]
 * @param {number} [options.windowMs=60000] - Time window in ms
 * @param {number} [options.maxRequests=10] - Max requests per window
 * @returns {{ limited: boolean, remaining: number }} Rate limit result
 */
function checkRateLimit(event, options = {}) {
  const windowMs = options.windowMs || 60000;
  const maxRequests = options.maxRequests || 10;

  // Extract client IP from Netlify headers
  const ip = event.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || event.headers?.['client-ip']
    || event.headers?.['x-nf-client-connection-ip']
    || 'unknown';

  const now = Date.now();
  cleanup(windowMs);

  const entry = requestCounts.get(ip);

  if (!entry || now - entry.windowStart > windowMs) {
    // New window
    requestCounts.set(ip, { windowStart: now, count: 1 });
    return { limited: false, remaining: maxRequests - 1 };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { limited: true, remaining: 0 };
  }

  return { limited: false, remaining: maxRequests - entry.count };
}

/**
 * Return a 429 Too Many Requests response if rate limited.
 * @param {object} event - Netlify function event
 * @param {object} headers - CORS headers
 * @param {object} [options] - Rate limit options
 * @returns {object|null} Response object if rate limited, null otherwise
 */
function enforceRateLimit(event, headers, options = {}) {
  const { limited } = checkRateLimit(event, options);
  if (limited) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    };
  }
  return null;
}

module.exports = { checkRateLimit, enforceRateLimit };
