const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Get API key from environment variable
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Server configuration error: GEMINI_API_KEY not set' }) 
    };
  }

  try {
    const { transcript } = JSON.parse(event.body);
    
    if (!transcript || typeof transcript !== 'string') {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Missing or invalid transcript' }) 
      };
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.2,  // Lower temperature for more consistent/accurate results
        topP: 0.8,
        topK: 10,
      }
    });

    const prompt = `You are an expert bond trading analyst. Extract structured data from this chat transcript.

CRITICAL BOND TRADING TERMINOLOGY (YOU MUST FOLLOW THESE RULES):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ MOST IMPORTANT: Distinguish between ASKING for a bid/offer vs MAKING a bid/offer!

1. When client ASKS for YOUR BID → Client is SELLING
   - "What's your bid?" = Client wants to SELL to you
   - "Can you bid me?" = Client wants to SELL to you
   - "Give me a bid on..." = Client wants to SELL to you

2. When client MAKES/STATES THEIR BID → Client is BUYING
   - "I bid 10mm at 100" = Client is offering to BUY at 100
   - "Bosera bid 5mm" = Bosera is offering to BUY
   - "[ClientName] bid [amount]" = Client is BUYING
   
3. When client ASKS for YOUR OFFER/ASK → Client is BUYING
   - "What's your offer?" = Client wants to BUY from you
   - "Can you offer me?" = Client wants to BUY from you
   - "What's your ask?" = Client wants to BUY from you

4. When client MAKES/STATES THEIR OFFER → Client is SELLING
   - "I offer 10mm at 100" = Client is offering to SELL at 100
   - "Bosera offers 5mm" = Bosera is offering to SELL
   - "[ClientName] offers [amount]" = Client is SELLING

5. TWO-WAY means client might buy OR sell
   - "Give me a two-way" = Client wants both bid and offer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLES TO LEARN FROM:
Example 1:
Transcript: "Hi, what's your bid on 5MM of the Treasury 4.5% due 2034?"
Analysis: Client ASKING for your bid means they want to sell
Direction: SELL

Example 2:
Transcript: "Can you offer me 10MM of Apple bonds?"
Analysis: Client ASKING for your offer means they want to buy
Direction: BUY

Example 3:
Transcript: "I need a two-way quote on 20MM Microsoft 3.5s"
Analysis: Client might buy or sell
Direction: TWO-WAY

Example 4:
Transcript: "Bosera: Bosera bid 10mm DKS 52\nPaul: @ 100\nBosera: Done"
Analysis: Bosera STATED their bid (offering to buy at 100)
Direction: BUY

Example 5:
Transcript: "Client offers 15mm corporate bonds at 99.5"
Analysis: Client STATED their offer (offering to sell at 99.5)
Direction: SELL

NOW ANALYZE THIS TRANSCRIPT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${transcript}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Extract all trade-related activities. For each activity, return:
- clientName (uppercase, e.g. "ABC FUND")
- bondName or isin (if mentioned)
- ticker (if mentioned, e.g. "AAPL" for Apple)
- size (in millions, numeric only, e.g. 10 for "10MM")
- currency (USD/EUR/GBP etc, default "USD" if not mentioned)
- direction (BUY/SELL/TWO-WAY - FOLLOW THE RULES ABOVE CAREFULLY!)
- price (if mentioned, numeric)
- notes (any market color, pricing comments, or context)
- confidence (your confidence level: "high", "medium", or "low")

Return ONLY a JSON array with no markdown formatting, like:
[{"clientName":"ABC FUND","bondName":"Apple 2.5% 2030","isin":"US0378331005","ticker":"AAPL","size":10,"currency":"USD","direction":"SELL","price":98.75,"notes":"Client asking for bid on 10MM","confidence":"high"}]

If no activities found, return empty array: []

REMEMBER: BID = CLIENT IS SELLING, OFFER = CLIENT IS BUYING`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text().trim();
    
    // Strip markdown code fences if present
    text = text.replace(/^```json\n?/i, '').replace(/\n?```$/i, '');
    
    // Parse the JSON
    let activities;
    try {
      activities = JSON.parse(text);
    } catch (parseErr) {
      console.error('Failed to parse Gemini response:', text);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'AI returned invalid JSON', raw: text })
      };
    }

    if (!Array.isArray(activities)) {
      activities = [];
    }

    // Validation layer - double-check the direction based on keywords
    activities = activities.map(activity => {
      const originalDirection = activity.direction;
      
      // Extract just the relevant context for this specific client/activity
      const activityContext = extractActivityContext(transcript, activity);
      const validatedDirection = validateDirection(activityContext, activity);
      
      // If validation suggests a different direction, flag it
      if (validatedDirection !== originalDirection && validatedDirection !== 'UNKNOWN') {
        activity.notes = (activity.notes || '') + ` [Auto-corrected from ${originalDirection} to ${validatedDirection}]`;
        activity.direction = validatedDirection;
        activity.confidence = 'medium'; // Lower confidence when we had to correct
      }
      
      return activity;
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activities })
    };

  } catch (error) {
    console.error('Gemini API error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message || 'AI analysis failed',
        details: error.toString()
      })
    };
  }
};

