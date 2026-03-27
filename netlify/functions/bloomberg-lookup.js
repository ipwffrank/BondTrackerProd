// netlify/functions/bloomberg-lookup.js
//
// Bond lookup via OpenFIGI API (https://www.openfigi.com/api)
// - Given ISIN  → returns ticker and bond details (idType: ID_ISIN)
// - Given ticker → returns ISIN and bond details  (idType: TICKER, filtered to Corp bonds)
//
// Optional env var: OPENFIGI_API_KEY  (raises rate limit from 25 → 250 req/min)

async function lookupViaOpenFIGI(identifier, identifierType) {
  const API_KEY = process.env.OPENFIGI_API_KEY;

  const query = { idType: identifierType, idValue: identifier };

  // Filter ticker lookups to corporate bonds only
  if (identifierType === 'TICKER') {
    query.marketSecDes = 'Corp';
  }

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

  return {
    isin: identifierType === 'ID_ISIN' ? identifier : null,
    ticker: bondData.ticker || null,
    bondName: bondData.name || null,
    issuer: bondData.name || null,
    type: bondData.securityType2 || bondData.securityType || null,
    currency: bondData.currency || null,
    country: bondData.exchCode || null,
    coupon: bondData.coupon || null,
    maturity: bondData.maturity || null,
    marketSector: bondData.marketSector || null,
    figi: bondData.figi || null
  };
}

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { isin, ticker } = await req.json();

    if (!isin && !ticker) {
      return new Response(JSON.stringify({ error: 'Either ISIN or ticker must be provided' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    let bondData = null;

    if (isin) {
      bondData = await lookupViaOpenFIGI(isin.toUpperCase().trim(), 'ID_ISIN');
    } else if (ticker) {
      bondData = await lookupViaOpenFIGI(ticker.toUpperCase().trim(), 'TICKER');
    }

    if (!bondData) {
      return new Response(JSON.stringify({
        error: 'Bond not found',
        message: 'No results returned from OpenFIGI for the provided identifier.'
      }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, data: bondData }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Bond lookup error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', message: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};

/*
 * MOCK FALLBACK (disabled)
 *
 * const MOCK_BONDS_DB = {
 *   'US88579YAA56': { isin: 'US88579YAA56', ticker: 'TSLA', bondName: 'TESLA INC 5.3% 08/15/2025', ... },
 *   'US912828YK25': { isin: 'US912828YK25', ticker: 'T',    bondName: 'US TREASURY 2.5% 02/15/2026', ... },
 * };
 */
