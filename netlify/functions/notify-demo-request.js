const { Resend } = require('resend');
const { getCorsHeaders, handlePreflight } = require('./utils/cors');
const { enforceRateLimit } = require('./utils/rate-limit');

exports.handler = async (event) => {
  const origin = event.headers?.origin || '';
  const headers = getCorsHeaders(origin);

  const preflight = handlePreflight(event, headers);
  if (preflight) return preflight;

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Rate limit: 5 requests per minute per IP
  const rateLimited = enforceRateLimit(event, headers, { windowMs: 60000, maxRequests: 5 });
  if (rateLimited) return rateLimited;

  try {
    const { firstName, lastName, jobTitle, email, company, employees, phone } = JSON.parse(event.body);

    if (!firstName || !email || !company) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Email service not configured' }) };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const data = await resend.emails.send({
      from: 'Axle <info@axle-finance.com>',
      to: 'info@axle-finance.com',
      subject: `New Demo Request from ${firstName} ${lastName} at ${company}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #0f172a, #1e293b); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .field { margin-bottom: 12px; }
              .label { font-weight: bold; color: #555; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>New Demo Request</h1>
              </div>
              <div class="content">
                <div class="field"><span class="label">Name:</span> ${firstName} ${lastName || ''}</div>
                <div class="field"><span class="label">Job Title:</span> ${jobTitle || 'N/A'}</div>
                <div class="field"><span class="label">Email:</span> ${email}</div>
                <div class="field"><span class="label">Company:</span> ${company}</div>
                <div class="field"><span class="label">Company Size:</span> ${employees || 'N/A'}</div>
                <div class="field"><span class="label">Phone:</span> ${phone || 'N/A'}</div>
                <div class="footer">
                  <p>This request was submitted via the Axle website demo form.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, messageId: data.id })
    };

  } catch (error) {
    console.error('Demo notification error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
