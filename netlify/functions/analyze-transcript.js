exports.handler = async (event) => {
  console.log('=== Function Started ===');
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    console.log('OPTIONS request');
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log('Environment check:');
    console.log('- OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
    
    const { transcript } = JSON.parse(event.body || '{}');
    
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

    if (!transcript) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Transcript required' })
      };
    }

    const https = require('https');
    
    const prompt = `Analyze bond trading chat from the DEALER's perspective (the person quoting prices).

DIRECTION RULES (from dealer's perspective — this is critical):
1. Client asks "Your bid?" or "bid for X?" → direction = BUY (the dealer is buying from the client)
2. Client asks "Offer X" or "Yours?" or wants to buy → direction = SELL (the dealer is selling to the client)
3. If client asks for both bid and offer → direction = TWO-WAY

OTHER RULES:
3. Extract the CLIENT company from "(From Company)" or context. The dealer's own firm is NOT the client.
4. Determine status from the final outcome of the conversation:
   - "done", "yours", "mine", "executed", "filled", "traded", "confirmed" → EXECUTED
   - "traded away", "done away", "lost to", "competitor got it" → TRADED AWAY
   - "pass", "passed", "no thanks", "not interested", "too tight", "too wide", "not for us" → PASSED
   - Price was quoted but no final outcome mentioned → QUOTED
   - Enquiry only, no price given → ENQUIRY
5. PRICE: The dealer's response with a number IS the price, even if it looks like shorthand. Bond trading price notation examples:
   - "100/" means the dealer's bid price is 100 (trailing slash = bid side)
   - "@ 101" means the dealer's offer price is 101
   - "/99" means the dealer's offer price is 99 (leading slash = offer side)
   - "99/101" means bid 99 / offer 101
   - Any number the dealer says in reply to a price request IS the price.
   Always return price as a plain number (e.g. 100, 101, 99.5). Never return null if the dealer quoted a number.
6. SIZE must always be in millions (MM). Examples: "15MM" → 15, "2mm" → 2, "$50 million" → 50, "500k" → 0.5, "1bn" → 1000. If no size is mentioned in the conversation, return null (not 0).

Return JSON array only (no markdown):
[{"clientName":"Company","contactPerson":"Name","ticker":"Bond","isin":"","size":null,"direction":"BUY/SELL/TWO-WAY","price":null,"currency":"USD","status":"ENQUIRY/QUOTED/EXECUTED/PASSED/TRADED AWAY","notes":"brief outcome summary"}]

Transcript: ${transcript}`;

    const requestData = JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a bond trading analyst. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
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
      return {
        clientName: a.clientName,
        contactPerson: a.contactPerson || '',
        activityType: 'Bloomberg Chat',
        isin: a.isin || '',
        ticker: a.ticker || '',
        size: (parsedSize && !isNaN(parsedSize)) ? parsedSize : null,
        currency: 'USD',
        price: (parsedPrice && !isNaN(parsedPrice)) ? parsedPrice : null,
        direction: a.direction,
        status: a.status,
        notes: a.notes || ''
      };
    });

    console.log(`✅ Extracted ${validActivities.length} activities`);

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
