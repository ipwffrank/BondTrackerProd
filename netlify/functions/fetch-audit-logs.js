const admin = require('firebase-admin');
const { getCorsHeaders, handlePreflight } = require('./utils/cors');
const { verifyHostAdmin, initFirebaseAdmin } = require('./utils/auth');

// Initialize Firebase Admin (lazy singleton)
initFirebaseAdmin();

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
    const { limit: pageLimit } = JSON.parse(event.body);

    const db = admin.firestore();
    const maxLogs = Math.min(pageLimit || 200, 500);

    // Get all organizations
    const orgsSnap = await db.collection('organizations').get();
    const allLogs = [];

    for (const orgDoc of orgsSnap.docs) {
      const orgId = orgDoc.id;
      const orgName = orgDoc.data().name || orgDoc.data().domain || orgId;
      const logsSnap = await db
        .collection('organizations')
        .doc(orgId)
        .collection('auditLogs')
        .orderBy('timestamp', 'desc')
        .limit(maxLogs)
        .get();

      logsSnap.docs.forEach(d => {
        const data = d.data();
        allLogs.push({
          id: d.id,
          organizationId: orgId,
          organizationName: orgName,
          action: data.action || '',
          details: data.details || '',
          userName: data.userName || '',
          userEmail: data.userEmail || '',
          userId: data.userId || '',
          timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : null,
        });
      });
    }

    // Sort by timestamp descending
    allLogs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ logs: allLogs.slice(0, maxLogs) }),
    };

  } catch (error) {
    console.error('Fetch audit logs error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
