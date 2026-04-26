/**
 * Shared CORS helper for Netlify functions.
 * Reads allowed origins from ALLOWED_ORIGINS env var (comma-separated).
 * Falls back to production + local dev origins.
 */

const DEFAULT_ORIGINS = [
  'https://axle-finance.com',
  'https://www.axle-finance.com',
  'https://admin.axle-finance.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8888',
];

function getAllowedOrigins() {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  }
  return DEFAULT_ORIGINS;
}

/**
 * Build CORS headers for the given request origin.
 * @param {string} origin - The request Origin header value
 * @param {object} [options] - Optional overrides
 * @param {string} [options.methods] - Allowed methods (default: 'POST, OPTIONS')
 * @param {string} [options.headers] - Allowed headers (default: 'Content-Type, Authorization')
 * @returns {object} Headers object with CORS fields
 */
function getCorsHeaders(origin, options = {}) {
  const allowedOrigins = getAllowedOrigins();
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': options.headers || 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': options.methods || 'POST, OPTIONS',
  };
}

/**
 * Handle OPTIONS preflight request.
 * @param {object} event - Netlify function event
 * @param {object} headers - CORS headers from getCorsHeaders()
 * @returns {object|null} Response object if OPTIONS, null otherwise
 */
function handlePreflight(event, headers) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  return null;
}

module.exports = { getCorsHeaders, handlePreflight };
