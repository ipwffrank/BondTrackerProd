const { GoogleGenerativeAI } = require('@google/generative-ai');

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

    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'AI service not configured' })
      };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: 'gemini-1.5-flash-latest',
  generationConfig: {
    temperature: 0.2,
  }
});
    const prompt = `You are analyzing bond trading chat transcripts from a DEALER's perspective. The dealer (me) is talking to clients.

CRITICAL BOND MARKET RULES:
1. When a client asks for MY BID → They want to SELL to me → Direction: SELL (client is seller)
2. When a client asks for MY OFFER/price → They want to BUY from me → Direction: BUY (client is buyer)
3. "Your bid for X?" = Client wants to sell
4. "Offer X please" or "Your offer?" = Client wants to buy
5. "@" symbol means "at price" (e.g., "@ 101" = at price 101)
6. "/" after number means "bid given" (e.g., "100/" = bid at 100)
7. "Done" = Trade executed
8. "Pass" = Client declined

CLIENT IDENTIFICATION:
- Look for "(From [Company])" or company name in parentheses after the name
- Example: "Aeris (From Bosera)" → Client: Bosera, Contact: Aeris
- Example: "Michelle (Efund)" → Client: Efund, Contact: Michelle

ACTIVITY TYPE:
- If contains "Done" → Status: EXECUTED
- If contains "Pass" or client declined → Status: PASSED
- If dealer gave price but no response → Status: QUOTED
- If client only asked for price → Status: ENQUIRY

OUTPUT FORMAT:
Return ONLY a JSON array. Each activity must have:
{
  "clientName": "Company name (e.g., Bosera, Efund)",
  "contactPerson": "Individual's name (e.g., Aeris, Michelle)", 
  "activityType": "Bloomberg Chat",
  "isin": "Bond ISIN if mentioned",
  "ticker": "Bond ticker/name (e.g., APPLE 30)",
  "size": "Size in millions (number only, e.g., 2 for 2mm)",
  "direction": "BUY or SELL (from CLIENT perspective: if client asks for bid=SELL, if client asks for offer=BUY)",
  "price": "Price if quoted (number only)",
  "status": "EXECUTED, QUOTED, PASSED, or ENQUIRY",
  "notes": "Brief summary of the conversation"
}

EXAMPLE 1:
Input: "Aeris (From Bosera): Your bid for APPLE 30? / Frank (CLSA): 100/ / Aeris: Done"
Output: [{"clientName":"Bosera","contactPerson":"Aeris","activityType":"Bloomberg Chat","ticker":"APPLE 30","size":null,"direction":"SELL","price":100,"status":"EXECUTED","notes":"Client asked for bid and executed at 100"}]

EXAMPLE 2:
Input: "Michelle (Efund): Offer APPLE 30 in 2mm please / Frank (CLSA): @ 101 / Michelle: Pass"
Output: [{"clientName":"Efund","contactPerson":"Michelle","activityType":"Bloomberg Chat","ticker":"APPLE 30","size":2,"direction":"BUY","price":101,"status":"PASSED","notes":"Client asked for offer at 2mm, quoted 101 but passed"}]

EXAMPLE 3:
Input: "John (ABC Fund): What's your offer on TSLA 5Y? / Frank: 98.5 / John: Thanks, will get back"
Output: [{"clientName":"ABC Fund","contactPerson":"John","activityType":"Bloomberg Chat","ticker":"TSLA 5Y","direction":"BUY","price":98.5,"status":"QUOTED","notes":"Client enquired about offer, quoted 98.5"}]

Now analyze this transcript:

${transcript}

Return ONLY the JSON array, no other text.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Clean up markdown code blocks if present
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse the JSON
    let activities;
    try {
      activities = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse AI response:', text);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to parse AI response',
          rawResponse: text 
        })
      };
    }

    // Validate and clean up activities
    const validActivities = activities.filter(activity => {
      return activity.clientName && 
             (activity.ticker || activity.isin) && 
             activity.direction &&
             activity.status;
    }).map(activity => ({
      clientName: activity.clientName,
      contactPerson: activity.contactPerson || '',
      activityType: 'Bloomberg Chat',
      isin: activity.isin || '',
      ticker: activity.ticker || '',
      size: activity.size ? parseFloat(activity.size) : null,
      currency: 'USD', // Default, can be overridden
      price: activity.price ? parseFloat(activity.price) : null,
      direction: activity.direction,
      status: activity.status,
      notes: activity.notes || ''
    }));

    console.log(`✅ Extracted ${validActivities.length} activities from transcript`);

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
    console.error('Error analyzing transcript:', error);
    
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
