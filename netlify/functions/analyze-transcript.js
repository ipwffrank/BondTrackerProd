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

    if (!transcript || !transcript.trim()) {
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
    
    // Use gemini-1.5-flash-latest with specific API version
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash-latest',
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      }
    });

    const prompt = `Analyze bond trading chat transcript from DEALER perspective.

RULES:
1. Client asks "Your bid?" = Client SELLING (Direction: SELL)
2. Client asks "Offer?" = Client BUYING (Direction: BUY)  
3. "@" = at price, "/" = bid, "Done" = EXECUTED, "Pass" = PASSED

Extract: Company from "(From X)" or "(X)".

Return JSON array:
[{
  "clientName": "Company",
  "contactPerson": "Name",
  "ticker": "Bond",
  "size": number,
  "direction": "BUY/SELL",
  "price": number,
  "status": "EXECUTED/QUOTED/PASSED/ENQUIRY",
  "notes": "summary"
}]

Transcript:
${transcript}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text();

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
