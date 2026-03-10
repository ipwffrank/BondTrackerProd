import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, limit, startAfter, where } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Log an audit event to Firestore.
 * @param {string} orgId - Organization ID
 * @param {object} entry - { action, details, userId, userName, userEmail }
 */
export async function logAudit(orgId, { action, details, userId, userName, userEmail }) {
  try {
    await addDoc(collection(db, 'organizations', orgId, 'auditLogs'), {
      action,
      details,
      userId,
      userName: userName || '',
      userEmail: userEmail || '',
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

/**
 * Fetch audit logs for an organization, paginated.
 * @param {string} orgId
 * @param {number} pageSize
 * @param {object|null} lastDoc - last document snapshot for pagination
 * @returns {{ logs: Array, lastDoc: object|null }}
 */
export async function getAuditLogs(orgId, pageSize = 50, lastDoc = null) {
  const col = collection(db, 'organizations', orgId, 'auditLogs');
  let q;
  if (lastDoc) {
    q = query(col, orderBy('timestamp', 'desc'), startAfter(lastDoc), limit(pageSize));
  } else {
    q = query(col, orderBy('timestamp', 'desc'), limit(pageSize));
  }
  const snap = await getDocs(q);
  const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const last = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { logs, lastDoc: last };
}

/**
 * Fetch audit logs across all organizations (for host admin).
 * Requires reading from each org's subcollection.
 * @param {string[]} orgIds - list of org IDs to query
 * @param {number} pageSize
 * @returns {Array}
 */
export async function getAllAuditLogs(orgIds, pageSize = 100) {
  const allLogs = [];
  for (const orgId of orgIds) {
    const col = collection(db, 'organizations', orgId, 'auditLogs');
    const q = query(col, orderBy('timestamp', 'desc'), limit(pageSize));
    const snap = await getDocs(q);
    snap.docs.forEach(d => allLogs.push({ id: d.id, organizationId: orgId, ...d.data() }));
  }
  allLogs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
  return allLogs.slice(0, pageSize);
}
