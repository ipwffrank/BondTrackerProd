/**
 * Minimal HTML escaper for email templates. Netlify functions interpolate
 * user-supplied fields (names, messages, URLs) into HTML emails; without
 * escaping, authenticated users can inject arbitrary markup or links into
 * messages other people read.
 */
function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Allow only http(s) URLs in href attributes. Returns a safe default on
 * anything else (javascript:, data:, file:, relative tricks). Used when an
 * external caller influences a link destination.
 */
function safeHttpUrl(value, fallback) {
  if (!value) return fallback;
  try {
    const u = new URL(String(value));
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch (_) { /* fallthrough */ }
  return fallback;
}

module.exports = { escapeHtml, safeHttpUrl };
