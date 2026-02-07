import { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function signup(email, password, name, organizationName) {
    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Extract domain and create org ID
      const domain = email.split('@')[1];
      const orgId = `org_${domain.replace(/\./g, '_')}`;
      
      console.log('Creating user for org:', orgId);
      
      // Check if organization exists
      const orgRef = doc(db, 'organizations', orgId);
      const orgDoc = await getDoc(orgRef);
      const isFirstUser = !orgDoc.exists();
      
      console.log('Is first user from domain?', isFirstUser);
      
      // Create organization if it doesn't exist
      if (isFirstUser) {
        console.log('Creating new organization:', organizationName);
        await setDoc(orgRef, {
          name: organizationName,
          domain: domain,
          createdAt: serverTimestamp(),
          adminCount: 1,
          userCount: 1
        });
      } else {
        console.log('Organization exists, updating user count');
        // Update user count
        const currentData = orgDoc.data();
        await updateDoc(orgRef, {
          userCount: (currentData.userCount || 0) + 1
        });
      }
      
      // ✅ FIXED: Create user document in organizations/{orgId}/users/{userId}
      console.log('Creating user document with isAdmin:', isFirstUser);
      const userDocRef = doc(db, `organizations/${orgId}/users/${user.uid}`);
      await setDoc(userDocRef, {
        email: email,
        name: name,
        organizationId: orgId,
        organizationName: isFirstUser ? organizationName : orgDoc.data().name,
        isAdmin: isFirstUser,  // First user from domain = admin
        role: isFirstUser ? 'admin' : 'user',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
      
      console.log('User created successfully. Admin status:', isFirstUser);
      
      return user;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  }

  async function login(email, password) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // First, we need to find which organization this user belongs to
      // We'll get this from their email domain
      const domain = email.split('@')[1];
      const orgId = `org_${domain.replace(/\./g, '_')}`;
      
      // ✅ FIXED: Update last login in correct path
      const userDocRef = doc(db, `organizations/${orgId}/users/${result.user.uid}`);
      await setDoc(userDocRef, {
        lastLogin: serverTimestamp()
      }, { merge: true });
      
      return result;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async function logout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed. User:', user?.email);
      setCurrentUser(user);
      
      if (user) {
        try {
          // Get organization ID from email domain
          const domain = user.email.split('@')[1];
          const orgId = `org_${domain.replace(/\./g, '_')}`;
          
          // ✅ FIXED: Read from correct path
          const userDocRef = doc(db, `organizations/${orgId}/users/${user.uid}`);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            console.log('User data loaded. isAdmin:', data.isAdmin);
            setUserData(data);
          } else {
            console.error('User document not found in Firestore at path:', `organizations/${orgId}/users/${user.uid}`);
            setUserData(null);
          }
        } catch (error) {
          console.error('Error loading user data:', error);
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });
    
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
    signup,
    login,
    logout,
    isAdmin: userData?.isAdmin || false,
    organizationId: userData?.organizationId || null
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
