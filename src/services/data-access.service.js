import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { logAudit } from './audit.service';

/**
 * Data Access / Export service (PDPO compliance).
 * Allows users to download all their personal data in structured JSON format.
 */
export const dataAccessService = {
  /**
   * Gather all personal data for the given user.
   * @param {string} userId - Firebase Auth UID
   * @param {string} organizationId - Organization ID
   * @param {object} userData - Current user data (name, email, etc.)
   * @returns {object} Structured export of all personal data
   */
  async exportUserData(userId, organizationId, userData) {
    const exportData = {
      exportedAt: new Date().toISOString(),
      dataSubject: {
        userId,
        email: userData.email || '',
        name: userData.name || '',
        organizationId,
      },
      profile: {},
      activities: [],
      auditLogs: [],
      transcriptUploads: [],
      aiCorrections: [],
      consentRecords: {},
      invitations: [],
    };

    // 1. Profile data from root users collection
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        exportData.profile = {
          email: data.email || '',
          name: data.name || '',
          role: data.role || '',
          isAdmin: data.isAdmin || false,
          organizationId: data.organizationId || '',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        };
        exportData.consentRecords = {
          consentGiven: data.consentGiven || false,
          consentTimestamp: data.consentTimestamp?.toDate?.()?.toISOString() || null,
          consentPolicyVersion: data.consentPolicyVersion || null,
          aiTranscriptConsent: data.aiTranscriptConsent || false,
          aiTranscriptConsentTimestamp: data.aiTranscriptConsentTimestamp?.toDate?.()?.toISOString() || null,
        };
      }
    } catch (err) {
      exportData.profile = { error: 'Could not retrieve profile data' };
    }

    // 2. Activities created by this user
    try {
      const activitiesRef = collection(db, `organizations/${organizationId}/activities`);
      const userName = userData.name || '';
      const userEmail = userData.email || '';

      // Query by createdBy (name)
      if (userName) {
        const q = query(activitiesRef, where('createdBy', '==', userName), orderBy('createdAt', 'desc'), limit(1000));
        const snap = await getDocs(q);
        snap.docs.forEach(d => {
          const data = d.data();
          exportData.activities.push({
            id: d.id,
            clientName: data.clientName || '',
            ticker: data.ticker || '',
            isin: data.isin || '',
            direction: data.direction || '',
            size: data.size || null,
            price: data.price || null,
            status: data.status || '',
            notes: data.notes || '',
            createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          });
        });
      }
    } catch (err) {
      exportData.activities = [{ error: 'Could not retrieve activities' }];
    }

    // 3. Audit logs involving this user
    try {
      const auditRef = collection(db, `organizations/${organizationId}/auditLogs`);
      const q = query(auditRef, where('userId', '==', userId), orderBy('timestamp', 'desc'), limit(500));
      const snap = await getDocs(q);
      snap.docs.forEach(d => {
        const data = d.data();
        exportData.auditLogs.push({
          id: d.id,
          action: data.action || '',
          details: data.details || '',
          timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
        });
      });
    } catch (err) {
      exportData.auditLogs = [{ error: 'Could not retrieve audit logs' }];
    }

    // 4. Transcript uploads by this user
    try {
      const uploadsRef = collection(db, `organizations/${organizationId}/transcriptUploads`);
      const q = query(uploadsRef, where('analyzedBy', '==', userData.name || ''), orderBy('analyzedAt', 'desc'), limit(500));
      const snap = await getDocs(q);
      snap.docs.forEach(d => {
        const data = d.data();
        exportData.transcriptUploads.push({
          id: d.id,
          fileName: data.fileName || '',
          analyzedAt: data.analyzedAt?.toDate?.()?.toISOString() || null,
          activitiesDetected: data.activitiesDetected || 0,
          fileType: data.fileType || '',
        });
      });
    } catch (err) {
      exportData.transcriptUploads = [{ error: 'Could not retrieve transcript uploads' }];
    }

    // 5. AI corrections by this user
    try {
      const correctionsRef = collection(db, `organizations/${organizationId}/aiCorrections`);
      const q = query(correctionsRef, where('correctedBy', '==', userData.name || ''), limit(500));
      const snap = await getDocs(q);
      snap.docs.forEach(d => {
        const data = d.data();
        exportData.aiCorrections.push({
          id: d.id,
          original: data.original || {},
          corrected: data.corrected || {},
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        });
      });
    } catch (err) {
      exportData.aiCorrections = [{ error: 'Could not retrieve AI corrections' }];
    }

    // 6. Invitations for this user's email
    try {
      if (userData.email) {
        const invitationsRef = collection(db, `organizations/${organizationId}/invitations`);
        const q = query(invitationsRef, where('email', '==', userData.email.toLowerCase()));
        const snap = await getDocs(q);
        snap.docs.forEach(d => {
          const data = d.data();
          exportData.invitations.push({
            id: d.id,
            status: data.status || '',
            role: data.role || '',
            invitedBy: data.invitedBy || '',
            createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          });
        });
      }
    } catch (err) {
      exportData.invitations = [{ error: 'Could not retrieve invitations' }];
    }

    // Log the data export in audit trail
    try {
      await logAudit(organizationId, {
        action: 'data_access_export',
        details: `User exported their personal data (${exportData.activities.length} activities, ${exportData.auditLogs.length} audit logs, ${exportData.transcriptUploads.length} transcript uploads)`,
        userId,
        userName: userData.name || '',
        userEmail: userData.email || '',
      });
    } catch (err) {
      // Non-fatal
    }

    return exportData;
  },

  /**
   * Download exported data as a JSON file.
   * @param {object} data - The exported data object
   * @param {string} userName - User name for the filename
   */
  downloadAsJson(data, userName) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `axle_data_export_${(userName || 'user').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
