import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  SAMLAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const TIER_DEFAULTS = {
  essential: 5,
  essentials: 5,
  growth: 8,
  professional: 15,
};

const AuthContext = createContext({});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [orgPlan, setOrgPlan] = useState('essential'); // subscription tier
  const [orgMaxUsers, setOrgMaxUsers] = useState(null);
  const [loading, setLoading] = useState(true);

  // Signup function
  async function signup(email, password, name) {
    try {
      console.log('🔵 Starting signup for:', email);
      
      // Create Firebase auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Get organization ID from email domain
      const domain = email.split('@')[1];
      const orgId = `org_${domain.replace(/\./g, '_')}`;
      
      console.log('🔵 Organization ID:', orgId);

      // Check if organization exists
      const orgRef = doc(db, `organizations/${orgId}`);
      const orgDoc = await getDoc(orgRef);
      const isFirstUser = !orgDoc.exists();

      // Create organization if it doesn't exist
      if (isFirstUser) {
        console.log('🔵 Creating new organization:', orgId);
        await setDoc(orgRef, {
          name: domain,
          domain: domain,
          plan: 'essentials',
          createdAt: serverTimestamp(),
          userCount: 1,
          adminCount: 1
        });
      }

      // Check seat limit for existing orgs (first user of a new org is always allowed)
      if (!isFirstUser) {
        const hasCapacity = await checkOrgSeatLimit(orgId);
        if (!hasCapacity) {
          // Delete the Firebase auth user we just created since they can't join
          await user.delete();
          throw new Error('This organization has reached its maximum number of users. Please contact your organization admin.');
        }
      }

      // Create user document
      const userRef = doc(db, `organizations/${orgId}/users/${user.uid}`);
      console.log('🔵 Creating user document at:', `organizations/${orgId}/users/${user.uid}`);
      
      await setDoc(userRef, {
        email: email,
        name: name,
        organizationId: orgId,
        organizationName: domain,
        isAdmin: isFirstUser,
        role: isFirstUser ? 'admin' : 'user',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });

      // Create a root-level user document (required for Firestore security rules)
      const userMappingRef = doc(db, `users/${user.uid}`);
      await setDoc(userMappingRef, {
        organizationId: orgId,
        email: email,
        name: name,
        isAdmin: isFirstUser,
        role: isFirstUser ? 'admin' : 'user',
        createdAt: serverTimestamp()
      });

      console.log('✅ User created successfully. Admin status:', isFirstUser);

      return userCredential;
    } catch (error) {
      console.error('❌ Signup error:', error);
      throw error;
    }
  }

  // Signup with invitation - joins an existing organization
  async function signupWithInvitation(email, password, name, organizationId, organizationName, role) {
    try {
      console.log('🔵 Starting signup with invitation for:', email);
      console.log('🔵 Joining organization:', organizationId);

      // Create Firebase auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user document in the invited organization
      const userRef = doc(db, `organizations/${organizationId}/users/${user.uid}`);
      console.log('🔵 Creating user document at:', `organizations/${organizationId}/users/${user.uid}`);

      const isAdmin = role === 'admin';

      await setDoc(userRef, {
        email: email,
        name: name,
        organizationId: organizationId,
        organizationName: organizationName,
        isAdmin: isAdmin,
        role: role || 'user',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        invitedUser: true
      });

      // Create a root-level user document (required for Firestore security rules)
      const userMappingRef = doc(db, `users/${user.uid}`);
      await setDoc(userMappingRef, {
        organizationId: organizationId,
        email: email,
        name: name,
        isAdmin: isAdmin,
        role: role || 'user',
        createdAt: serverTimestamp()
      });

      console.log('✅ Invited user created successfully. Admin status:', isAdmin);

      return userCredential;
    } catch (error) {
      console.error('❌ Signup with invitation error:', error);
      throw error;
    }
  }

  // Login function
  async function login(email, password) {
    try {
      console.log('🔵 Logging in:', email);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Try to update last login (non-blocking - don't fail login if this fails)
      try {
        // First check user mapping for correct org
        const userMappingRef = doc(db, `users/${user.uid}`);
        const userMappingSnap = await getDoc(userMappingRef);

        const domain = email.split('@')[1];
        let orgId = `org_${domain.replace(/\./g, '_')}`;
        if (userMappingSnap.exists() && userMappingSnap.data().organizationId) {
          orgId = userMappingSnap.data().organizationId;
        }

        const userRef = doc(db, `organizations/${orgId}/users/${user.uid}`);
        await setDoc(userRef, {
          lastLogin: serverTimestamp()
        }, { merge: true });
      } catch (updateError) {
        console.warn('⚠️ Could not update lastLogin:', updateError.message);
        // Don't fail the login - the auth state listener will handle user data
      }

      console.log('✅ Login successful');
      return userCredential;
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  }

  // Password reset — Firebase sends email; custom action URL set in Firebase Console
  // Authentication > Email Templates > Password reset > Customize action URL
  // => https://axle-finance.com
  async function sendPasswordReset(email) {
    return sendPasswordResetEmail(auth, email);
  }

  async function checkOrgSeatLimit(orgId) {
    const orgSnap = await getDoc(doc(db, `organizations/${orgId}`));
    if (!orgSnap.exists()) return true; // new org, allow
    const orgData = orgSnap.data();
    const maxUsers = orgData.maxUsers || TIER_DEFAULTS[orgData.plan] || TIER_DEFAULTS.essential;

    const usersRef = collection(db, 'users');
    const usersQuery = query(usersRef, where('organizationId', '==', orgId));
    const usersSnap = await getDocs(usersQuery);

    const invitationsRef = collection(db, `organizations/${orgId}/invitations`);
    const pendingQuery = query(invitationsRef, where('status', '==', 'pending'));
    const pendingSnap = await getDocs(pendingQuery);

    return (usersSnap.size + pendingSnap.size) < maxUsers;
  }

  // Look up SSO provider for an email domain by querying organizations with ssoEnabled
  async function getSsoProviderForEmail(email) {
    const domain = email.split('@')[1];
    if (!domain) return null;
    try {
      // Check domain-derived org first
      const orgId = `org_${domain.replace(/\./g, '_')}`;
      const orgSnap = await getDoc(doc(db, `organizations/${orgId}`));
      if (orgSnap.exists() && orgSnap.data().ssoEnabled && orgSnap.data().samlProviderId) {
        return { orgId, providerId: orgSnap.data().samlProviderId, orgName: orgSnap.data().name };
      }
      // Fallback: search orgs by allowedDomains array
      const q = query(collection(db, 'organizations'), where('ssoEnabled', '==', true), where('allowedDomains', 'array-contains', domain));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const orgDoc = snap.docs[0];
        return { orgId: orgDoc.id, providerId: orgDoc.data().samlProviderId, orgName: orgDoc.data().name };
      }
      return null;
    } catch (err) {
      console.error('SSO lookup error:', err);
      return null;
    }
  }

  // SSO/SAML sign-in with JIT user provisioning
  async function loginWithSso(email) {
    const ssoInfo = await getSsoProviderForEmail(email);
    if (!ssoInfo) throw new Error('SSO is not configured for this email domain.');

    const provider = new SAMLAuthProvider(ssoInfo.providerId);
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // JIT provisioning: create user docs if they don't exist
    const userMappingRef = doc(db, `users/${user.uid}`);
    const userMappingSnap = await getDoc(userMappingRef);

    if (!userMappingSnap.exists()) {
      // Check seat limit before JIT provisioning
      const hasCapacity = await checkOrgSeatLimit(ssoInfo.orgId);
      if (!hasCapacity) {
        // Sign out the SSO user since they can't be provisioned
        await signOut(auth);
        throw new Error('This organization has reached its maximum number of users. Please contact your organization admin or email info@axle-finance.com to enable more users.');
      }

      const displayName = user.displayName || email.split('@')[0];
      const userDocData = {
        email: user.email || email,
        name: displayName,
        organizationId: ssoInfo.orgId,
        organizationName: ssoInfo.orgName,
        isAdmin: false,
        role: 'user',
        ssoUser: true,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      };

      await setDoc(doc(db, `organizations/${ssoInfo.orgId}/users/${user.uid}`), userDocData);
      await setDoc(userMappingRef, {
        organizationId: ssoInfo.orgId,
        email: user.email || email,
        name: displayName,
        isAdmin: false,
        role: 'user',
        ssoUser: true,
        createdAt: serverTimestamp(),
      });
    } else {
      // Existing user — update lastLogin
      await setDoc(doc(db, `organizations/${ssoInfo.orgId}/users/${user.uid}`), {
        lastLogin: serverTimestamp(),
      }, { merge: true });
    }

    return result;
  }

  // Logout function
  async function logout() {
    try {
      await signOut(auth);
      setUserData(null);
      setCurrentUser(null);
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
      throw error;
    }
  }

  // Listen to auth state changes and load user data
  useEffect(() => {
    console.log('🔵 Setting up auth state listener');

    let orgUserUnsubscribe = null;
    let orgDocUnsubscribe = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔵 Auth state changed:', user ? user.email : 'No user');

      // Clean up previous listeners when user changes
      if (orgUserUnsubscribe) { orgUserUnsubscribe(); orgUserUnsubscribe = null; }
      if (orgDocUnsubscribe) { orgDocUnsubscribe(); orgDocUnsubscribe = null; }

      setCurrentUser(user);

      if (user) {
        try {
          // Derive organization ID from email domain
          const domain = user.email.split('@')[1];
          let orgId = `org_${domain.replace(/\./g, '_')}`;

          // Check if there's a user mapping (for invited users with different email domains)
          const userMappingRef = doc(db, `users/${user.uid}`);
          const userMappingSnap = await getDoc(userMappingRef);

          if (userMappingSnap.exists() && userMappingSnap.data().organizationId) {
            orgId = userMappingSnap.data().organizationId;
            console.log('🔍 Found user mapping, using organization:', orgId);
          } else {
            console.log('🔍 No valid user mapping found, using domain-derived org:', orgId);
          }

          // Subscribe to the org document for plan/tier updates
          const orgDocRef = doc(db, `organizations/${orgId}`);
          orgDocUnsubscribe = onSnapshot(orgDocRef, (orgSnap) => {
            if (orgSnap.exists()) {
              const data = orgSnap.data();
              setOrgPlan(data.plan || 'essential');
              setOrgMaxUsers(data.maxUsers || TIER_DEFAULTS[data.plan] || TIER_DEFAULTS.essential);
            }
          }, (err) => console.warn('Org doc listener error:', err));

          console.log('🔍 Subscribing to user data at:', `organizations/${orgId}/users/${user.uid}`);

          // Subscribe to the org user doc so role changes reflect immediately without re-login
          const userDocRef = doc(db, `organizations/${orgId}/users/${user.uid}`);
          let isFirstSnapshot = true;

          let retryCount = 0;
          const MAX_RETRIES = 3;
          const RETRY_DELAY = 1500; // ms

          orgUserUnsubscribe = onSnapshot(userDocRef, async (userDocSnap) => {
            if (userDocSnap.exists()) {
              retryCount = 0; // reset on success
              const data = userDocSnap.data();

              const completeUserData = {
                uid: user.uid,
                email: user.email,
                name: data.name || user.displayName || user.email,
                organizationId: orgId,
                organizationName: data.organizationName || domain,
                isAdmin: data.isAdmin || false,
                role: data.role || 'user',
                createdAt: data.createdAt,
                lastLogin: data.lastLogin
              };

              // Create user mapping on first load if it doesn't exist
              if (isFirstSnapshot && !userMappingSnap.exists()) {
                console.log('🔵 Creating user mapping for existing user');
                try {
                  await setDoc(userMappingRef, {
                    organizationId: orgId,
                    email: user.email,
                    name: completeUserData.name,
                    isAdmin: completeUserData.isAdmin,
                    role: completeUserData.role,
                    createdAt: serverTimestamp()
                  });
                  console.log('✅ User mapping created successfully');
                } catch (mappingError) {
                  console.error('⚠️ Failed to create user mapping:', mappingError);
                }
              }
              isFirstSnapshot = false;

              console.log('✅ User data updated:', {
                email: completeUserData.email,
                organizationId: completeUserData.organizationId,
                isAdmin: completeUserData.isAdmin
              });

              setUserData(completeUserData);
              setLoading(false);
            } else {
              console.warn('⚠️ User document not found in snapshot, trying getDoc fallback...');
              try {
                const freshSnap = await getDoc(userDocRef);
                if (freshSnap.exists()) {
                  const data = freshSnap.data();
                  setUserData({
                    uid: user.uid,
                    email: user.email,
                    name: data.name || user.displayName || user.email,
                    organizationId: orgId,
                    organizationName: data.organizationName || domain,
                    isAdmin: data.isAdmin || false,
                    role: data.role || 'user',
                    createdAt: data.createdAt,
                    lastLogin: data.lastLogin
                  });
                  console.log('✅ User data loaded via getDoc fallback');
                  setLoading(false);
                } else if (retryCount < MAX_RETRIES) {
                  // Document may not exist yet (signup race condition) — retry after delay
                  retryCount++;
                  console.warn(`⏳ User doc not found, retrying (${retryCount}/${MAX_RETRIES}) in ${RETRY_DELAY}ms...`);
                  setTimeout(async () => {
                    try {
                      const retrySnap = await getDoc(userDocRef);
                      if (retrySnap.exists()) {
                        const data = retrySnap.data();
                        setUserData({
                          uid: user.uid,
                          email: user.email,
                          name: data.name || user.displayName || user.email,
                          organizationId: orgId,
                          organizationName: data.organizationName || domain,
                          isAdmin: data.isAdmin || false,
                          role: data.role || 'user',
                          createdAt: data.createdAt,
                          lastLogin: data.lastLogin
                        });
                        console.log('✅ User data loaded on retry');
                      } else {
                        console.warn(`⚠️ Retry ${retryCount}/${MAX_RETRIES}: doc still not found`);
                      }
                    } catch (retryError) {
                      console.error('❌ Retry getDoc failed:', retryError);
                    }
                    setLoading(false);
                  }, RETRY_DELAY);
                } else {
                  console.error('❌ User document not found after retries at:', `organizations/${orgId}/users/${user.uid}`);
                  // Do NOT clear userData if we already have valid data for this user
                  setUserData((prev) => (prev?.uid === user.uid ? prev : null));
                  setLoading(false);
                }
              } catch (fallbackError) {
                console.error('❌ getDoc fallback failed:', fallbackError);
                // Preserve existing userData if it belongs to the current user
                setUserData((prev) => (prev?.uid === user.uid ? prev : null));
                setLoading(false);
              }
            }
          }, (error) => {
            console.error('❌ Error in user doc snapshot (keeping last known userData):', error);
            // Do NOT clear userData on connection errors — keep the last known value
            // so forms remain functional during transient Firestore issues.
            setLoading(false);
          });

        } catch (error) {
          console.error('❌ Error loading user data:', error);
          setUserData(null);
          setLoading(false);
        }
      } else {
        console.log('🔵 No user logged in, clearing user data');
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      console.log('🔵 Cleaning up auth state listener');
      if (orgUserUnsubscribe) orgUserUnsubscribe();
      if (orgDocUnsubscribe) orgDocUnsubscribe();
      unsubscribe();
    };
  }, []);

  // Context value
  const value = {
    currentUser,
    userData,
    isAdmin: userData?.isAdmin || false,
    orgPlan,
    orgMaxUsers,
    signup,
    signupWithInvitation,
    login,
    loginWithSso,
    getSsoProviderForEmail,
    logout,
    sendPasswordReset,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
