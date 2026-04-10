const admin = require('firebase-admin');
const { getCorsHeaders, handlePreflight } = require('./utils/cors');
const { verifyHostAdmin, initFirebaseAdmin } = require('./utils/auth');

// Initialize Firebase Admin (lazy singleton)
initFirebaseAdmin();

const db = admin.firestore();

exports.handler = async (event) => {
  const origin = event.headers?.origin || '';
  const headers = getCorsHeaders(origin);

  const preflight = handlePreflight(event, headers);
  if (preflight) return preflight;

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Verify caller is an authenticated host admin
  try {
    await verifyHostAdmin(event);
  } catch (authErr) {
    return {
      statusCode: authErr.statusCode || 401,
      headers,
      body: JSON.stringify({ error: authErr.message }),
    };
  }

  try {
    const { action, orgId, samlProviderId, allowedDomains } = JSON.parse(event.body);

    if (!orgId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Organization ID is required' }) };
    }

    const orgRef = db.collection('organizations').doc(orgId);
    const orgSnap = await orgRef.get();

    if (!orgSnap.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Organization not found' }) };
    }

    if (action === 'get') {
      const data = orgSnap.data();
      const config = data.ssoEnabled ? {
        ssoEnabled: true,
        samlProviderId: data.samlProviderId || '',
        allowedDomains: data.allowedDomains || [],
      } : null;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ config, orgName: data.name || orgId }),
      };
    }

    if (action === 'set') {
      if (!samlProviderId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'SAML Provider ID is required' }) };
      }

      // Verify org is on Professional plan
      const orgData = orgSnap.data();
      if (orgData.plan !== 'professional') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `SSO requires Professional plan. This org is on "${orgData.plan || 'essential'}" plan.` }),
        };
      }

      await orgRef.update({
        ssoEnabled: true,
        samlProviderId,
        allowedDomains: Array.isArray(allowedDomains) ? allowedDomains : [],
        ssoUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'SSO enabled successfully' }),
      };
    }

    if (action === 'disable') {
      await orgRef.update({
        ssoEnabled: false,
        ssoUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'SSO disabled' }),
      };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action. Use: get, set, disable' }) };
  } catch (err) {
    console.error('SSO config error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
