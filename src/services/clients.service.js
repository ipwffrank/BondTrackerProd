import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export const clientsService = {
  // Subscribe to clients in real-time
  subscribe(organizationId, callback) {
    const clientsRef = collection(db, `organizations/${organizationId}/clients`);
    const q = query(clientsRef, orderBy('name', 'asc'));

    return onSnapshot(q, (snapshot) => {
      const clients = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(clients);
    });
  },

  // Add new client
  async add(organizationId, clientData) {
    const clientsRef = collection(db, `organizations/${organizationId}/clients`);
    return await addDoc(clientsRef, {
      ...clientData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  // Update client
  async update(organizationId, clientId, clientData) {
    const clientRef = doc(db, `organizations/${organizationId}/clients/${clientId}`);
    return await updateDoc(clientRef, {
      ...clientData,
      updatedAt: serverTimestamp()
    });
  },

  // Delete client
  async delete(organizationId, clientId) {
    const clientRef = doc(db, `organizations/${organizationId}/clients/${clientId}`);
    return await deleteDoc(clientRef);
  }
};
