import { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    const domain = email.split('@')[1];
    const orgId = `org_${domain.replace(/\./g, '_')}`;
    
    const orgRef = doc(db, 'organizations', orgId);
    const orgDoc = await getDoc(orgRef);
    const isFirstUser = !orgDoc.exists();
    
    if (isFirstUser) {
      await setDoc(orgRef, {
        name: organizationName,
        domain: domain,
        createdAt: serverTimestamp(),
        adminCount: 1
      });
    }
    
    await setDoc(doc(db, 'users', user.uid), {
      email: email,
      name: name,
      organizationId: orgId,
      organizationName: isFirstUser ? organizationName : orgDoc.data().name,
      isAdmin: isFirstUser,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
    
    return user;
  }

  async function login(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', result.user.uid), {
      lastLogin: serverTimestamp()
    }, { merge: true });
    return result;
  }

  async function logout() {
    await signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
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
