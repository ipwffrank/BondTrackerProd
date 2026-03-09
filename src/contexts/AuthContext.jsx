import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext({});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
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
          createdAt: serverTimestamp(),
          userCount: 1,
          adminCount: 1
        });
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
  // => https://www.axle-finance.com
  async function sendPasswordReset(email) {
    return sendPasswordResetEmail(auth, email);
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

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔵 Auth state changed:', user ? user.email : 'No user');

      // Clean up previous org doc listener when user changes
      if (orgUserUnsubscribe) {
        orgUserUnsubscribe();
        orgUserUnsubscribe = null;
      }

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
      unsubscribe();
    };
  }, []);

  // Context value
  const value = {
    currentUser,
    userData,
    isAdmin: userData?.isAdmin || false,
    signup,
    signupWithInvitation,
    login,
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
