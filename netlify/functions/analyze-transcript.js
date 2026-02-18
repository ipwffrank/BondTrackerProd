cat > netlify/functions/analyze-transcript.js << 'EOF'
const https = require('https');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { transcript } = JSON.parse(event.body);

    if (!transcript) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Transcript is required' })
      };
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'AI service not configured' })
      };
    }

    const prompt = `You are analyzing bond trading chat transcripts from a DEALER's perspective.

CRITICAL BOND MARKET RULES:
1. When client asks for MY BID → They want to SELL to me → Direction: SELL
2. When client asks for MY OFFER → They want to BUY from me → Direction: BUY
3. "Your bid for X?" = Client wants to sell (SELL)
4. "Offer X please" = Client wants to buy (BUY)
5. "@" = at price, "/" = bid given, "Done" = EXECUTED, "Pass" = PASSED

CLIENT IDENTIFICATION:
Extract company from "(From Company)" or "(Company)".
Example: "Aeris (From Bosera)" → Client: Bosera, Contact: Aeris

OUTPUT FORMAT - Return ONLY a JSON array:
[{
  "clientName": "Company name",
  "contactPerson": "Person name",
  "ticker": "Bond name (e.g., APPLE 30)",
  "size": number or null,
  "direction": "BUY or SELL",
  "price": number or null,
  "status": "EXECUTED/QUOTED/PASSED/ENQUIRY",
  "notes": "Brief summary"
}]

EXAMPLES:
Input: "Aeris (From Bosera): Your bid for APPLE 30? / Frank: 100/ / Aeris: Done"
Output: [{"clientName":"Bosera","contactPerson":"Aeris","ticker":"APPLE 30","direction":"SELL","price":100,"status":"EXECUTED","notes":"Client asked for bid and executed at 100"}]

Input: "Michelle (Efund): Offer APPLE 30 in 2mm / Frank: @ 101 / Michelle: Pass"
Output: [{"clientName":"Efund","contactPerson":"Michelle","ticker":"APPLE 30","size":2,"direction":"BUY","price":101,"status":"PASSED","notes":"Asked for offer, quoted 101, passed"}]

Now analyze this transcript:
${transcript}

Return ONLY the JSON array, no other text.`;

    // Call OpenAI API
    const requestData = JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a bond trading analyst. Always return valid JSON arrays.' },
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
      throw new Error(`OpenAI API error: ${response.data}`);
    }

    const aiResponse = JSON.parse(response.data);
    let text = aiResponse.choices[0].message.content.trim();

    // Clean up
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let activities = JSON.parse(text);
    if (!Array.isArray(activities)) activities = [activities];

    const validActivities = activities.filter(a => 
      a.clientName && (a.ticker || a.isin) && a.direction && a.status
    ).map(a => ({
      clientName: a.clientName,
      contactPerson: a.contactPerson || '',
      activityType: 'Bloomberg Chat',
      isin: a.isin || '',
      ticker: a.ticker || '',
      size: a.size ? parseFloat(a.size) : null,
      currency: 'USD',
      price: a.price ? parseFloat(a.price) : null,
      direction: a.direction,
      status: a.status,
      notes: a.notes || ''
    }));

    console.log(`✅ Extracted ${validActivities.length} activities`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        activities: validActivities,
        count: validActivities.length
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
EOF
