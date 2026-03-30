exports.handler = async (event) => {
  console.log('=== Function Started ===');

  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://axle-finance.com,https://www.axle-finance.com,http://localhost:5173,http://localhost:8888').split(',');
  const origin = event.headers?.origin || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    console.log('OPTIONS request');
    return { statusCode: 200, headers, body: '' };
  }

  // Verify Firebase ID token
  const authHeader = event.headers?.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Missing authentication token' }) };
  }

  try {
    console.log('Environment check:');
    console.log('- OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);

    const body = JSON.parse(event.body || '{}');
    const { transcript, imageBase64, fileType, corrections } = body;
    const isImage = !!imageBase64;

    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'OPENAI_API_KEY not set in Netlify',
          success: false
        })
      };
    }

    if (!transcript && !imageBase64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Transcript text or image required' })
      };
    }

    const https = require('https');

    const prompt = `Analyze bond trading chat from the DEALER's perspective (the person quoting prices).

DIRECTION RULES (from dealer's perspective — this is critical):
1. Client wants to SELL a bond (e.g., "has X to sell", "looking for a bid", "wants a bid on X") → direction = BUY (the dealer is buying from the client)
2. Client wants to BUY a bond (e.g., "wants to buy", "looking for an offer", "yours?") → direction = SELL (the dealer is selling to the client)
3. If client asks for both bid and offer → direction = TWO-WAY
4. IMPORTANT: If the inquiry starts as TWO-WAY but the client executes on ONE side (e.g. "done at 100.12, we buy 10mm"), the final direction should reflect the executed side, NOT TWO-WAY. Only keep TWO-WAY if both sides remain open or the status is ENQUIRY/QUOTED.
5. "Looking for runs" or "asking for a run" means the client wants to see a price — determine direction from context (are they a buyer or seller?). If they later say "has X to sell", direction = BUY.

STATUS RULES — read the FULL conversation for each bond carefully:
1. "done", "yours", "mine", "executed", "filled", "traded", "confirmed", "coed" → EXECUTED
2. "traded away", "done away", "lost to", "competitor got it" → TRADED AWAY
3. "pass", "passed", "no thanks", "not interested", "too tight", "too wide", "not for us" → PASSED
4. "holding", "they're waiting", "might switch", "no response", client defers or does not confirm → QUOTED (NOT executed)
5. Enquiry only, no price given → ENQUIRY
CRITICAL: Do NOT mark as EXECUTED unless there is explicit confirmation that a trade was done (e.g., "Done", "Coed", "Confirmed"). If the client says they are "waiting", "holding", or does not respond with confirmation, the status is QUOTED even if a price was offered.

MULTIPLE INTERACTIONS WITH SAME BOND:
- If the same client comes back for the same bond at a different time or price, treat each interaction as a SEPARATE activity record.
- Example: Client buys 500k at 101.45 (EXECUTED), then comes back for another 1m but decides to wait → TWO separate records: one EXECUTED at 101.45 for 0.5MM, one QUOTED at 101.60 for 1MM.

SWITCH TRADES:
- A "switch" means the client sells one bond and buys another simultaneously.
- Create TWO separate activity records for each switch:
  - Leg 1: the bond being SOLD by the client (direction = BUY from dealer perspective) with status EXECUTED and the agreed price
  - Leg 2: the bond being BOUGHT by the client (direction = SELL from dealer perspective) with status EXECUTED and the agreed price
- Add "Switch trade" in the notes for both legs.

CONSOLIDATION RULES:
- If a client inquires about a bond and later executes on the same bond in the same conversation, produce ONE record with the final executed status and price. Do NOT create separate inquiry + execution records for the same bond from the same client.
- Only create multiple records for the same bond if there are genuinely separate interactions at different times/prices.

PRICE RULES:
- The dealer's response with a number IS the price, even if it looks like shorthand.
- "100/" means bid price 100, "@ 101" means offer price 101, "/99" means offer price 99, "99/101" means bid 99 / offer 101.
- For BUY or SELL direction: return "price" as a plain number. Never return null if the dealer quoted a number.
- For TWO-WAY direction: return "bidPrice" and "offerPrice" as separate numbers.

SIZE: Always in millions (MM). "15MM" → 15, "500k" → 0.5, "1bn" → 1000. If no size mentioned, return null.

CLIENT: Extract the CLIENT company from "(From Company)" or context. The dealer's own firm is NOT the client.

Return JSON array only (no markdown):
[{"clientName":"Company","contactPerson":"Name","ticker":"Bond","isin":"","size":null,"direction":"BUY/SELL/TWO-WAY","price":null,"bidPrice":null,"offerPrice":null,"currency":"USD","status":"ENQUIRY/QUOTED/EXECUTED/PASSED/TRADED AWAY","notes":"brief outcome summary"}]`;

    // Build few-shot correction examples from user feedback
    let correctionSection = '';
    if (Array.isArray(corrections) && corrections.length > 0) {
      const examples = corrections.map((c, i) => {
        const origFields = Object.entries(c.original || {}).map(([k, v]) => `${k}: "${v ?? ''}"`).join(', ');
        const fixedFields = Object.entries(c.corrected || {}).map(([k, v]) => `${k}: "${v ?? ''}"`).join(', ');
        return `  ${i + 1}. AI output: {${origFields}} → Corrected: {${fixedFields}}`;
      }).join('\n');
      correctionSection = `\n\nIMPORTANT — LEARN FROM PAST CORRECTIONS:\nUsers have previously corrected these AI outputs. Apply these patterns:\n${examples}\n`;
    }

    // Build messages based on input type
    let messages;
    let model;

    if (isImage) {
      // Vision path: use GPT-4o-mini for image analysis
      model = 'gpt-4o-mini';

      const imagePrompt = `You are looking at a screenshot of a bond trading chat conversation (e.g., Bloomberg IB, WhatsApp, or similar messaging platform).

Read the conversation EXACTLY as displayed in the image. Identify:
- The CLIENT company name from the chat header, window title, "(From Company)" notation, or contact name context
- The DEALER (the person quoting prices) — their firm is NOT the client
- If multiple separate conversations are visible, extract each as a separate activity

${prompt}`;

      messages = [
        { role: 'system', content: 'You are a bond trading analyst with expertise in reading chat screenshots. Return only valid JSON.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: imagePrompt + correctionSection },
            { type: 'image_url', image_url: { url: imageBase64 } }
          ]
        }
      ];
    } else {
      // Text path: use GPT-3.5-turbo (unchanged)
      model = 'gpt-3.5-turbo';
      messages = [
        { role: 'system', content: 'You are a bond trading analyst. Return only valid JSON.' },
        { role: 'user', content: `${prompt}${correctionSection}\n\nTranscript: ${transcript}` }
      ];
    }

    const requestData = JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 2000
    });

    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Length': Buffer.byteLength(requestData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, data }));
      });

      req.on('error', reject);
      req.write(requestData);
      req.end();
    });

    if (response.statusCode !== 200) {
      throw new Error(`OpenAI error: ${response.data}`);
    }

    const aiResponse = JSON.parse(response.data);
    const usage = aiResponse.usage || {};
    let text = aiResponse.choices[0].message.content.trim();
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let activities = JSON.parse(text);
    if (!Array.isArray(activities)) activities = [activities];

    const validActivities = activities.filter(a =>
      a.clientName && (a.ticker || a.isin) && a.direction && a.status
    ).map(a => {
      const parsedSize = a.size != null ? parseFloat(a.size) : null;
      const parsedPrice = a.price != null ? parseFloat(String(a.price).replace(/[^0-9.\-]/g, '')) : null;
      const parsedBid = a.bidPrice != null ? parseFloat(String(a.bidPrice).replace(/[^0-9.\-]/g, '')) : null;
      const parsedOffer = a.offerPrice != null ? parseFloat(String(a.offerPrice).replace(/[^0-9.\-]/g, '')) : null;
      return {
        clientName: a.clientName,
        contactPerson: a.contactPerson || '',
        activityType: isImage ? 'Chat Screenshot' : 'Bloomberg Chat',
        isin: a.isin || '',
        ticker: a.ticker || '',
        size: (parsedSize && !isNaN(parsedSize)) ? parsedSize : null,
        currency: 'USD',
        price: a.direction === 'TWO-WAY' ? null : ((parsedPrice && !isNaN(parsedPrice)) ? parsedPrice : null),
        bidPrice: a.direction === 'TWO-WAY' && parsedBid && !isNaN(parsedBid) ? parsedBid : null,
        offerPrice: a.direction === 'TWO-WAY' && parsedOffer && !isNaN(parsedOffer) ? parsedOffer : null,
        direction: a.direction,
        status: a.status,
        notes: a.notes || ''
      };
    });

    console.log(`✅ Extracted ${validActivities.length} activities (${isImage ? 'image' : 'text'} input, model: ${model})`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        activities: validActivities,
        count: validActivities.length,
        usage: {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0
        }
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        success: false
      })
    };
  }
};
