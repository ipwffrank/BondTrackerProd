const { getCorsHeaders, handlePreflight } = require('./utils/cors');

exports.handler = async (event) => {
  const origin = event.headers?.origin || '';
  const headers = getCorsHeaders(origin);

  const preflight = handlePreflight(event, headers);
  if (preflight) return preflight;

  // Verify Firebase ID token
  const authHeader = event.headers?.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Missing authentication token' }) };
  }

  try {
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

    const prompt = `Analyze bond trading chat and extract the CLIENT's trading activity.

DIRECTION RULES (from the CLIENT's perspective — this is THE most critical part):

The "direction" field represents what the CLIENT is doing: BUY means the client is buying, SELL means the client is selling.

CLIENT INTENT SIGNALS — read these carefully:
• Client wants to BUY a bond → direction = BUY
  - "asking for [bond]", "wants [size] of [bond]", "wants to buy", "looking for an offer", "looking for paper", "interested in buying", "wants another [size]"
  - "asking for" a bond ALWAYS means the client wants to BUY it
  - The dealer responds with an OFFER price (the price the client pays to buy)

• Client wants to SELL a bond → direction = SELL
  - "looking for a bid", "wants a bid on X", "has X to sell", "looking to sell", "looking for runs" (on bonds they hold), "offering X"
  - The dealer responds with a BID price (the price the client receives when selling)

• If client asks for both bid and offer → direction = TWO-WAY
• IMPORTANT: If the inquiry starts as TWO-WAY but the client executes on ONE side, the final direction should reflect the executed side, NOT TWO-WAY. Only keep TWO-WAY if both sides remain open or the status is ENQUIRY/QUOTED.

WORKED EXAMPLES for direction:
  - "Nordic Life is looking for runs on HSBC 32s" + later "they'll do 25m at 102.10" (client selling) → direction = SELL, price = 102.10
  - "Apex Wealth is asking for 500k of LLOYDS 29s" (client wants to buy) → direction = BUY
  - "Global Alpha wants a bid on STANLN 6.5 27" → client wants to sell → direction = SELL. Dealer quotes 99.88, client says "holding" → status = QUOTED (not EXECUTED), price = 99.88
  - "Apex Wealth wants another 1m LLOYDS" (same bond as before, client wants to buy more) → direction = BUY

SWITCH TRADES — pay close attention to which bond is sold and which is bought:
- A "switch" means the client sells one bond and buys another simultaneously.
- Read carefully: "they want to sell 20m BARUK 28s and buy the STANLN 29s" means:
  - Client is SELLING BARUK 28s → direction = SELL for BARUK 28s
  - Client is BUYING STANLN 29s → direction = BUY for STANLN 29s
- Create TWO separate activity records:
  - Leg 1: the bond the client is SELLING → direction = SELL, with the price the dealer bid for it
  - Leg 2: the bond the client is BUYING → direction = BUY, with the price the dealer offered it at
- Match each bond to the correct price: if dealer says "bid BARUKs at 98.20 and offer STANLNs at 100.45", then BARUK price=98.20 (SELL) and STANLN price=100.45 (BUY).
- Add "Switch trade" in the notes for both legs.

TICKER CONTINUITY — follow the full conversation:
- When a client refers back to a bond discussed earlier without the full ticker, resolve it from context.
- Example: If client bought "LLOYDS 29s" earlier and later "wants another 1m LLOYDS", the ticker is "LLOYDS 29s" (not just "LLOYDS").
- Always use the most specific ticker available from the conversation (include maturity/coupon if mentioned).

STATUS RULES — read the FULL conversation for each bond carefully:
1. "done", "yours", "mine", "executed", "filled", "traded", "confirmed", "coed" → EXECUTED
2. "traded away", "done away", "lost to", "competitor got it" → TRADED AWAY
3. "pass", "passed", "no thanks", "not interested", "too tight", "too wide", "not for us" → PASSED
4. "holding", "they're holding", "they're waiting", "might switch", "no response", client defers or does not confirm → QUOTED (NOT executed)
   - "They're holding. Might switch into the 29s instead." = client received a quote but did NOT execute → status = QUOTED
   - Even if the dealer improved the price (e.g., from 99.85 to 99.88), if the client's final response is "holding" the status is QUOTED.
5. Enquiry only, no price given → ENQUIRY
CRITICAL: Do NOT mark as EXECUTED unless there is explicit confirmation that a trade was done (e.g., "Done", "Coed", "Confirmed"). "Holding", "waiting", "might switch" are the OPPOSITE of confirmation — they mean the client declined to execute. Always check the client's LAST response for each bond to determine status.

MULTIPLE INTERACTIONS WITH SAME BOND:
- If the same client comes back for the same bond at a different time or price, treat each interaction as a SEPARATE activity record.
- Example: Client buys 500k at 101.45 (EXECUTED), then comes back for another 1m but decides to wait → TWO separate records: one EXECUTED at 101.45 for 0.5MM, one QUOTED at 101.60 for 1MM.
- IMPORTANT: When a client revisits a bond, use the full ticker from the earlier mention (see TICKER CONTINUITY above).

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
- If the transcript contains client type hints, extract them into "clientType":
  - "(HF)" or "Hedge Fund" → "Hedge Fund"
  - "(Pension)" or "Pension Fund" → "Pension Fund"
  - "(Private Bank)" → "Private Bank"
  - "(AM)" or "Asset Manager" → "Asset Manager"
  - "(Insurance)" → "Insurance"
  - "(Sovereign)" or "Sovereign Wealth" → "Sovereign"
  - If no hint, return "" for clientType.

NOTES: Write a brief outcome summary from the CLIENT's perspective. Examples:
- "Client bought 500k at 101.45" (not "Sold 500k")
- "Client sold 20m at 98.20 as part of switch"
- "Offered at 99.88, client holding"

Return JSON array only (no markdown):
[{"clientName":"Company","contactPerson":"Name","clientType":"","ticker":"Bond","isin":"","size":null,"direction":"BUY/SELL/TWO-WAY","price":null,"bidPrice":null,"offerPrice":null,"currency":"USD","status":"ENQUIRY/QUOTED/EXECUTED/PASSED/TRADED AWAY","notes":"brief outcome summary"}]`;

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
      // Text path: use GPT-4o-mini for better direction/context reasoning
      model = 'gpt-4o-mini';
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
        clientType: a.clientType || '',
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
