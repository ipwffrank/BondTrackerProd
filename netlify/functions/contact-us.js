const { Resend } = require('resend');

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
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { firstName, lastName, email, phone, message } = JSON.parse(event.body);

    if (!firstName || !lastName || !email || !message) {
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
      subject: `Contact Form: ${firstName} ${lastName} (${email})`,
      replyTo: email,
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
              .message-box { background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin-top: 16px; white-space: pre-wrap; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>New Contact Message</h1>
              </div>
              <div class="content">
                <div class="field"><span class="label">Name:</span> ${firstName} ${lastName}</div>
                <div class="field"><span class="label">Email:</span> ${email}</div>
                <div class="field"><span class="label">Phone:</span> ${phone || 'N/A'}</div>
                <div class="label" style="margin-top: 16px;">Message:</div>
                <div class="message-box">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                <div class="footer">
                  <p>Submitted via the Axle website contact form.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `
    });

    console.log('Contact form email sent:', data);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, messageId: data.id })
    };

  } catch (error) {
    console.error('Contact form error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
