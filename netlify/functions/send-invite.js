// netlify/functions/send-invite.js
export default async (req, context) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const { email, organizationName, invitedBy, role } = body;

    // Validate required fields
    if (!email || !organizationName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get Resend API key from environment variables
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Your app's signup URL
    const signupUrl = 'https://bondnie.netlify.app/signup';

    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Bond Tracker <noreply@yourdomain.com>', // Change to your verified domain
        to: [email],
        subject: `You're invited to join ${organizationName} on Bond Tracker`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3B82F6, #8B5CF6); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .header h1 { color: white; margin: 0; font-size: 24px; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
              .button { display: inline-block; background: #3B82F6; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
              .button:hover { background: #2563EB; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
              .role-badge { display: inline-block; background: ${role === 'admin' ? '#8B5CF6' : '#6B7280'}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📊 Bond Tracker</h1>
              </div>
              <div class="content">
                <h2>You're Invited!</h2>
                <p>Hi there,</p>
                <p><strong>${invitedBy}</strong> has invited you to join <strong>${organizationName}</strong> on Bond Tracker as a <span class="role-badge">${role === 'admin' ? 'Admin' : 'Team Member'}</span>.</p>
                
                <p>Bond Tracker is an enterprise bond sales tracking platform with:</p>
                <ul>
                  <li>📋 Activity tracking with AI transcript analysis</li>
                  <li>👥 Client CRM management</li>
                  <li>📊 Pipeline management with Kanban boards</li>
                  <li>📈 Real-time analytics and reporting</li>
                </ul>
                
                <p style="text-align: center;">
                  <a href="${signupUrl}" class="button">Accept Invitation & Sign Up</a>
                </p>
                
                <p><strong>Important:</strong> Please sign up using this email address (<strong>${email}</strong>) to automatically join ${organizationName}.</p>
                
                <p>This invitation expires in 7 days.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Bond Tracker. All rights reserved.</p>
                <p>If you didn't expect this invitation, you can safely ignore this email.</p>
              </div>
            </div>
          </body>
          </html>
        `
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', result);
      return new Response(JSON.stringify({ error: 'Failed to send email', details: result }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, messageId: result.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error sending invite:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
