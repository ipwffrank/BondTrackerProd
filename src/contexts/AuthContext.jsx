import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
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
      
      console.log('✅ User created successfully. Admin status:', isFirstUser);
      
      return userCredential;
    } catch (error) {
      console.error('❌ Signup error:', error);
      throw error;
    }
  }

  // Login function
  async function login(email, password) {
    try {
      console.log('🔵 Logging in:', email);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Get organization ID from email domain
      const domain = email.split('@')[1];
      const orgId = `org_${domain.replace(/\./g, '_')}`;

      // Update last login
      const userRef = doc(db, `organizations/${orgId}/users/${user.uid}`);
      await setDoc(userRef, {
        lastLogin: serverTimestamp()
      }, { merge: true });

      console.log('✅ Login successful');
      return userCredential;
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
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
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔵 Auth state changed:', user ? user.email : 'No user');
      setCurrentUser(user);
      
      if (user) {
        try {
          // Derive organization ID from email domain
          const domain = user.email.split('@')[1];
          const orgId = `org_${domain.replace(/\./g, '_')}`;
          
          console.log('🔍 Loading user data from:', `organizations/${orgId}/users/${user.uid}`);
          
          // Get user document from Firestore
          const userDocRef = doc(db, `organizations/${orgId}/users/${user.uid}`);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            
            // Build complete user data object
            const completeUserData = {
              uid: user.uid,
              email: user.email,
              name: data.name || user.displayName || user.email,
              organizationId: orgId,  // CRITICAL: Always set from email domain
              organizationName: data.organizationName || domain,
              isAdmin: data.isAdmin || false,
              role: data.role || 'user',
              createdAt: data.createdAt,
              lastLogin: data.lastLogin
            };
            
            console.log('✅ User data loaded successfully:', {
              email: completeUserData.email,
              organizationId: completeUserData.organizationId,
              isAdmin: completeUserData.isAdmin
            });
            
            setUserData(completeUserData);
          } else {
            console.error('❌ User document not found at:', `organizations/${orgId}/users/${user.uid}`);
            console.error('❌ Please check Firestore to ensure the document exists');
            setUserData(null);
          }
        } catch (error) {
          console.error('❌ Error loading user data:', error);
          setUserData(null);
        }
      } else {
        console.log('🔵 No user logged in, clearing user data');
        setUserData(null);
      }
      
      setLoading(false);
    });

    return () => {
      console.log('🔵 Cleaning up auth state listener');
      unsubscribe();
    };
  }, []);

  // Context value
  const value = {
    currentUser,
    userData,
    isAdmin: userData?.isAdmin || false,
    signup,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
