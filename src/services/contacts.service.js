import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

const contactsPath = (orgId, clientId) =>
  `organizations/${orgId}/clients/${clientId}/contacts`;

export function subscribeContacts(orgId, clientId, callback) {
  const q = query(collection(db, contactsPath(orgId, clientId)), orderBy('name', 'asc'));
  return onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function addContact(orgId, clientId, data) {
  await addDoc(collection(db, contactsPath(orgId, clientId)), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateContact(orgId, clientId, contactId, data) {
  await updateDoc(doc(db, contactsPath(orgId, clientId), contactId), data);
}

export async function deleteContact(orgId, clientId, contactId) {
  await deleteDoc(doc(db, contactsPath(orgId, clientId), contactId));
}
