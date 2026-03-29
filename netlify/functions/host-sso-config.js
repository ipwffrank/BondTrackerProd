const admin = require('firebase-admin');

// Initialize Firebase Admin (lazy singleton)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { hostKey, action, orgId, samlProviderId, allowedDomains } = JSON.parse(event.body);

    // Verify host admin secret
    if (!hostKey || hostKey !== process.env.HOST_ADMIN_KEY) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Invalid host admin key' }) };
    }

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
