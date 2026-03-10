const admin = require('firebase-admin');

// Initialize Firebase Admin (lazy singleton)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

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
    const { hostKey, limit: pageLimit } = JSON.parse(event.body);

    if (!process.env.HOST_ADMIN_KEY || hostKey !== process.env.HOST_ADMIN_KEY) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

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