/**
 * Extracts relevant context for a specific activity from the full transcript
 * This ensures validation checks only the client's specific conversation
 */
function extractActivityContext(transcript, activity) {
  if (!activity.clientName) {
    return transcript; // If no client name, check entire transcript
  }
  
  const lines = transcript.split('\n');
  const clientName = activity.clientName.toLowerCase();
  
  // Find lines that mention this client
  const relevantLines = lines.filter(line => {
    const lowerLine = line.toLowerCase();
    return lowerLine.includes(clientName) || 
           // Also include the next line after client (dealer's response)
           lines[lines.indexOf(line) - 1]?.toLowerCase().includes(clientName);
  });
  
  // If we found relevant lines, use those; otherwise use full transcript
  return relevantLines.length > 0 ? relevantLines.join('\n') : transcript;
}

/**
 * Validates the direction based on keyword analysis
 * This acts as a safety net if the AI misinterprets
 */
function validateDirection(transcript, activity) {
  const lowerTranscript = transcript.toLowerCase();
  
  // CRITICAL: Distinguish between ASKING for bid/offer vs MAKING bid/offer
  
  // Pattern 1: Client MAKING a bid (stating their price) = BUYING
  const clientMakingBid = [
    /\b(i bid|we bid|[a-z]+ bid \d+|client bid)\b/i,
    /\b(bosera|fidelity|blackrock|efund|vanguard|pimco|jpmorgan|state street|invesco) bid\b/i
  ];
  
  // Pattern 2: Client ASKING for your bid = SELLING
  const clientAskingForBid = [
    /\b(what'?s? (is )?your bid|can you bid|give me a bid|show me (a|your) bid)\b/i,
    /\b(where('?s| is) your bid|need a bid)\b/i
  ];
  
  // Pattern 3: Client MAKING an offer (stating their price) = SELLING
  const clientMakingOffer = [
    /\b(i offer|we offer|[a-z]+ offers? \d+|client offers?)\b/i,
    /\b(bosera|fidelity|blackrock|efund|vanguard|pimco|jpmorgan|state street|invesco) offers?\b/i
  ];
  
  // Pattern 4: Client ASKING for your offer = BUYING
  const clientAskingForOffer = [
    /\b(what'?s? (is )?your (offer|ask)|can you offer|give me an offer|offer me)\b/i,
    /\b(where('?s| is) your (offer|ask)|show me (an|your) (offer|ask))\b/i
  ];
  
  // Two-way indicators
  const twoWayKeywords = [
    /\b(two-?way|both sides|bid and offer|bid-offer)\b/i
  ];
  
  // Check for two-way first
  if (twoWayKeywords.some(regex => regex.test(lowerTranscript))) {
    return 'TWO-WAY';
  }
  
  // Priority order matters! Check "making bid/offer" BEFORE "asking for bid/offer"
  // because "I bid" is more specific than general "bid" mentions
  
  // Check if client is MAKING a bid (they're buying)
  if (clientMakingBid.some(regex => regex.test(lowerTranscript))) {
    return 'BUY';
  }
  
  // Check if client is MAKING an offer (they're selling)
  if (clientMakingOffer.some(regex => regex.test(lowerTranscript))) {
    return 'SELL';
  }
  
  // Check if client is ASKING for your bid (they're selling)
  if (clientAskingForBid.some(regex => regex.test(lowerTranscript))) {
    return 'SELL';
  }
  
  // Check if client is ASKING for your offer (they're buying)
  if (clientAskingForOffer.some(regex => regex.test(lowerTranscript))) {
    return 'BUY';
  }
  
  // If we can't determine, return unknown (keep AI's guess)
  return 'UNKNOWN';
}
