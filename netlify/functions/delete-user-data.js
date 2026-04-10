const admin = require('firebase-admin');
const { getCorsHeaders, handlePreflight } = require('./utils/cors');
const { verifyIdToken, initFirebaseAdmin } = require('./utils/auth');

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

  // Verify caller is authenticated
  let caller;
  try {
    caller = await verifyIdToken(event);
  } catch (authErr) {
    return {
      statusCode: authErr.statusCode || 401,
      headers,
      body: JSON.stringify({ error: authErr.message }),
    };
  }

  try {
    const { userId, organizationId } = JSON.parse(event.body);

    if (!userId || !organizationId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'userId and organizationId are required' }),
      };
    }

    // Verify caller is an admin in the same org or a host admin
    const db = admin.firestore();
    const callerDoc = await db.collection('users').doc(caller.uid).get();
    const callerData = callerDoc.exists ? callerDoc.data() : {};

    const hostAdminDoc = await db.collection('hostAdmins').doc(caller.uid).get();
    const isHostAdmin = hostAdminDoc.exists;

    const isOrgAdmin = callerData.organizationId === organizationId && callerData.isAdmin === true;

    if (!isOrgAdmin && !isHostAdmin) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Only organization admins or host admins can delete user data' }),
      };
    }

    // Prevent self-deletion
    if (userId === caller.uid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Cannot delete your own account through this endpoint' }),
      };
    }

    // Get user data before deletion for reference
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const userEmail = userData.email || '';
    const userName = userData.name || '';

    // 1. Delete organizations/{orgId}/users/{userId} doc
    try {
      await db.collection('organizations').doc(organizationId).collection('users').doc(userId).delete();
    } catch (err) {
      // Non-fatal — doc may not exist
    }

    // 2. Anonymize activities created by the user
    const activitiesSnap = await db.collection('organizations').doc(organizationId)
      .collection('activities')
      .where('createdBy', '==', userName)
      .get();

    const batch1 = db.batch();
    let batchCount = 0;
    for (const actDoc of activitiesSnap.docs) {
      batch1.update(actDoc.ref, {
        createdBy: '[Deleted User]',
        addedBy: '[Deleted User]',
        addedByName: '[Deleted User]',
      });
      batchCount++;
      if (batchCount >= 450) break; // Firestore batch limit safety
    }

    // Also check addedBy field
    const activitiesSnap2 = await db.collection('organizations').doc(organizationId)
      .collection('activities')
      .where('addedBy', '==', userEmail)
      .get();

    for (const actDoc of activitiesSnap2.docs) {
      if (batchCount >= 450) break;
      batch1.update(actDoc.ref, {
        createdBy: '[Deleted User]',
        addedBy: '[Deleted User]',
        addedByName: '[Deleted User]',
      });
      batchCount++;
    }

    if (batchCount > 0) {
      await batch1.commit();
    }

    // 3. Delete transcript uploads by the user
    const uploadsSnap = await db.collection('organizations').doc(organizationId)
      .collection('transcriptUploads')
      .where('analyzedBy', '==', userName)
      .get();

    const batch2 = db.batch();
    let batch2Count = 0;
    for (const uploadDoc of uploadsSnap.docs) {
      batch2.delete(uploadDoc.ref);
      batch2Count++;
      if (batch2Count >= 450) break;
    }
    if (batch2Count > 0) {
      await batch2.commit();
    }

    // 4. Delete AI corrections by the user
    const correctionsSnap = await db.collection('organizations').doc(organizationId)
      .collection('aiCorrections')
      .where('correctedBy', '==', userName)
      .get();

    const batch3 = db.batch();
    let batch3Count = 0;
    for (const corrDoc of correctionsSnap.docs) {
      batch3.delete(corrDoc.ref);
      batch3Count++;
      if (batch3Count >= 450) break;
    }
    if (batch3Count > 0) {
      await batch3.commit();
    }

    // 5. Delete pending invitations for the user's email
    if (userEmail) {
      const invitationsSnap = await db.collection('organizations').doc(organizationId)
        .collection('invitations')
        .where('email', '==', userEmail.toLowerCase())
        .where('status', '==', 'pending')
        .get();

      const batch4 = db.batch();
      let batch4Count = 0;
      for (const invDoc of invitationsSnap.docs) {
        batch4.delete(invDoc.ref);
        batch4Count++;
        if (batch4Count >= 450) break;
      }
      if (batch4Count > 0) {
        await batch4.commit();
      }
    }

    // 6. Delete root-level users/{userId} doc
    try {
      await db.collection('users').doc(userId).delete();
    } catch (err) {
      // Non-fatal
    }

    // 7. Delete Firebase Auth account
    try {
      await admin.auth().deleteUser(userId);
    } catch (err) {
      // User may have already been deleted from Auth
      if (err.code !== 'auth/user-not-found') {
        throw err;
      }
    }

    // 8. Log the deletion in audit trail
    await db.collection('organizations').doc(organizationId).collection('auditLogs').add({
      action: 'user_data_deleted',
      details: `Complete data deletion for user: ${userEmail || userId}`,
      userId: caller.uid,
      userName: callerData.name || caller.email,
      userEmail: caller.email,
      targetUserId: userId,
      targetUserEmail: userEmail,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `User data for ${userEmail || userId} has been completely deleted`,
        deletedRecords: {
          activities: batchCount,
          transcriptUploads: batch2Count,
          aiCorrections: batch3Count,
        },
      }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
