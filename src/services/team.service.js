import { collection, doc, getDocs, getDoc, updateDoc, deleteDoc, query, where, addDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from './firebase';

export const teamService = {
  // Subscribe to team members in real-time
  subscribe(organizationId, callback) {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('organizationId', '==', organizationId), orderBy('name', 'asc'));
    
    return onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(members);
    }, (error) => {
      console.error('Error subscribing to team:', error);
      callback([]);
    });
  },

  // Get all team members (one-time fetch)
  async getMembers(organizationId) {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('organizationId', '==', organizationId));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching team members:', error);
      throw error;
    }
  },

  // Update user role (promote/demote) — writes to both root users doc and org-specific doc
  async updateRole(userId, isAdmin, organizationId) {
    try {
      const updates = {
        isAdmin,
        role: isAdmin ? 'admin' : 'user',
        updatedAt: new Date()
      };

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, updates);

      if (organizationId) {
        const orgUserRef = doc(db, `organizations/${organizationId}/users/${userId}`);
        await updateDoc(orgUserRef, updates);
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  },

  // Update user profile
  async updateProfile(userId, profileData) {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        ...profileData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  // Remove user from organization
  async removeUser(userId) {
    try {
      const userRef = doc(db, 'users', userId);
      await deleteDoc(userRef);
    } catch (error) {
      console.error('Error removing user:', error);
      throw error;
    }
  },

  // Create invitation AND send email
  async createInvitation(organizationId, organizationName, email, role, invitedBy) {
    try {
      const invitationsRef = collection(db, `organizations/${organizationId}/invitations`);
      
      // Check if invitation already exists
      const existingQuery = query(invitationsRef, where('email', '==', email.toLowerCase()), where('status', '==', 'pending'));
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        throw new Error('An invitation already exists for this email');
      }
      
      // Create new invitation in Firestore
      const invitation = await addDoc(invitationsRef, {
        email: email.toLowerCase(),
        role: role || 'user',
        organizationId,
        organizationName,
        invitedBy,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });
      
      // Send invitation email via Netlify Function
      try {
        // Build the signup URL with invitation token
        const baseUrl = 'https://axle-finance.com';
        const signupUrl = `${baseUrl}/accept-invite?token=${invitation.id}&org=${organizationId}`;

        const response = await fetch('/.netlify/functions/send-invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: email.toLowerCase(),
            organizationName,
            invitedBy,
            role: role || 'user',
            signupUrl
          })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          console.error('Failed to send email:', result);
          // Update invitation to mark email as not sent
          await updateDoc(doc(db, `organizations/${organizationId}/invitations/${invitation.id}`), {
            emailSent: false,
            emailError: result.error || 'Failed to send'
          });
        } else {
          // Mark email as sent
          await updateDoc(doc(db, `organizations/${organizationId}/invitations/${invitation.id}`), {
            emailSent: true,
            emailSentAt: new Date()
          });
        }
      } catch (emailError) {
        console.error('Error calling email function:', emailError);
        // Don't throw - invitation is still created, just email failed
        await updateDoc(doc(db, `organizations/${organizationId}/invitations/${invitation.id}`), {
          emailSent: false,
          emailError: emailError.message
        });
      }
      
      return invitation.id;
    } catch (error) {
      console.error('Error creating invitation:', error);
      throw error;
    }
  },

  // Get pending invitations
  async getPendingInvitations(organizationId) {
    try {
      const invitationsRef = collection(db, `organizations/${organizationId}/invitations`);
      const q = query(invitationsRef, where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching invitations:', error);
      throw error;
    }
  },

  // Subscribe to pending invitations
  subscribeToInvitations(organizationId, callback) {
    const invitationsRef = collection(db, `organizations/${organizationId}/invitations`);
    const q = query(invitationsRef, where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const invitations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(invitations);
    }, (error) => {
      console.error('Error subscribing to invitations:', error);
      callback([]);
    });
  },

  // Cancel invitation
  async cancelInvitation(organizationId, invitationId) {
    try {
      const invitationRef = doc(db, `organizations/${organizationId}/invitations/${invitationId}`);
      await updateDoc(invitationRef, {
        status: 'cancelled',
        cancelledAt: new Date()
      });
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      throw error;
    }
  },

  // Get invitation by token (invitation ID)
  async getInvitationByToken(organizationId, invitationId) {
    try {
      const invitationRef = doc(db, `organizations/${organizationId}/invitations/${invitationId}`);
      const invitationDoc = await getDoc(invitationRef);

      if (!invitationDoc.exists()) {
        return null;
      }

      return {
        id: invitationDoc.id,
        ...invitationDoc.data()
      };
    } catch (error) {
      console.error('Error fetching invitation:', error);
      throw error;
    }
  },

  // Accept invitation (mark as accepted)
  async acceptInvitation(organizationId, invitationId) {
    try {
      const invitationRef = doc(db, `organizations/${organizationId}/invitations/${invitationId}`);
      await updateDoc(invitationRef, {
        status: 'accepted',
        acceptedAt: new Date()
      });
    } catch (error) {
      console.error('Error accepting invitation:', error);
      throw error;
    }
  },

  // Resend invitation (update expiry and resend email)
  async resendInvitation(organizationId, invitationId, invitationData) {
    try {
      const invitationRef = doc(db, `organizations/${organizationId}/invitations/${invitationId}`);
      
      // Update expiry
      await updateDoc(invitationRef, {
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        resentAt: new Date()
      });
      
      // Resend email if invitation data is provided
      if (invitationData) {
        try {
          // Build the signup URL with invitation token
          const baseUrl = 'https://axle-finance.com';
          const signupUrl = `${baseUrl}/accept-invite?token=${invitationId}&org=${organizationId}`;

          const response = await fetch('/.netlify/functions/send-invite', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: invitationData.email,
              organizationName: invitationData.organizationName,
              invitedBy: invitationData.invitedBy,
              role: invitationData.role,
              signupUrl
            })
          });
          
          if (!response.ok) {
            console.error('Failed to resend email');
          }
        } catch (emailError) {
          console.error('Error resending email:', emailError);
        }
      }
    } catch (error) {
      console.error('Error resending invitation:', error);
      throw error;
    }
  },

  // Get team activity log, enriched with member data
  async getActivityLog(organizationId, members = [], limit = 50) {
    try {
      const activitiesRef = collection(db, `organizations/${organizationId}/activities`);
      const q = query(activitiesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      // Build lookup: name -> member (for cross-referencing email)
      const memberByName = {};
      const memberByEmail = {};
      members.forEach(m => {
        if (m.name) memberByName[m.name.toLowerCase().trim()] = m;
        if (m.email) memberByEmail[m.email.toLowerCase().trim()] = m;
      });

      // Group activities by user
      const userActivities = {};
      snapshot.docs.slice(0, limit * 10).forEach(doc => {
        const data = doc.data();
        const rawCreator = data.createdBy || data.addedBy || 'Unknown';
        const userId = rawCreator.replace(/\s*\(AI Import\)\s*$/, '').trim();
        if (!userActivities[userId]) {
          // Try to find matching member by name or email
          const member = memberByName[userId.toLowerCase()] || memberByEmail[userId.toLowerCase()];
          userActivities[userId] = {
            email: member?.email || data.addedBy || '',
            name: member?.name || userId,
            count: 0,
            executedCount: 0,
            executedVolume: 0,
            lastActivity: null
          };
        }
        userActivities[userId].count++;
        if (data.status === 'EXECUTED') {
          userActivities[userId].executedCount++;
          userActivities[userId].executedVolume += parseFloat(data.size) || 0;
        }
        if (!userActivities[userId].lastActivity) {
          userActivities[userId].lastActivity = data.createdAt?.toDate();
        }
      });

      return Object.values(userActivities).sort((a, b) => b.executedVolume - a.executedVolume);
    } catch (error) {
      console.error('Error fetching activity log:', error);
      throw error;
    }
  }
};
