/**
 * Shared Firebase Auth verification helpers for Netlify functions.
 * Provides ID token verification and host admin checks.
 */

const admin = require('firebase-admin');

/**
 * Initialize Firebase Admin SDK (lazy singleton).
 * Must be called before using any admin features.
 */
function initFirebaseAdmin() {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  return admin;
}

/**
 * Verify a Firebase ID token from the Authorization header.
 * @param {object} event - Netlify function event
 * @returns {{ uid: string, email: string, token: object }} Decoded token info
 * @throws {Error} If token is missing or invalid
 */
async function verifyIdToken(event) {
  const authHeader = event.headers?.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('Missing authentication token');
    err.statusCode = 401;
    throw err;
  }

  const idToken = authHeader.split('Bearer ')[1];
  initFirebaseAdmin();

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      token: decodedToken,
    };
  } catch (err) {
    const error = new Error('Invalid or expired authentication token');
    error.statusCode = 401;
    throw error;
  }
}

/**
 * Check if the given user ID is a host admin.
 * @param {string} uid - Firebase user ID
 * @returns {boolean} True if the user is a host admin
 */
async function isHostAdmin(uid) {
  initFirebaseAdmin();
  const db = admin.firestore();
  const hostAdminDoc = await db.collection('hostAdmins').doc(uid).get();
  return hostAdminDoc.exists;
}

/**
 * Verify that the caller is authenticated AND is a host admin.
 * @param {object} event - Netlify function event
 * @returns {{ uid: string, email: string, token: object }}
 * @throws {Error} If not authenticated or not a host admin
 */
async function verifyHostAdmin(event) {
  const user = await verifyIdToken(event);
  const isAdmin = await isHostAdmin(user.uid);
  if (!isAdmin) {
    const err = new Error('Unauthorized: host admin access required');
    err.statusCode = 403;
    throw err;
  }
  return user;
}

module.exports = { initFirebaseAdmin, verifyIdToken, isHostAdmin, verifyHostAdmin };
