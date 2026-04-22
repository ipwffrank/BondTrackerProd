const { Resend } = require('resend');
const { getCorsHeaders, handlePreflight } = require('./utils/cors');
const { verifyIdToken } = require('./utils/auth');
const { escapeHtml, safeHttpUrl } = require('./utils/escape-html');

exports.handler = async (event) => {
  const origin = event.headers?.origin || '';
  const headers = getCorsHeaders(origin);

  // Handle preflight
  const preflight = handlePreflight(event, headers);
  if (preflight) return preflight;

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Verify Firebase ID token — only authenticated users can send invites
  try {
    await verifyIdToken(event);
  } catch (authErr) {
    return {
      statusCode: authErr.statusCode || 401,
      headers,
      body: JSON.stringify({ error: authErr.message })
    };
  }

  try {
    const { email, organizationName, invitedBy, signupUrl } = JSON.parse(event.body);

    // Validate required fields
    if (!email || !organizationName || !invitedBy) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Check for Resend API key
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Email service not configured',
          sent: false
        })
      };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const safeEmail = escapeHtml(email);
    const safeOrgName = escapeHtml(organizationName);
    const safeInvitedBy = escapeHtml(invitedBy);
    const safeSignupUrl = safeHttpUrl(signupUrl, 'https://axle-finance.com/signup');

    // Send email
    const data = await resend.emails.send({
      from: 'Axle <info@axle-finance.com>',
      to: email,
      subject: `You're invited to join ${organizationName} on Axle`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #0f172a, #1e293b); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
              .button:hover { background: #059669; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>You're Invited to Axle</h1>
              </div>
              <div class="content">
                <p>Hi there,</p>
                <p><strong>${safeInvitedBy}</strong> has invited you to join <strong>${safeOrgName}</strong> on Axle.</p>
                <p>Axle is the central intelligence platform for bond sales desks — managing activities, client relationships, and deal pipelines.</p>
                <p style="text-align: center;">
                  <a href="${safeSignupUrl}" class="button">
                    Accept Invitation
                  </a>
                </p>
                <p><strong>Important:</strong> Please use this email address (<strong>${safeEmail}</strong>) when signing up to join the organization.</p>
                <div class="footer">
                  <p>This invitation was sent from Axle</p>
                  <p>If you didn't expect this invitation, you can safely ignore this email.</p>
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
      body: JSON.stringify({ 
        success: true, 
        sent: true,
        messageId: data.id 
      })
    };

  } catch (error) {
    console.error('Email send error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        sent: false
      })
    };
  }
};
