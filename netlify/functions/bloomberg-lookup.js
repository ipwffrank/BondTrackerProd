// netlify/functions/bloomberg-lookup.js
//
// Bond lookup via OpenFIGI API (https://www.openfigi.com/api)
// - Given ISIN  → returns ticker and bond details (idType: ID_ISIN)
// - Given ticker → returns ISIN and bond details  (idType: TICKER, filtered to Corp bonds)
//
// Optional env var: OPENFIGI_API_KEY  (raises rate limit from 25 → 250 req/min)

const { getCorsHeaders, handlePreflight } = require('./utils/cors');
const { verifyIdToken } = require('./utils/auth');
const { enforceRateLimit } = require('./utils/rate-limit');

async function lookupViaOpenFIGI(identifier, identifierType) {
  const API_KEY = process.env.OPENFIGI_API_KEY;

  const query = { idType: identifierType, idValue: identifier };

  // No marketSecDes filter: bond desks trade across sectors (Corp, Govt,
  // Muni, Supra). An earlier version filtered ticker lookups to "Corp"
  // which silently dropped sovereigns like ROMANI 6.5 10/07/45 REGS.

  const response = await fetch('https://api.openfigi.com/v3/mapping', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY && { 'X-OPENFIGI-APIKEY': API_KEY })
    },
    body: JSON.stringify([query])
  });

  if (!response.ok) {
    throw new Error(`OpenFIGI API error: ${response.status} ${response.statusText}`);
  }

  const results = await response.json();
  const data = results[0]?.data;

  if (!data || data.length === 0) return null;

  const bondData = data[0];

  // Pass through both securityType and securityType2 — the client uses
  // securityType ("EURO NON-DOLLAR" / "EURO-DOLLAR" / etc.) to infer
  // currency on XS-prefixed bonds, where OpenFIGI's free tier leaves
  // bondData.currency null.
  return {
    isin: identifierType === 'ID_ISIN' ? identifier : null,
    ticker: bondData.ticker || null,
    bondName: bondData.name || null,
    issuer: bondData.name || null,
    type: bondData.securityType2 || bondData.securityType || null,
    securityType: bondData.securityType || null,
    securityType2: bondData.securityType2 || null,
    securityDescription: bondData.securityDescription || null,
    currency: bondData.currency || null,
    country: bondData.exchCode || null,
    coupon: bondData.coupon || null,
    maturity: bondData.maturity || null,
    marketSector: bondData.marketSector || null,
    figi: bondData.figi || null
  };
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || '';
  const headers = getCorsHeaders(origin);

  const preflight = handlePreflight(event, headers);
  if (preflight) return preflight;

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Require an authenticated caller — this endpoint was previously open and
  // could be used to exhaust the shared OpenFIGI quota from anywhere.
  try {
    await verifyIdToken(event);
  } catch (authErr) {
    return {
      statusCode: authErr.statusCode || 401,
      headers,
      body: JSON.stringify({ error: authErr.message }),
    };
  }

  const rateLimited = enforceRateLimit(event, headers, { windowMs: 60000, maxRequests: 30 });
  if (rateLimited) return rateLimited;

  try {
    const { isin, ticker } = JSON.parse(event.body || '{}');

    if (!isin && !ticker) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Either ISIN or ticker must be provided' }),
      };
    }

    // Sanity-check identifiers: ISIN is 12 chars (alnum); ticker is short
    const rawId = (isin || ticker || '').toString().trim();
    if (rawId.length > 32 || !/^[A-Za-z0-9 .\-]+$/.test(rawId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid identifier' }) };
    }

    let bondData = null;
    if (isin) {
      bondData = await lookupViaOpenFIGI(isin.toUpperCase().trim(), 'ID_ISIN');
    } else {
      bondData = await lookupViaOpenFIGI(ticker.toUpperCase().trim(), 'TICKER');
    }

    if (!bondData) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'Bond not found',
          message: 'No results returned from OpenFIGI for the provided identifier.',
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: bondData }),
    };
  } catch (error) {
    console.error('Bond lookup error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message }),
    };
  }
};
