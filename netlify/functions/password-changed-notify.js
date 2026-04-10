const { Resend } = require('resend');
const { getCorsHeaders, handlePreflight } = require('./utils/cors');

exports.handler = async (event) => {
  const origin = event.headers?.origin || '';
  const headers = getCorsHeaders(origin);

  const preflight = handlePreflight(event, headers);
  if (preflight) return preflight;

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { email } = JSON.parse(event.body || '{}');

    if (!email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email is required' }),
      };
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured — skipping confirmation email');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, sent: false, reason: 'Email service not configured' }),
      };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Format timestamp in a readable way
    const now = new Date();
    const timeStr = now.toUTCString();

    await resend.emails.send({
      from: 'Axle Security <security@axle-finance.com>',
      to: email,
      subject: 'Your Axle password has been changed',
      html: `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f1f5f9; color: #1e293b; }
              .wrapper { padding: 40px 16px; }
              .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
              .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 40px; text-align: center; }
              .logo-wrap { display: inline-flex; align-items: center; gap: 10px; }
              .logo-mark { width: 36px; height: 36px; border-radius: 9px; background: linear-gradient(135deg, #10b981, #059669); display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; color: white; text-decoration: none; }
              .logo-text { font-size: 20px; font-weight: 700; color: #f8fafc; letter-spacing: -0.3px; }
              .body { padding: 36px 40px; }
              .icon-circle { width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #10b981, #059669); margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; }
              h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 12px; text-align: center; }
              .body p { font-size: 15px; color: #475569; line-height: 1.7; margin-bottom: 16px; }
              .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 16px 20px; margin: 24px 0; }
              .alert-box p { color: #991b1b; font-size: 14px; margin: 0; }
              .alert-box strong { color: #7f1d1d; }
              .meta-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              .meta-table td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
              .meta-table td:first-child { color: #94a3b8; font-weight: 600; width: 40%; }
              .meta-table td:last-child { color: #1e293b; font-weight: 500; }
              .btn { display: block; background: linear-gradient(135deg, #10b981, #059669); color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 15px; text-align: center; margin: 24px 0; }
              .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align: center; }
              .footer p { font-size: 12px; color: #94a3b8; line-height: 1.6; }
              @media (max-width: 480px) {
                .body { padding: 24px 20px; }
                .header { padding: 24px 20px; }
                .footer { padding: 20px; }
              }
            </style>
          </head>
          <body>
            <div class="wrapper">
              <div class="container">
                <div class="header">
                  <div class="logo-wrap">
                    <div class="logo-mark">A</div>
                    <span class="logo-text">Axle</span>
                  </div>
                </div>

                <div class="body">
                  <div class="icon-circle">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                  </div>

                  <h1>Password Changed Successfully</h1>

                  <p>
                    This is a confirmation that the password for your Axle account
                    (<strong>${email}</strong>) was recently changed.
                  </p>

                  <table class="meta-table">
                    <tr>
                      <td>Account</td>
                      <td>${email}</td>
                    </tr>
                    <tr>
                      <td>Time</td>
                      <td>${timeStr}</td>
                    </tr>
                    <tr>
                      <td>Action</td>
                      <td>Password reset via email link</td>
                    </tr>
                  </table>

                  <div class="alert-box">
                    <p>
                      <strong>Didn't make this change?</strong> If you did not reset your password,
                      your account may be compromised. Please contact your administrator or our
                      support team immediately at
                      <a href="mailto:support@axle-finance.com" style="color: #991b1b;">support@axle-finance.com</a>.
                    </p>
                  </div>

                  <a href="https://axle-finance.com/login" class="btn">
                    Sign In to Axle
                  </a>

                  <p style="font-size: 13px; color: #94a3b8; text-align: center; margin: 0;">
                    This is an automated security notification. Please do not reply to this email.
                  </p>
                </div>

                <div class="footer">
                  <p>Axle &mdash; The central intelligence platform for bond sales desks</p>
                  <p style="margin-top: 6px;">
                    &copy; ${now.getFullYear()} Bridge Logic LP
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, sent: true }),
    };
  } catch (error) {
    console.error('Failed to send password change notification:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message, sent: false }),
    };
  }
};
