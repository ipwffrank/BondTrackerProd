import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export const pipelineService = {
  // Subscribe to pipeline issues in real-time
  subscribe(organizationId, callback) {
    const pipelineRef = collection(db, `organizations/${organizationId}/pipeline`);
    const q = query(pipelineRef, orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const issues = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(issues);
    });
  },

  // Add new issue
  async add(organizationId, issueData) {
    const pipelineRef = collection(db, `organizations/${organizationId}/pipeline`);
    return await addDoc(pipelineRef, {
      ...issueData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  },

  // Update issue
  async update(organizationId, issueId, issueData) {
    const issueRef = doc(db, `organizations/${organizationId}/pipeline/${issueId}`);
    return await updateDoc(issueRef, {
      ...issueData,
      updatedAt: new Date()
    });
  },

  // Delete issue
  async delete(organizationId, issueId) {
    const issueRef = doc(db, `organizations/${organizationId}/pipeline/${issueId}`);
    return await deleteDoc(issueRef);
  }
};
