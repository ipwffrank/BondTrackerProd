import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { collection, query, onSnapshot, addDoc, updateDoc, serverTimestamp, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';
import { logAudit } from '../services/audit.service';
import { findSimilarClients } from '../utils/clientDedup';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'HKD', 'SGD', 'CNH'];
const TENOR_OPTIONS = ['2Y', '3Y', '5Y', '7Y', '10Y', '15Y', '20Y', '30Y'];
const CLIENT_TYPES = ['FUND', 'HEDGE FUND', 'BANK', 'CENTRAL BANK', 'INSURANCE', 'PENSION', 'SOVEREIGN', 'CORPORATE', 'PRIVATE BANK', 'FAMILY OFFICE'];
const CLIENT_REGIONS = ['APAC', 'EMEA', 'AMERICAS'];

const DEAL_STATUS_OPTIONS = ['MANDATE', 'ANNOUNCED', 'BOOKS_OPEN', 'PRICED', 'ALLOCATED', 'CLOSED', 'PULLED'];
const DEAL_STATUS_COLORS = {
  MANDATE:   { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  ANNOUNCED: { color: '#93c5fd', bg: 'rgba(147,197,253,0.12)' },
  BOOKS_OPEN:{ color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  PRICED:    { color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  ALLOCATED: { color: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
  CLOSED:    { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  PULLED:    { color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

const EMPTY_TRANCHE = { tenor: '', currency: 'USD', targetSize: '', internalTargetSize: '', ipt: '', guidance: '', finalSpread: '', pricingDate: '' };
const BOOKRUNNER_OPTIONS = ['ANZ', 'Bank of China', 'BNP', 'DBS', 'Deutsche Bank', 'HSBC', 'ICBC', 'J.P. Morgan', 'Morgan Stanley', 'Standard Chartered'];
const EMPTY_NEW_ISSUE_FORM = {
  issuerName: '',
  dealStatus: 'MANDATE',
  bookrunners: Object.fromEntries([...BOOKRUNNER_OPTIONS, 'other'].map(k => [k, false])),
  otherBookrunner: '',
  tranches: [{ ...EMPTY_TRANCHE }]
};
const EMPTY_ORDER_FORM = { issueId: '', trancheId: '', clientName: '', orderSize: '', orderLimit: '', notes: '' };
const EMPTY_CLIENT_FORM = { name: '', type: 'FUND', region: 'APAC', salesCoverage: '' };
const FEEDBACK_SENTIMENTS = ['INTERESTED', 'MONITORING', 'PASS', 'UNDECIDED'];
const FEEDBACK_SENTIMENT_COLORS = {
  INTERESTED: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  MONITORING: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  PASS:       { color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  UNDECIDED:  { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
};
const EMPTY_FEEDBACK_FORM = { clientName: '', sentiment: 'INTERESTED', comment: '', trancheId: '' };

export default function Pipeline() {
  const { userData, currentUser, isAdmin } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState('create');
  const [newIssueForm, setNewIssueForm] = useState({ ...EMPTY_NEW_ISSUE_FORM, tranches: [{ ...EMPTY_TRANCHE }] });
  const [orderBookForm, setOrderBookForm] = useState({ ...EMPTY_ORDER_FORM });
  const [newIssues, setNewIssues] = useState([]);
  const [orderBooks, setOrderBooks] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [issueSearch, setIssueSearch] = useState('');
  const [filterIssueCurrency, setFilterIssueCurrency] = useState('');
  const [selectedIssueIds, setSelectedIssueIds] = useState(new Set());
  const [expandedIssueIds, setExpandedIssueIds] = useState(new Set());
  const [editingIssue, setEditingIssue] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editOrderForm, setEditOrderForm] = useState({ ...EMPTY_ORDER_FORM });

  // New Issues column filters
  const [issueColFilters, setIssueColFilters] = useState({ date:'', issuer:'', tranches:'', bookrunners:'', createdBy:'' });

  // Order book filters
  const [orderFilters, setOrderFilters] = useState({ date: '', issuerName: '', trancheTenor: '', trancheCurrency: '', clientName: '', orderSize: '', orderLimit: '', notes: '', feedback: '', createdBy: '' });

  // Edit issue modal
  const [showEditIssueModal, setShowEditIssueModal] = useState(false);
  const [editIssueForm, setEditIssueForm] = useState({ ...EMPTY_NEW_ISSUE_FORM, tranches: [{ ...EMPTY_TRANCHE }] });

  // Dedup state
  const [dedupMatches, setDedupMatches] = useState([]);
  const [showDedupModal, setShowDedupModal] = useState(false);
  const [pendingIssueData, setPendingIssueData] = useState(null);

  // Add new client from order book
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ ...EMPTY_CLIENT_FORM });
  const [addClientLoading, setAddClientLoading] = useState(false);
  const [addClientError, setAddClientError] = useState('');

  // Dedup for new client in order book
  const [clientDedupMatches, setClientDedupMatches] = useState([]);
  const [showClientDedupModal, setShowClientDedupModal] = useState(false);
  const [pendingClientData, setPendingClientData] = useState(null);

  // Client Feedback state
  const [clientFeedback, setClientFeedback] = useState([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState(null); // { issueId, issueName, trancheId?, trancheTenor?, trancheCurrency? }
  const [feedbackForm, setFeedbackForm] = useState({ ...EMPTY_FEEDBACK_FORM });
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  // Bookrunner dedup state
  const [bookrunnerDedupData, setBookrunnerDedupData] = useState(null); // { entries: [{ input, editedName, matches }], formData }
  const [showBookrunnerDedupModal, setShowBookrunnerDedupModal] = useState(false);

  // Delete confirm + notification toast
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, type, label }
  const [notification, setNotification] = useState(null);
  React.useEffect(() => { if (notification) { const t = setTimeout(() => setNotification(null), 3000); return () => clearTimeout(t); } }, [notification]);

  useEffect(() => {
    if (!userData?.organizationId) { setLoading(false); return; }
    const unsubscribes = [];
    try {
      // New Issues (tranches stored as array field in each document)
      const newIssuesRef = collection(db, `organizations/${userData.organizationId}/newIssues`);
      const newIssuesQuery = query(newIssuesRef, orderBy('createdAt', 'desc'));
      const newIssuesUnsub = onSnapshot(newIssuesQuery, (snapshot) => {
        const issues = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          const tranches = (data.tranches || []).map((t, idx) => ({ id: `t-${idx}`, ...t }));
          return { id: docSnap.id, ...data, tranches, createdAt: data.createdAt?.toDate() };
        });
        setNewIssues(issues);
        setLoading(false);
      }, (error) => { console.error('Error loading new issues:', error); setLoading(false); });
      unsubscribes.push(newIssuesUnsub);

      const orderBooksRef = collection(db, `organizations/${userData.organizationId}/orderBooks`);
      const orderBooksQuery = query(orderBooksRef, orderBy('createdAt', 'desc'));
      const orderBooksUnsub = onSnapshot(orderBooksQuery, (snapshot) => {
        setOrderBooks(snapshot.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() })));
      }, (error) => { console.error('Error loading order books:', error); });
      unsubscribes.push(orderBooksUnsub);

      const clientsRef = collection(db, `organizations/${userData.organizationId}/clients`);
      const clientsUnsub = onSnapshot(clientsRef, (snapshot) => {
        setClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => { console.error('Error loading clients:', error); });
      unsubscribes.push(clientsUnsub);

      // Client Feedback
      const feedbackRef = collection(db, `organizations/${userData.organizationId}/clientFeedback`);
      const feedbackQuery = query(feedbackRef, orderBy('createdAt', 'desc'));
      const feedbackUnsub = onSnapshot(feedbackQuery, (snapshot) => {
        setClientFeedback(snapshot.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() })));
      }, (error) => { console.error('Error loading client feedback:', error); });
      unsubscribes.push(feedbackUnsub);
    } catch (error) { console.error('Setup error:', error); setLoading(false); }
    return () => unsubscribes.forEach(unsub => unsub());
  }, [userData?.organizationId]);

  // ============ ISSUER DEDUP ============
  function findSimilarIssuers(name) {
    if (!name || !newIssues.length) return [];
    const issuersAsClients = newIssues.map(i => ({ id: i.id, name: i.issuerName }));
    return findSimilarClients(name, issuersAsClients);
  }

  // ============ BOOKRUNNER DEDUP ============
  function getAllPreviousOtherBookrunners() {
    const presetSet = new Set(BOOKRUNNER_OPTIONS);
    const used = new Set();
    for (const issue of newIssues) {
      for (const br of (issue.bookrunners || [])) {
        if (!presetSet.has(br) && br !== 'other') used.add(br);
      }
    }
    return [...used];
  }

  function checkBookrunnerDedup(otherNames) {
    const previousOthers = getAllPreviousOtherBookrunners();
    if (!previousOthers.length) return [];
    const asClients = previousOthers.map((name, i) => ({ id: String(i), name }));
    const results = [];
    for (const name of otherNames) {
      const similar = findSimilarClients(name, asClients);
      if (similar.length > 0) {
        results.push({ input: name, editedName: name, matches: similar });
      }
    }
    return results;
  }

  function confirmBookrunnerDedup() {
    if (!bookrunnerDedupData) return;
    const formData = { ...bookrunnerDedupData.formData };
    // Replace original other names with edited names
    const editedNames = bookrunnerDedupData.entries.map(e => e.editedName.trim()).filter(Boolean);
    const originalOthers = formData.otherBookrunner.split(',').map(s => s.trim()).filter(Boolean);
    const dedupInputs = new Set(bookrunnerDedupData.entries.map(e => e.input));
    const unchanged = originalOthers.filter(n => !dedupInputs.has(n));
    formData.otherBookrunner = [...unchanged, ...editedNames].join(', ');
    setShowBookrunnerDedupModal(false);
    setBookrunnerDedupData(null);
    saveIssue(formData);
  }

  // ============ TRANCHES FORM HELPERS ============
  function addTranche() {
    setNewIssueForm(prev => ({ ...prev, tranches: [...prev.tranches, { ...EMPTY_TRANCHE }] }));
  }
  function removeTranche(idx) {
    setNewIssueForm(prev => ({ ...prev, tranches: prev.tranches.filter((_, i) => i !== idx) }));
  }
  function updateTranche(idx, field, value) {
    setNewIssueForm(prev => {
      const tranches = [...prev.tranches];
      tranches[idx] = { ...tranches[idx], [field]: value };
      return { ...prev, tranches };
    });
  }

  // ============ NEW ISSUE SUBMIT ============
  async function handleNewIssueSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!isAdmin) { setFormError('Only org admins can create new issues.'); return; }
    const missing = [];
    if (!newIssueForm.issuerName) missing.push('Issuer');
    if (newIssueForm.tranches.length === 0) missing.push('At least one tranche');
    for (let i = 0; i < newIssueForm.tranches.length; i++) {
      const t = newIssueForm.tranches[i];
      if (!t.tenor) missing.push(`Tranche ${i + 1}: Tenor`);
      if (!t.targetSize) missing.push(`Tranche ${i + 1}: Target Size`);
    }
    if (missing.length) { setFormError(`Please fill in: ${missing.join(', ')}`); return; }
    if (!userData?.organizationId) {
      setFormError(currentUser ? 'Session loading -- please wait a moment and try again.' : 'Not connected -- please refresh the page.');
      return;
    }

    // Dedup check (skip when editing)
    if (!editingIssue) {
      const similar = findSimilarIssuers(newIssueForm.issuerName);
      if (similar.length > 0) {
        setDedupMatches(similar);
        setPendingIssueData(newIssueForm);
        setShowDedupModal(true);
        return;
      }
    }

    // Bookrunner dedup check for "other" names
    if (newIssueForm.bookrunners.other && newIssueForm.otherBookrunner) {
      const otherNames = newIssueForm.otherBookrunner.split(',').map(s => s.trim()).filter(Boolean);
      const brDedupResults = checkBookrunnerDedup(otherNames);
      if (brDedupResults.length > 0) {
        setBookrunnerDedupData({ entries: brDedupResults, formData: newIssueForm });
        setShowBookrunnerDedupModal(true);
        return;
      }
    }

    await saveIssue(newIssueForm);
  }

  async function saveIssue(formData) {
    setSubmitLoading(true);
    try {
      const selectedBookrunners = Object.entries(formData.bookrunners)
        .filter(([, value]) => value)
        .filter(([key]) => key !== 'other')
        .map(([key]) => key);
      if (formData.bookrunners.other && formData.otherBookrunner) {
        const others = formData.otherBookrunner.split(',').map(s => s.trim()).filter(Boolean);
        selectedBookrunners.push(...others);
      }

      const tranchesData = formData.tranches.map(t => ({
        tenor: t.tenor,
        currency: t.currency,
        targetSize: parseFloat(t.targetSize) || 0,
        internalTargetSize: parseFloat(t.internalTargetSize) || 0,
        ipt: t.ipt || '',
        guidance: t.guidance || '',
        finalSpread: t.finalSpread || '',
        pricingDate: t.pricingDate || '',
      }));

      if (editingIssue) {
        const issueRef = doc(db, `organizations/${userData.organizationId}/newIssues`, editingIssue);
        await updateDoc(issueRef, {
          issuerName: formData.issuerName,
          dealStatus: formData.dealStatus || 'MANDATE',
          bookrunners: selectedBookrunners,
          tranches: tranchesData,
          updatedAt: serverTimestamp(),
          updatedBy: userData.name || userData.email
        });
        setEditingIssue(null);
      } else {
        const newIssuesRef = collection(db, `organizations/${userData.organizationId}/newIssues`);
        await addDoc(newIssuesRef, {
          issuerName: formData.issuerName,
          dealStatus: formData.dealStatus || 'MANDATE',
          bookrunners: selectedBookrunners,
          tranches: tranchesData,
          createdAt: serverTimestamp(),
          createdBy: userData.name || userData.email
        });
      }

      setFormError('');
      setNewIssueForm({ ...EMPTY_NEW_ISSUE_FORM, tranches: [{ ...EMPTY_TRANCHE }] });
    } catch (error) {
      console.error('Error saving new issue:', error);
      setNotification('Failed to save new issue. Please try again.');
    } finally { setSubmitLoading(false); }
  }

  function confirmAddDespiteDupes() {
    setShowDedupModal(false);
    if (pendingIssueData) saveIssue(pendingIssueData);
    setPendingIssueData(null);
    setDedupMatches([]);
  }

  function cancelDedupAdd() {
    setShowDedupModal(false);
    setPendingIssueData(null);
    setDedupMatches([]);
  }

  function handleEditIssue(issue) {
    if (!isAdmin) return;
    const bookrunners = { JPM: false, GS: false, MS: false, HSBC: false, SCB: false, BOCHK: false, other: false };
    let otherBookrunner = '';
    (issue.bookrunners || []).forEach(b => {
      if (bookrunners.hasOwnProperty(b)) bookrunners[b] = true;
      else { bookrunners.other = true; otherBookrunner = b; }
    });
    const tranches = (issue.tranches || []).map(t => ({ tenor: t.tenor, currency: t.currency, targetSize: String(t.targetSize), internalTargetSize: String(t.internalTargetSize || ''), ipt: t.ipt || '', guidance: t.guidance || '', finalSpread: t.finalSpread || '', pricingDate: t.pricingDate || '' }));
    setEditIssueForm({
      issuerName: issue.issuerName,
      dealStatus: issue.dealStatus || 'MANDATE',
      bookrunners,
      otherBookrunner,
      tranches: tranches.length > 0 ? tranches : [{ ...EMPTY_TRANCHE }]
    });
    setEditingIssue(issue.id);
    setShowEditIssueModal(true);
  }

  function cancelEditIssue() {
    setEditingIssue(null);
    setShowEditIssueModal(false);
    setEditIssueForm({ ...EMPTY_NEW_ISSUE_FORM, tranches: [{ ...EMPTY_TRANCHE }] });
  }

  // Edit issue form tranche helpers
  function addEditTranche() {
    setEditIssueForm(prev => ({ ...prev, tranches: [...prev.tranches, { ...EMPTY_TRANCHE }] }));
  }
  function removeEditTranche(idx) {
    setEditIssueForm(prev => ({ ...prev, tranches: prev.tranches.filter((_, i) => i !== idx) }));
  }
  function updateEditTranche(idx, field, value) {
    setEditIssueForm(prev => {
      const tranches = [...prev.tranches];
      tranches[idx] = { ...tranches[idx], [field]: value };
      return { ...prev, tranches };
    });
  }

  async function handleEditIssueSubmit(e) {
    e.preventDefault();
    setFormError('');
    const missing = [];
    if (!editIssueForm.issuerName) missing.push('Issuer');
    if (editIssueForm.tranches.length === 0) missing.push('At least one tranche');
    for (let i = 0; i < editIssueForm.tranches.length; i++) {
      const t = editIssueForm.tranches[i];
      if (!t.tenor) missing.push(`Tranche ${i + 1}: Tenor`);
      if (!t.targetSize) missing.push(`Tranche ${i + 1}: Issue Size`);
    }
    if (missing.length) { setFormError(`Please fill in: ${missing.join(', ')}`); return; }
    await saveIssue(editIssueForm);
    setShowEditIssueModal(false);
  }

  // ============ DELETE ISSUE ============
  async function handleDeleteNewIssue(issueId) {
    if (!isAdmin) return;
    const issue = newIssues.find(i => i.id === issueId);
    setDeleteConfirm({ id: issueId, type: 'issue', label: issue?.issuerName || 'this issue' });
  }

  async function executeDeleteIssue(issueId) {
    try {
      await deleteDoc(doc(db, `organizations/${userData.organizationId}/newIssues`, issueId));
    } catch (error) { console.error('Error deleting issue:', error); setNotification('Failed to delete issue.'); }
  }

  // ============ ORDER BOOK ============
  async function handleOrderBookSubmit(e) {
    e.preventDefault();
    if (!userData?.organizationId) return;
    const missing = [];
    if (!orderBookForm.issueId) missing.push('Issue');
    if (!orderBookForm.trancheId) missing.push('Tranche');
    if (!orderBookForm.clientName) missing.push('Client');
    if (!orderBookForm.orderSize) missing.push('Order Size');
    if (missing.length) { setFormError(`Please fill in: ${missing.join(', ')}`); return; }

    setSubmitLoading(true);
    setFormError('');
    try {
      const selectedIssue = newIssues.find(i => i.id === orderBookForm.issueId);
      const selectedTranche = selectedIssue?.tranches?.find(t => t.id === orderBookForm.trancheId);
      const orderBooksRef = collection(db, `organizations/${userData.organizationId}/orderBooks`);
      await addDoc(orderBooksRef, {
        issueId: orderBookForm.issueId,
        issuerName: selectedIssue?.issuerName || '',
        trancheId: orderBookForm.trancheId,
        trancheTenor: selectedTranche?.tenor || '',
        trancheCurrency: selectedTranche?.currency || '',
        clientName: orderBookForm.clientName,
        orderSize: parseFloat(orderBookForm.orderSize) || 0,
        orderLimit: orderBookForm.orderLimit,
        notes: orderBookForm.notes,
        createdAt: serverTimestamp(),
        createdBy: userData.name || userData.email
      });
      setOrderBookForm({ ...EMPTY_ORDER_FORM });
    } catch (error) { console.error('Error saving order:', error); setNotification('Failed to save order.'); }
    finally { setSubmitLoading(false); }
  }

  async function handleDeleteOrder(orderId) {
    if (!isAdmin) return;
    setDeleteConfirm({ id: orderId, type: 'order', label: 'this order' });
  }

  async function executeDeleteOrder(orderId) {
    try { await deleteDoc(doc(db, `organizations/${userData.organizationId}/orderBooks`, orderId)); }
    catch (error) { console.error('Error deleting order:', error); setNotification('Failed to delete order.'); }
  }

  // ============ EDIT ORDER (all users) ============
  function startEditOrder(order) {
    setEditingOrder(order.id);
    setEditOrderForm({
      issueId: order.issueId || '',
      trancheId: order.trancheId || '',
      clientName: order.clientName,
      orderSize: String(order.orderSize),
      orderLimit: order.orderLimit || '',
      notes: order.notes || ''
    });
  }

  async function saveEditOrder() {
    if (!userData?.organizationId || !editingOrder) return;
    try {
      const selectedIssue = newIssues.find(i => i.id === editOrderForm.issueId);
      const selectedTranche = selectedIssue?.tranches?.find(t => t.id === editOrderForm.trancheId);
      await updateDoc(doc(db, `organizations/${userData.organizationId}/orderBooks`, editingOrder), {
        issueId: editOrderForm.issueId,
        issuerName: selectedIssue?.issuerName || editOrderForm.issuerName || '',
        trancheId: editOrderForm.trancheId,
        trancheTenor: selectedTranche?.tenor || '',
        trancheCurrency: selectedTranche?.currency || '',
        clientName: editOrderForm.clientName,
        orderSize: parseFloat(editOrderForm.orderSize) || 0,
        orderLimit: editOrderForm.orderLimit,
        notes: editOrderForm.notes,
        updatedAt: serverTimestamp(),
        updatedBy: userData.name || userData.email
      });
      setEditingOrder(null);
    } catch (error) { console.error('Error updating order:', error); alert('Failed to update order'); }
  }

  // ============ ADD NEW CLIENT FROM ORDER BOOK ============
  async function handleAddClientFromOrderBook(e) {
    e.preventDefault();
    setAddClientError('');
    const missing = [];
    if (!newClientForm.name) missing.push('Client Name');
    if (!newClientForm.type) missing.push('Client Type');
    if (!newClientForm.region) missing.push('Region');
    if (missing.length) { setAddClientError(`Please fill in: ${missing.join(', ')}`); return; }

    // Dedup check
    const similar = findSimilarClients(newClientForm.name, clients);
    if (similar.length > 0) {
      setClientDedupMatches(similar);
      setPendingClientData(newClientForm);
      setShowClientDedupModal(true);
      return;
    }

    await saveNewClientFromOrderBook(newClientForm);
  }

  async function saveNewClientFromOrderBook(formData) {
    setAddClientLoading(true);
    try {
      await addDoc(collection(db, `organizations/${userData.organizationId}/clients`), {
        name: formData.name,
        type: formData.type,
        region: formData.region,
        salesCoverage: formData.salesCoverage || '',
        createdAt: serverTimestamp(),
        createdBy: userData.name || userData.email
      });
      // Auto-select the new client in order form
      setOrderBookForm(prev => ({ ...prev, clientName: formData.name }));
      setShowAddClientModal(false);
      setNewClientForm({ ...EMPTY_CLIENT_FORM });
    } catch (error) { console.error('Error adding client:', error); setAddClientError('Failed to add client'); }
    finally { setAddClientLoading(false); }
  }

  function confirmAddClientDespiteDupes() {
    setShowClientDedupModal(false);
    if (pendingClientData) saveNewClientFromOrderBook(pendingClientData);
    setPendingClientData(null);
    setClientDedupMatches([]);
  }

  function cancelClientDedupAdd() {
    setShowClientDedupModal(false);
    setPendingClientData(null);
    setClientDedupMatches([]);
  }

  // ============ CLIENT FEEDBACK ============
  function openFeedbackModal(issue, tranche, clientName) {
    setFeedbackTarget({
      issueId: issue.id,
      issueName: issue.issuerName,
      trancheId: tranche ? tranche.id : null,
      trancheTenor: tranche?.tenor || null,
      trancheCurrency: tranche?.currency || null,
      lockedClientName: clientName || null,
    });
    setFeedbackForm({ ...EMPTY_FEEDBACK_FORM, trancheId: tranche ? tranche.id : '', clientName: clientName || '' });
    setFeedbackError('');
    setShowFeedbackModal(true);
  }

  function closeFeedbackModal() {
    setShowFeedbackModal(false);
    setFeedbackTarget(null);
    setFeedbackForm({ ...EMPTY_FEEDBACK_FORM });
    setFeedbackError('');
  }

  function getFeedbackForIssue(issueId) {
    return clientFeedback.filter(f => f.issueId === issueId && !f.trancheId);
  }

  function getFeedbackForTranche(issueId, trancheId) {
    return clientFeedback.filter(f => f.issueId === issueId && f.trancheId === trancheId);
  }

  function getModalFeedbackEntries() {
    if (!feedbackTarget) return [];
    if (feedbackTarget.trancheId) {
      return getFeedbackForTranche(feedbackTarget.issueId, feedbackTarget.trancheId);
    }
    return getFeedbackForIssue(feedbackTarget.issueId);
  }

  async function handleFeedbackSubmit(e) {
    e.preventDefault();
    setFeedbackError('');
    if (!feedbackTarget || !userData?.organizationId) return;
    const resolvedClientName = feedbackTarget.lockedClientName || feedbackForm.clientName;
    if (!resolvedClientName) { setFeedbackError('Please select a client.'); return; }
    if (!feedbackForm.comment.trim()) { setFeedbackError('Please enter feedback.'); return; }

    setFeedbackLoading(true);
    try {
      const feedbackRef = collection(db, `organizations/${userData.organizationId}/clientFeedback`);
      await addDoc(feedbackRef, {
        issueId: feedbackTarget.issueId,
        issueName: feedbackTarget.issueName,
        trancheId: feedbackTarget.trancheId || null,
        trancheTenor: feedbackTarget.trancheTenor || null,
        trancheCurrency: feedbackTarget.trancheCurrency || null,
        clientName: resolvedClientName,
        sentiment: feedbackForm.sentiment,
        comment: feedbackForm.comment.trim(),
        createdAt: serverTimestamp(),
        createdBy: userData.name || userData.email,
      });
      setFeedbackForm({ ...EMPTY_FEEDBACK_FORM, trancheId: feedbackTarget.trancheId || '' });
      setNotification('Feedback added successfully.');
    } catch (error) {
      console.error('Error saving feedback:', error);
      setFeedbackError('Failed to save feedback.');
    } finally {
      setFeedbackLoading(false);
    }
  }

  async function handleDeleteFeedback(feedbackId) {
    if (!userData?.organizationId) return;
    try {
      await deleteDoc(doc(db, `organizations/${userData.organizationId}/clientFeedback`, feedbackId));
    } catch (error) {
      console.error('Error deleting feedback:', error);
      setNotification('Failed to delete feedback.');
    }
  }

  // ============ SELECT / EXPAND / FILTER ============
  function toggleSelectIssue(id) {
    setSelectedIssueIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleSelectAllIssues() {
    const allSelected = filteredNewIssues.length > 0 && filteredNewIssues.every(i => selectedIssueIds.has(i.id));
    if (allSelected) setSelectedIssueIds(prev => { const next = new Set(prev); filteredNewIssues.forEach(i => next.delete(i.id)); return next; });
    else setSelectedIssueIds(prev => { const next = new Set(prev); filteredNewIssues.forEach(i => next.add(i.id)); return next; });
  }
  function toggleExpandIssue(id) {
    setExpandedIssueIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  // ============ ORDER BOOK FILTERING ============
  const hasOrderFilters = Object.values(orderFilters).some(v => v.trim());

  const filteredOrderBooks = React.useMemo(() => {
    if (!hasOrderFilters) return orderBooks;
    return orderBooks.filter(order => {
      if (orderFilters.date && !(order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '').toLowerCase().includes(orderFilters.date.toLowerCase())) return false;
      if (orderFilters.issuerName && !(order.issuerName || '').toLowerCase().includes(orderFilters.issuerName.toLowerCase())) return false;
      if (orderFilters.trancheTenor && !(order.trancheTenor || '').toLowerCase().includes(orderFilters.trancheTenor.toLowerCase())) return false;
      if (orderFilters.trancheCurrency && !(order.trancheCurrency || '').toLowerCase().includes(orderFilters.trancheCurrency.toLowerCase())) return false;
      if (orderFilters.clientName && !(order.clientName || '').toLowerCase().includes(orderFilters.clientName.toLowerCase())) return false;
      if (orderFilters.orderSize && !(String(order.orderSize || '')).toLowerCase().includes(orderFilters.orderSize.toLowerCase())) return false;
      if (orderFilters.orderLimit && !(String(order.orderLimit || '')).toLowerCase().includes(orderFilters.orderLimit.toLowerCase())) return false;
      if (orderFilters.notes && !(order.notes || '').toLowerCase().includes(orderFilters.notes.toLowerCase())) return false;
      if (orderFilters.feedback && !(order.clientFeedback?.sentiment || '').toLowerCase().includes(orderFilters.feedback.toLowerCase())) return false;
      if (orderFilters.createdBy && !(order.createdBy || '').toLowerCase().includes(orderFilters.createdBy.toLowerCase())) return false;
      return true;
    });
  }, [orderBooks, orderFilters, hasOrderFilters]);

  async function handleBulkDeleteIssues() {
    if (selectedIssueIds.size === 0) return;
    if (!isAdmin) { alert('Only org admins can delete issues.'); return; }
    if (!window.confirm(`Delete ${selectedIssueIds.size} selected issue${selectedIssueIds.size === 1 ? '' : 's'}?`)) return;
    try {
      for (const id of selectedIssueIds) {
        await deleteDoc(doc(db, `organizations/${userData.organizationId}/newIssues`, id));
      }
      setSelectedIssueIds(new Set());
    } catch (e) { console.error(e); alert('Failed to delete some issues'); }
  }

  const hasIssueColFilters = Object.values(issueColFilters).some(v => v.trim());
  const filteredNewIssues = newIssues.filter(i => {
    if (filterIssueCurrency) {
      const hasCurrency = i.tranches?.some(t => t.currency === filterIssueCurrency);
      if (!hasCurrency) return false;
    }
    if (issueSearch) {
      const q = issueSearch.toLowerCase();
      if (!(i.issuerName?.toLowerCase().includes(q) || i.bookrunners?.join(' ').toLowerCase().includes(q) || i.createdBy?.toLowerCase().includes(q))) return false;
    }
    if (hasIssueColFilters) {
      const f = issueColFilters;
      if (f.date && !(i.createdAt ? new Date(i.createdAt).toLocaleDateString() : '').toLowerCase().includes(f.date.toLowerCase())) return false;
      if (f.issuer && !(i.issuerName || '').toLowerCase().includes(f.issuer.toLowerCase())) return false;
      if (f.tranches && !(i.tranches || []).some(t => ((t.tenor || '') + ' ' + (t.currency || '')).toLowerCase().includes(f.tranches.toLowerCase()))) return false;
      if (f.bookrunners && !(i.bookrunners?.join(', ') || '').toLowerCase().includes(f.bookrunners.toLowerCase())) return false;
      if (f.createdBy && !(i.createdBy || '').toLowerCase().includes(f.createdBy.toLowerCase())) return false;
    }
    return true;
  });

  // ============ ORDER BOOK CALCULATIONS ============
  function getTrancheOrderTotal(issueId, trancheId) {
    return orderBooks
      .filter(o => o.issueId === issueId && o.trancheId === trancheId)
      .reduce((sum, o) => sum + (parseFloat(o.orderSize) || 0), 0);
  }

  function getIssueOrderSummary(issue) {
    return (issue.tranches || []).map(t => {
      const total = getTrancheOrderTotal(issue.id, t.id);
      const internalTarget = t.internalTargetSize || 0;
      const pct = internalTarget > 0 ? Math.round((total / internalTarget) * 100) : 0;
      return { ...t, orderTotal: total, pct };
    });
  }

  // Get selected issue's tranches for order book dropdown
  const selectedIssueForOrder = newIssues.find(i => i.id === orderBookForm.issueId);
  const selectedEditIssueForOrder = newIssues.find(i => i.id === editOrderForm.issueId);

  // ============ EXPORT ============
  function handleExportNewIssuesExcel() {
    if (newIssues.length === 0) { alert('No new issues to export!'); return; }
    const exportData = [];
    newIssues.forEach(issue => {
      (issue.tranches || []).forEach(t => {
        exportData.push({
          createdAt: issue.createdAt,
          issuerName: issue.issuerName,
          tenor: t.tenor,
          targetIssueSize: t.targetSize,
          internalTargetSize: t.internalTargetSize || 0,
          currency: t.currency,
          bookrunners: issue.bookrunners?.join(', ') || '-',
          createdBy: issue.createdBy
        });
      });
    });
    const columns = [
      { header: 'Date', field: 'createdAt' }, { header: 'Issuer', field: 'issuerName' },
      { header: 'Tenor', field: 'tenor' }, { header: 'Issue Size (MM)', field: 'targetIssueSize' },
      { header: 'Internal Order Target (MM)', field: 'internalTargetSize' },
      { header: 'Currency', field: 'currency' }, { header: 'Bookrunners', field: 'bookrunners' },
      { header: 'Created By', field: 'createdBy' }
    ];
    exportToExcel(exportData, columns, 'new-issues-export', 'New Issues');
    if (userData?.organizationId) logAudit(userData.organizationId, { action: 'export_pipeline_issues_excel', details: `Exported ${exportData.length} new issue tranches to Excel`, userId: currentUser?.uid, userName: userData?.name, userEmail: userData?.email });
  }

  function handleExportNewIssuesPDF() {
    if (newIssues.length === 0) { alert('No new issues to export!'); return; }
    const exportData = [];
    newIssues.forEach(issue => {
      (issue.tranches || []).forEach(t => {
        exportData.push({
          createdAt: issue.createdAt,
          issuerName: issue.issuerName,
          tenor: t.tenor,
          targetIssueSize: t.targetSize,
          internalTargetSize: t.internalTargetSize || 0,
          currency: t.currency,
          bookrunners: issue.bookrunners?.join(', ') || '-',
          createdBy: issue.createdBy
        });
      });
    });
    const columns = [
      { header: 'Date', field: 'createdAt' }, { header: 'Issuer', field: 'issuerName' },
      { header: 'Tenor', field: 'tenor' }, { header: 'Issue Size (MM)', field: 'targetIssueSize' },
      { header: 'Internal Order Target (MM)', field: 'internalTargetSize' },
      { header: 'Currency', field: 'currency' }, { header: 'Bookrunners', field: 'bookrunners' },
      { header: 'Created By', field: 'createdBy' }
    ];
    exportToPDF(exportData, columns, 'new-issues-export', 'New Issues Pipeline');
    if (userData?.organizationId) logAudit(userData.organizationId, { action: 'export_pipeline_issues_pdf', details: `Exported ${exportData.length} new issue tranches to PDF`, userId: currentUser?.uid, userName: userData?.name, userEmail: userData?.email });
  }

  function handleExportOrderBookExcel() {
    if (orderBooks.length === 0) { alert('No orders to export!'); return; }
    const columns = [
      { header: 'Date', field: 'createdAt' }, { header: 'Issuer', field: 'issuerName' },
      { header: 'Tenor', field: 'trancheTenor' }, { header: 'Currency', field: 'trancheCurrency' },
      { header: 'Client', field: 'clientName' }, { header: 'Order Size (MM)', field: 'orderSize' },
      { header: 'Order Limit', field: 'orderLimit' }, { header: 'Notes', field: 'notes' },
      { header: 'Created By', field: 'createdBy' }
    ];
    exportToExcel(orderBooks, columns, 'order-book-export', 'Order Book');
    if (userData?.organizationId) logAudit(userData.organizationId, { action: 'export_orderbook_excel', details: `Exported ${orderBooks.length} orders to Excel`, userId: currentUser?.uid, userName: userData?.name, userEmail: userData?.email });
  }

  function handleExportOrderBookPDF() {
    if (orderBooks.length === 0) { alert('No orders to export!'); return; }
    const columns = [
      { header: 'Date', field: 'createdAt' }, { header: 'Issuer', field: 'issuerName' },
      { header: 'Tenor', field: 'trancheTenor' }, { header: 'Currency', field: 'trancheCurrency' },
      { header: 'Client', field: 'clientName' }, { header: 'Order Size (MM)', field: 'orderSize' },
      { header: 'Order Limit', field: 'orderLimit' }, { header: 'Notes', field: 'notes' },
      { header: 'Created By', field: 'createdBy' }
    ];
    exportToPDF(orderBooks, columns, 'order-book-export', 'Order Book');
    if (userData?.organizationId) logAudit(userData.organizationId, { action: 'export_orderbook_pdf', details: `Exported ${orderBooks.length} orders to PDF`, userId: currentUser?.uid, userName: userData?.name, userEmail: userData?.email });
  }

  if (loading) {
    return (
      <div className="app-container">
        <Navigation />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 16px' }}></div>
            <div style={{ color: 'var(--text-primary)' }}>Loading pipeline...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navigation />

      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">New Issue Pipeline</h1>
            <p className="page-description">Manage new bond issues and order books</p>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="sub-tabs">
          <button className={`sub-tab ${activeSubTab === 'create' ? 'active' : ''}`} onClick={() => setActiveSubTab('create')}>
            New Issues ({newIssues.length})
          </button>
          <button className={`sub-tab ${activeSubTab === 'orderbook' ? 'active' : ''}`} onClick={() => setActiveSubTab('orderbook')}>
            Order Book ({orderBooks.length})
          </button>
        </div>

        {/* ======================== NEW ISSUES TAB ======================== */}
        {activeSubTab === 'create' && (
          <>
            {/* Create/Edit Form - admin only */}
            {isAdmin ? (
              <div className="card">
                <div className="card-header">
                  <span>Create New Issue</span>
                </div>

                <form onSubmit={handleNewIssueSubmit}>
                  <div className="form-grid">
                    <div className="field-row">
                      <div className="field-group">
                        <label className="form-label">Issuer *</label>
                        <input type="text" className="form-input" placeholder="e.g., Amazon" value={newIssueForm.issuerName}
                          onChange={(e) => setNewIssueForm({ ...newIssueForm, issuerName: e.target.value })} />
                      </div>
                      <div className="field-group">
                        <label className="form-label">Deal Status</label>
                        <select className="form-select" value={newIssueForm.dealStatus} onChange={e => setNewIssueForm({ ...newIssueForm, dealStatus: e.target.value })}>
                          {DEAL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Bookrunners</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
                          {Object.keys(newIssueForm.bookrunners).map(key => (
                            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={newIssueForm.bookrunners[key]}
                                onChange={(e) => setNewIssueForm({ ...newIssueForm, bookrunners: { ...newIssueForm.bookrunners, [key]: e.target.checked } })}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{key === 'other' ? 'Other' : key}</span>
                            </label>
                          ))}
                        </div>
                        {newIssueForm.bookrunners.other && (
                          <input type="text" className="form-input" placeholder="Enter bank names separated by commas, e.g. Citi, Barclays" value={newIssueForm.otherBookrunner}
                            onChange={(e) => setNewIssueForm({ ...newIssueForm, otherBookrunner: e.target.value })} style={{ marginTop: '8px' }} />
                        )}
                      </div>
                    </div>

                    {/* Tranches Section */}
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <label className="form-label" style={{ marginBottom: 0 }}>Tranches *</label>
                        <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={addTranche}>+ Add Tranche</button>
                      </div>

                      {newIssueForm.tranches.map((tranche, idx) => (
                        <div key={idx} style={{ marginBottom: '10px', padding: '12px', background: 'var(--table-odd)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '12px', marginBottom: '10px' }}>
                            <div className="field-group">
                              <label className="form-label">Tenor *</label>
                              <select className="form-select" value={tranche.tenor} onChange={(e) => updateTranche(idx, 'tenor', e.target.value)}>
                                <option value="">Select Tenor</option>
                                {TENOR_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                            <div className="field-group">
                              <label className="form-label">Currency *</label>
                              <select className="form-select" value={tranche.currency} onChange={(e) => updateTranche(idx, 'currency', e.target.value)}>
                                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div className="field-group">
                              <label className="form-label">Issue Size (MM) *</label>
                              <input type="number" step="0.01" className="form-input" placeholder="e.g., 5000" value={tranche.targetSize}
                                onChange={(e) => updateTranche(idx, 'targetSize', e.target.value)} />
                            </div>
                            <div className="field-group">
                              <label className="form-label">Internal Order Target (MM)</label>
                              <input type="number" step="0.01" className="form-input" placeholder="e.g., 200" value={tranche.internalTargetSize}
                                onChange={(e) => updateTranche(idx, 'internalTargetSize', e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                              {newIssueForm.tranches.length > 1 && (
                                <button type="button" className="btn-icon" onClick={() => removeTranche(idx)} title="Remove tranche" style={{ color: '#dc2626' }}>x</button>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                            <div className="field-group">
                              <label className="form-label">IPT</label>
                              <input type="text" className="form-input" placeholder="e.g., T+180bps area" value={tranche.ipt} onChange={e => updateTranche(idx, 'ipt', e.target.value)} />
                            </div>
                            <div className="field-group">
                              <label className="form-label">Guidance</label>
                              <input type="text" className="form-input" placeholder="e.g., T+165bps area" value={tranche.guidance} onChange={e => updateTranche(idx, 'guidance', e.target.value)} />
                            </div>
                            <div className="field-group">
                              <label className="form-label">Final Spread</label>
                              <input type="text" className="form-input" placeholder="e.g., T+160bps" value={tranche.finalSpread} onChange={e => updateTranche(idx, 'finalSpread', e.target.value)} />
                            </div>
                            <div className="field-group">
                              <label className="form-label">Pricing Date</label>
                              <input type="date" className="form-input" value={tranche.pricingDate} onChange={e => updateTranche(idx, 'pricingDate', e.target.value)} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)' }}>
                    {formError && <div className="form-error-banner">{formError}</div>}
                    <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                      {submitLoading ? 'Adding...' : '+ Add New Issue'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div style={{ padding: '16px', background: 'var(--badge-primary-bg)', borderRadius: '8px', border: '1px solid var(--badge-primary-text)', marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--badge-primary-text)', margin: 0 }}>Only org admins can create or edit new issues. Contact your admin to add issues.</p>
              </div>
            )}

            {/* New Issues List */}
            <div className="card" style={{ marginTop: '24px' }}>
              <div className="card-header">
                <span>New Issues ({filteredNewIssues.length < newIssues.length ? `${filteredNewIssues.length} of ${newIssues.length}` : newIssues.length})</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {isAdmin && selectedIssueIds.size > 0 && (
                    <button onClick={handleBulkDeleteIssues} className="btn btn-danger">Delete {selectedIssueIds.size} Selected</button>
                  )}
                  <button onClick={handleExportNewIssuesExcel} className="btn btn-secondary">Export Excel</button>
                  <button onClick={handleExportNewIssuesPDF} className="btn btn-secondary">Export PDF</button>
                </div>
              </div>

              {/* Filter bar */}
              <div className="filter-bar">
                <div className="filter-search-wrap">
                  <svg className="filter-search-icon" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input type="text" className="filter-input" placeholder="Search issuer, bookrunners..." value={issueSearch} onChange={e => setIssueSearch(e.target.value)} />
                  {issueSearch && <button className="filter-clear-x" onClick={() => setIssueSearch('')}>x</button>}
                </div>
                <select className="filter-select" value={filterIssueCurrency} onChange={e => setFilterIssueCurrency(e.target.value)}>
                  <option value="">All Currencies</option>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {(issueSearch || filterIssueCurrency) && (
                  <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px', background: 'var(--btn-muted-bg)', color: 'var(--btn-muted-text)' }} onClick={() => { setIssueSearch(''); setFilterIssueCurrency(''); }}>Clear</button>
                )}
              </div>

              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      {isAdmin && <th style={{ width: '40px' }}><input type="checkbox" checked={filteredNewIssues.length > 0 && filteredNewIssues.every(i => selectedIssueIds.has(i.id))} onChange={toggleSelectAllIssues} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /></th>}
                      <th style={{ width: '40px' }}></th>
                      <th>Date</th>
                      <th>Issuer</th>
                      <th>Tranches</th>
                      <th>Bookrunners</th>
                      <th>Created By</th>
                      {isAdmin && <th>Actions</th>}
                    </tr>
                    <tr style={{ background: 'var(--table-header-bg)' }}>
                      {isAdmin && <th></th>}
                      <th></th>
                      {['date','issuer','tranches','bookrunners','createdBy'].map(k=>(
                        <th key={k}><input type="text" className="form-input" placeholder="Filter..." value={issueColFilters[k]} onChange={e=>setIssueColFilters({...issueColFilters,[k]:e.target.value})} style={{fontSize:'11px',padding:'4px 8px',width:'100%'}}/></th>
                      ))}
                      {isAdmin && <th>{hasIssueColFilters&&<button className="btn btn-secondary" style={{padding:'4px 10px',fontSize:'11px'}} onClick={()=>setIssueColFilters({date:'',issuer:'',tranches:'',bookrunners:'',createdBy:''})}>Clear</button>}</th>}
                      {!isAdmin && hasIssueColFilters && <th><button className="btn btn-secondary" style={{padding:'4px 10px',fontSize:'11px'}} onClick={()=>setIssueColFilters({date:'',issuer:'',tranches:'',bookrunners:'',createdBy:''})}>Clear</button></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNewIssues.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 8 : 6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          {newIssues.length === 0 ? 'No new issues yet.' : 'No issues match your filters.'}
                        </td>
                      </tr>
                    ) : (
                      filteredNewIssues.map((issue) => {
                        const isExpanded = expandedIssueIds.has(issue.id);
                        const summary = getIssueOrderSummary(issue);
                        return (
                          <React.Fragment key={issue.id}>
                            <tr style={selectedIssueIds.has(issue.id) ? { background: 'var(--accent-glow)' } : undefined}>
                              {isAdmin && <td><input type="checkbox" checked={selectedIssueIds.has(issue.id)} onChange={() => toggleSelectIssue(issue.id)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /></td>}
                              <td>
                                <button className="btn-icon" onClick={() => toggleExpandIssue(issue.id)} title={isExpanded ? 'Collapse' : 'Expand'} style={{ fontSize: '12px', transition: 'transform 0.2s' }}>
                                  {isExpanded ? '\u25BC' : '\u25B6'}
                                </button>
                              </td>
                              <td>{issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : '-'}</td>
                              <td style={{ fontWeight: 600 }}>
                                {issue.issuerName}
                                {issue.dealStatus && (() => { const s = DEAL_STATUS_COLORS[issue.dealStatus] || {}; return <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', background: s.bg, color: s.color, letterSpacing: '0.04em' }}>{issue.dealStatus.replace('_', ' ')}</span>; })()}
                              </td>
                              <td>
                                {(issue.tranches || []).map(t => (
                                  <span key={t.id} className="badge badge-primary" style={{ marginRight: '4px', marginBottom: '2px' }}>{t.tenor} {t.currency}</span>
                                ))}
                              </td>
                              <td>{issue.bookrunners?.join(', ') || '-'}</td>
                              <td>{issue.createdBy}</td>
                              {isAdmin && (
                                <td>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn-edit" onClick={() => handleEditIssue(issue)} title="Edit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                                    <button className="btn-icon" onClick={() => handleDeleteNewIssue(issue.id)} title="Delete">&#128465;</button>
                                  </div>
                                </td>
                              )}
                            </tr>
                            {/* Expanded tranche rows */}
                            {isExpanded && (issue.tranches || []).map(t => {
                              const s = summary.find(x => x.id === t.id);
                              return (
                                <tr key={t.id} style={{ background: 'var(--table-header-bg)' }}>
                                  {isAdmin && <td></td>}
                                  <td></td>
                                  <td></td>
                                  <td style={{ paddingLeft: '32px', fontSize: '13px', color: 'var(--text-secondary)' }}>{t.tenor}</td>
                                  <td>
                                    <span className="badge badge-primary">{t.currency}</span>
                                    <span style={{ marginLeft: '8px', fontSize: '13px' }}>Issue: {t.targetSize}MM</span>
                                    {t.internalTargetSize > 0 && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Internal target: {t.internalTargetSize}MM</span>}
                                  </td>
                                  <td>
                                    {t.internalTargetSize > 0 ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ flex: 1, background: 'var(--border)', borderRadius: '4px', height: '8px', maxWidth: '150px' }}>
                                          <div style={{ width: `${Math.min(s?.pct || 0, 100)}%`, background: (s?.pct || 0) >= 100 ? '#22c55e' : 'var(--accent)', height: '100%', borderRadius: '4px', transition: 'width 0.3s' }}></div>
                                        </div>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: (s?.pct || 0) >= 100 ? '#22c55e' : 'var(--text-secondary)' }}>
                                          {s?.orderTotal || 0}MM / {t.internalTargetSize}MM ({s?.pct || 0}%)
                                        </span>
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No internal target set</span>
                                    )}
                                  </td>
                                  <td colSpan={isAdmin ? 2 : 1}></td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ======================== ORDER BOOK TAB ======================== */}
        {activeSubTab === 'orderbook' && (
          <>
            <div className="card">
              <div className="card-header">
                <span>Add Order</span>
              </div>

              <form onSubmit={handleOrderBookSubmit}>
                <div className="form-grid">
                  <div className="field-row">
                    <div className="field-group">
                      <label className="form-label">Select Issue *</label>
                      <select className="form-select" value={orderBookForm.issueId}
                        onChange={(e) => setOrderBookForm({ ...orderBookForm, issueId: e.target.value, trancheId: '' })}>
                        <option value="">Select Issue</option>
                        {newIssues.map(issue => (
                          <option key={issue.id} value={issue.id}>{issue.issuerName}</option>
                        ))}
                      </select>
                      {newIssues.length === 0 && (
                        <p style={{ fontSize: '12px', color: 'var(--badge-warning-text)', marginTop: '6px' }}>
                          No new issues available. Create a new issue first in the "New Issues" tab.
                        </p>
                      )}
                    </div>

                    <div className="field-group">
                      <label className="form-label">Select Tranche *</label>
                      <select className="form-select" value={orderBookForm.trancheId}
                        onChange={(e) => setOrderBookForm({ ...orderBookForm, trancheId: e.target.value })}
                        disabled={!orderBookForm.issueId}>
                        <option value="">Select Tranche</option>
                        {(selectedIssueForOrder?.tranches || []).map(t => (
                          <option key={t.id} value={t.id}>{t.tenor} - {t.currency} ({t.targetSize}MM)</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="field-row">
                    <div className="field-group">
                      <label className="form-label">Client *</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select className="form-select" value={orderBookForm.clientName} style={{ flex: 1 }}
                          onChange={(e) => setOrderBookForm({ ...orderBookForm, clientName: e.target.value })}>
                          <option value="">Select Client</option>
                          {clients.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(client => (
                            <option key={client.id} value={client.name}>{client.name}</option>
                          ))}
                        </select>
                        <button type="button" className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                          onClick={() => setShowAddClientModal(true)}>+ New Client</button>
                      </div>
                    </div>

                    <div className="field-group">
                      <label className="form-label">Order Size (MM) *</label>
                      <input type="number" step="0.01" className="form-input" placeholder="e.g., 50" value={orderBookForm.orderSize}
                        onChange={(e) => setOrderBookForm({ ...orderBookForm, orderSize: e.target.value })} />
                    </div>
                  </div>

                  <div className="field-row">
                    <div className="field-group">
                      <label className="form-label">Order Limit</label>
                      <input type="text" className="form-input" placeholder="e.g., 3.5% or Market" value={orderBookForm.orderLimit}
                        onChange={(e) => setOrderBookForm({ ...orderBookForm, orderLimit: e.target.value })} />
                    </div>
                    <div className="field-group">
                      <label className="form-label">Notes</label>
                      <input type="text" className="form-input" placeholder="e.g., Limit order, fill or kill" value={orderBookForm.notes}
                        onChange={(e) => setOrderBookForm({ ...orderBookForm, notes: e.target.value })} />
                    </div>
                  </div>

                  {/* Show target vs current orders for selected tranche */}
                  {orderBookForm.issueId && orderBookForm.trancheId && (() => {
                    const tranche = selectedIssueForOrder?.tranches?.find(t => t.id === orderBookForm.trancheId);
                    if (!tranche) return null;
                    const currentTotal = getTrancheOrderTotal(orderBookForm.issueId, orderBookForm.trancheId);
                    const newOrderSize = parseFloat(orderBookForm.orderSize) || 0;
                    const projectedTotal = currentTotal + newOrderSize;
                    const internalTarget = tranche.internalTargetSize || 0;
                    const pct = internalTarget > 0 ? Math.round((projectedTotal / internalTarget) * 100) : 0;
                    if (!internalTarget) return (
                      <div style={{ padding: '12px', background: 'var(--table-header-bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          {selectedIssueForOrder?.issuerName} {tranche.tenor} {tranche.currency} — Issue size: {tranche.targetSize}MM (no internal order target set)
                        </div>
                      </div>
                    );
                    return (
                      <div style={{ padding: '12px', background: 'var(--table-header-bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                          Book Status: {selectedIssueForOrder?.issuerName} {tranche.tenor} {tranche.currency} — Issue size: {tranche.targetSize}MM | Internal order target: {internalTarget}MM
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ flex: 1, background: 'var(--border)', borderRadius: '4px', height: '10px' }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? '#22c55e' : 'var(--accent)', height: '100%', borderRadius: '4px', transition: 'width 0.3s' }}></div>
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: pct >= 100 ? '#22c55e' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            {projectedTotal}MM / {internalTarget}MM ({pct}%)
                          </span>
                        </div>
                        {newOrderSize > 0 && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Current: {currentTotal}MM + This order: {newOrderSize}MM = {projectedTotal}MM
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)' }}>
                  {formError && activeSubTab === 'orderbook' && <div className="form-error-banner">{formError}</div>}
                  <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                    {submitLoading ? 'Adding...' : '+ Add Order'}
                  </button>
                </div>
              </form>
            </div>

            {/* Order Book List */}
            <div className="card" style={{ marginTop: '24px' }}>
              <div className="card-header">
                <span>Order Book ({hasOrderFilters ? `${filteredOrderBooks.length} of ${orderBooks.length}` : orderBooks.length})</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleExportOrderBookExcel} className="btn btn-secondary">Export Excel</button>
                  <button onClick={handleExportOrderBookPDF} className="btn btn-secondary">Export PDF</button>
                </div>
              </div>

              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Issuer</th>
                      <th>Tenor</th>
                      <th>Currency</th>
                      <th>Client</th>
                      <th>Order Size</th>
                      <th>Order Limit</th>
                      <th>Notes</th>
                      <th>Feedback</th>
                      <th>Created By</th>
                      <th>Actions</th>
                    </tr>
                    <tr style={{ background: 'var(--table-header-bg)' }}>
                      <th><input type="text" className="form-input" placeholder="Filter..." value={orderFilters.date}
                        onChange={e => setOrderFilters({ ...orderFilters, date: e.target.value })}
                        style={{ fontSize: '11px', padding: '4px 8px', width: '100%' }} /></th>
                      <th><input type="text" className="form-input" placeholder="Filter..." value={orderFilters.issuerName}
                        onChange={e => setOrderFilters({ ...orderFilters, issuerName: e.target.value })}
                        style={{ fontSize: '11px', padding: '4px 8px', width: '100%' }} /></th>
                      <th><input type="text" className="form-input" placeholder="Filter..." value={orderFilters.trancheTenor}
                        onChange={e => setOrderFilters({ ...orderFilters, trancheTenor: e.target.value })}
                        style={{ fontSize: '11px', padding: '4px 8px', width: '100%' }} /></th>
                      <th><input type="text" className="form-input" placeholder="Filter..." value={orderFilters.trancheCurrency}
                        onChange={e => setOrderFilters({ ...orderFilters, trancheCurrency: e.target.value })}
                        style={{ fontSize: '11px', padding: '4px 8px', width: '100%' }} /></th>
                      <th><input type="text" className="form-input" placeholder="Filter..." value={orderFilters.clientName}
                        onChange={e => setOrderFilters({ ...orderFilters, clientName: e.target.value })}
                        style={{ fontSize: '11px', padding: '4px 8px', width: '100%' }} /></th>
                      <th><input type="text" className="form-input" placeholder="Filter..." value={orderFilters.orderSize}
                        onChange={e => setOrderFilters({ ...orderFilters, orderSize: e.target.value })}
                        style={{ fontSize: '11px', padding: '4px 8px', width: '100%' }} /></th>
                      <th><input type="text" className="form-input" placeholder="Filter..." value={orderFilters.orderLimit}
                        onChange={e => setOrderFilters({ ...orderFilters, orderLimit: e.target.value })}
                        style={{ fontSize: '11px', padding: '4px 8px', width: '100%' }} /></th>
                      <th><input type="text" className="form-input" placeholder="Filter..." value={orderFilters.notes}
                        onChange={e => setOrderFilters({ ...orderFilters, notes: e.target.value })}
                        style={{ fontSize: '11px', padding: '4px 8px', width: '100%' }} /></th>
                      <th><input type="text" className="form-input" placeholder="Filter..." value={orderFilters.feedback}
                        onChange={e => setOrderFilters({ ...orderFilters, feedback: e.target.value })}
                        style={{ fontSize: '11px', padding: '4px 8px', width: '100%' }} /></th>
                      <th><input type="text" className="form-input" placeholder="Filter..." value={orderFilters.createdBy}
                        onChange={e => setOrderFilters({ ...orderFilters, createdBy: e.target.value })}
                        style={{ fontSize: '11px', padding: '4px 8px', width: '100%' }} /></th>
                      <th>
                        {hasOrderFilters && (
                          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}
                            onClick={() => setOrderFilters({ date: '', issuerName: '', trancheTenor: '', trancheCurrency: '', clientName: '', orderSize: '', orderLimit: '', notes: '', feedback: '', createdBy: '' })}>Clear</button>
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrderBooks.length === 0 ? (
                      <tr>
                        <td colSpan="11" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          {orderBooks.length === 0 ? 'No orders yet. Add your first order above!' : 'No orders match your filters.'}
                        </td>
                      </tr>
                    ) : (
                      filteredOrderBooks.map((order) => (
                        editingOrder === order.id ? (
                          <tr key={order.id} style={{ background: 'var(--accent-glow)' }}>
                            <td>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}</td>
                            <td>
                              <select className="form-select" style={{ fontSize: '12px', padding: '4px 8px' }} value={editOrderForm.issueId}
                                onChange={(e) => setEditOrderForm({ ...editOrderForm, issueId: e.target.value, trancheId: '' })}>
                                <option value="">Select</option>
                                {newIssues.map(i => <option key={i.id} value={i.id}>{i.issuerName}</option>)}
                              </select>
                            </td>
                            <td>
                              <select className="form-select" style={{ fontSize: '12px', padding: '4px 8px' }} value={editOrderForm.trancheId}
                                onChange={(e) => setEditOrderForm({ ...editOrderForm, trancheId: e.target.value })} disabled={!editOrderForm.issueId}>
                                <option value="">Select</option>
                                {(selectedEditIssueForOrder?.tranches || []).map(t => <option key={t.id} value={t.id}>{t.tenor}</option>)}
                              </select>
                            </td>
                            <td>{(() => { const t = selectedEditIssueForOrder?.tranches?.find(t => t.id === editOrderForm.trancheId); return t?.currency || '-'; })()}</td>
                            <td>
                              <select className="form-select" style={{ fontSize: '12px', padding: '4px 8px' }} value={editOrderForm.clientName}
                                onChange={(e) => setEditOrderForm({ ...editOrderForm, clientName: e.target.value })}>
                                <option value="">Select</option>
                                {clients.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                              </select>
                            </td>
                            <td><input type="number" step="0.01" className="form-input" style={{ fontSize: '12px', padding: '4px 8px', width: '80px' }} value={editOrderForm.orderSize}
                              onChange={(e) => setEditOrderForm({ ...editOrderForm, orderSize: e.target.value })} /></td>
                            <td><input type="text" className="form-input" style={{ fontSize: '12px', padding: '4px 8px', width: '80px' }} value={editOrderForm.orderLimit}
                              onChange={(e) => setEditOrderForm({ ...editOrderForm, orderLimit: e.target.value })} /></td>
                            <td><input type="text" className="form-input" style={{ fontSize: '12px', padding: '4px 8px', width: '100px' }} value={editOrderForm.notes}
                              onChange={(e) => setEditOrderForm({ ...editOrderForm, notes: e.target.value })} /></td>
                            <td></td>
                            <td>{order.createdBy}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={saveEditOrder}>Save</button>
                                <button className="btn btn-muted" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => setEditingOrder(null)}>Cancel</button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={order.id}>
                            <td>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}</td>
                            <td style={{ fontWeight: 600 }}>{order.issuerName}</td>
                            <td><span className="badge badge-primary">{order.trancheTenor || '-'}</span></td>
                            <td>{order.trancheCurrency || '-'}</td>
                            <td>{order.clientName}</td>
                            <td>{order.orderSize}MM</td>
                            <td>{order.orderLimit || '-'}</td>
                            <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.notes || '-'}</td>
                            <td>
                              {(() => {
                                const issue = newIssues.find(i => i.id === order.issueId);
                                const tranche = issue?.tranches?.find(t => t.id === order.trancheId);
                                if (!issue) return '-';
                                return (
                                  <button className="feedback-btn" onClick={() => openFeedbackModal(issue, tranche || null, order.clientName)} title={`Feedback for ${order.clientName}`}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                    {getFeedbackForTranche(order.issueId, order.trancheId).length > 0 && (
                                      <span className="feedback-count">{getFeedbackForTranche(order.issueId, order.trancheId).length}</span>
                                    )}
                                  </button>
                                );
                              })()}
                            </td>
                            <td>{order.createdBy}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn-edit" onClick={() => startEditOrder(order)} title="Edit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                                {isAdmin && <button className="btn-icon" onClick={() => handleDeleteOrder(order.id)} title="Delete (Admin only)">&#128465;</button>}
                              </div>
                            </td>
                          </tr>
                        )
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ======================== EDIT ISSUE MODAL ======================== */}
      {showEditIssueModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', maxWidth: '700px', width: '95%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Edit Issue</h3>
            <form onSubmit={handleEditIssueSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="field-group">
                    <label className="form-label">Issuer *</label>
                    <input type="text" className="form-input" value={editIssueForm.issuerName}
                      onChange={(e) => setEditIssueForm({ ...editIssueForm, issuerName: e.target.value })} />
                  </div>
                  <div className="field-group">
                    <label className="form-label">Bookrunners</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '4px' }}>
                      {Object.keys(editIssueForm.bookrunners).map(key => (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={editIssueForm.bookrunners[key]}
                            onChange={(e) => setEditIssueForm({ ...editIssueForm, bookrunners: { ...editIssueForm.bookrunners, [key]: e.target.checked } })}
                            style={{ width: '14px', height: '14px', cursor: 'pointer' }} />
                          <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{key === 'other' ? 'Other' : key}</span>
                        </label>
                      ))}
                    </div>
                    {editIssueForm.bookrunners.other && (
                      <input type="text" className="form-input" placeholder="Enter bank names separated by commas, e.g. Citi, Barclays" value={editIssueForm.otherBookrunner}
                        onChange={(e) => setEditIssueForm({ ...editIssueForm, otherBookrunner: e.target.value })} style={{ marginTop: '6px', fontSize: '13px' }} />
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Tranches *</label>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={addEditTranche}>+ Add Tranche</button>
                  </div>
                  {editIssueForm.tranches.map((tranche, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '10px', marginBottom: '8px', padding: '10px', background: 'var(--table-odd)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div className="field-group">
                        <label className="form-label" style={{ fontSize: '11px' }}>Tenor *</label>
                        <select className="form-select" style={{ fontSize: '13px', padding: '8px 10px' }} value={tranche.tenor} onChange={(e) => updateEditTranche(idx, 'tenor', e.target.value)}>
                          <option value="">Select</option>
                          {TENOR_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="field-group">
                        <label className="form-label" style={{ fontSize: '11px' }}>Currency *</label>
                        <select className="form-select" style={{ fontSize: '13px', padding: '8px 10px' }} value={tranche.currency} onChange={(e) => updateEditTranche(idx, 'currency', e.target.value)}>
                          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="field-group">
                        <label className="form-label" style={{ fontSize: '11px' }}>Issue Size (MM) *</label>
                        <input type="number" step="0.01" className="form-input" style={{ fontSize: '13px', padding: '8px 10px' }} value={tranche.targetSize}
                          onChange={(e) => updateEditTranche(idx, 'targetSize', e.target.value)} />
                      </div>
                      <div className="field-group">
                        <label className="form-label" style={{ fontSize: '11px' }}>Internal Order Target (MM)</label>
                        <input type="number" step="0.01" className="form-input" style={{ fontSize: '13px', padding: '8px 10px' }} value={tranche.internalTargetSize}
                          onChange={(e) => updateEditTranche(idx, 'internalTargetSize', e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                        {editIssueForm.tranches.length > 1 && (
                          <button type="button" className="btn-icon" onClick={() => removeEditTranche(idx)} title="Remove" style={{ color: '#dc2626' }}>x</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {formError && showEditIssueModal && <div className="form-error-banner" style={{ marginTop: '12px' }}>{formError}</div>}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-muted" onClick={cancelEditIssue}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitLoading}>{submitLoading ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================== ADD NEW CLIENT MODAL ======================== */}
      {showAddClientModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', maxWidth: '520px', width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Add New Client</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              This client will be added to your Client Directory and selected in the order form.
            </p>
            <form onSubmit={handleAddClientFromOrderBook}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="field-group">
                  <label className="form-label">Client Name *</label>
                  <input type="text" className="form-input" placeholder="e.g., ABC Fund Management Ltd" value={newClientForm.name}
                    onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="field-group">
                    <label className="form-label">Client Type *</label>
                    <select className="form-select" value={newClientForm.type} onChange={(e) => setNewClientForm({ ...newClientForm, type: e.target.value })}>
                      {CLIENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="form-label">Region *</label>
                    <select className="form-select" value={newClientForm.region} onChange={(e) => setNewClientForm({ ...newClientForm, region: e.target.value })}>
                      {CLIENT_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field-group">
                  <label className="form-label">Sales Coverage</label>
                  <input type="text" className="form-input" placeholder="e.g., John Doe" value={newClientForm.salesCoverage}
                    onChange={(e) => setNewClientForm({ ...newClientForm, salesCoverage: e.target.value })} />
                </div>
              </div>
              {addClientError && <div className="form-error-banner" style={{ marginTop: '12px' }}>{addClientError}</div>}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-muted" onClick={() => { setShowAddClientModal(false); setNewClientForm({ ...EMPTY_CLIENT_FORM }); setAddClientError(''); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addClientLoading}>{addClientLoading ? 'Adding...' : 'Add Client'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================== ISSUER DEDUP MODAL ======================== */}
      {showDedupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>Similar Issuers Found</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              The following existing issuers are similar to "<strong>{pendingIssueData?.issuerName}</strong>":
            </p>
            <div style={{ maxHeight: '200px', overflow: 'auto', marginBottom: '16px' }}>
              {dedupMatches.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--table-odd)', borderRadius: '8px', marginBottom: '6px', border: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.client.name}</span>
                  <span className="badge badge-warning" style={{ fontSize: '10px' }}>{m.matchType === 'exact' ? 'Exact match' : m.matchType === 'contains' ? 'Name overlap' : 'Similar'} ({Math.round(m.score * 100)}%)</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-muted" onClick={cancelDedupAdd}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmAddDespiteDupes}>Add Anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* ======================== CLIENT DEDUP MODAL ======================== */}
      {showClientDedupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>Similar Clients Found</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              The following existing clients are similar to "<strong>{pendingClientData?.name}</strong>":
            </p>
            <div style={{ maxHeight: '200px', overflow: 'auto', marginBottom: '16px' }}>
              {clientDedupMatches.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--table-odd)', borderRadius: '8px', marginBottom: '6px', border: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.client.name}</span>
                  <span className="badge badge-warning" style={{ fontSize: '10px' }}>{m.matchType === 'exact' ? 'Exact match' : m.matchType === 'contains' ? 'Name overlap' : 'Similar'} ({Math.round(m.score * 100)}%)</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-muted" onClick={cancelClientDedupAdd}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmAddClientDespiteDupes}>Add Anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* ======================== BOOKRUNNER DEDUP MODAL ======================== */}
      {showBookrunnerDedupModal && bookrunnerDedupData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', maxWidth: '560px', width: '95%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Similar Bank Names Found</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Some bank names you entered look similar to previously used names. Please clarify or edit:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              {bookrunnerDedupData.entries.map((entry, idx) => (
                <div key={idx} style={{ padding: '12px', background: 'var(--table-odd)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>You entered:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>"{entry.input}"</span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Similar to:</span>
                    {entry.matches.map((m, mi) => (
                      <div key={mi} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--card-bg)', borderRadius: '6px', marginTop: '4px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}
                          onClick={() => {
                            const updated = { ...bookrunnerDedupData };
                            updated.entries = [...updated.entries];
                            updated.entries[idx] = { ...updated.entries[idx], editedName: m.client.name };
                            setBookrunnerDedupData(updated);
                          }}
                          title="Click to use this name">{m.client.name}</span>
                        <span className="badge badge-warning" style={{ fontSize: '10px' }}>{Math.round(m.score * 100)}% match</span>
                      </div>
                    ))}
                  </div>
                  <div className="field-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>Use this name:</label>
                    <input type="text" className="form-input" style={{ fontSize: '13px' }} value={entry.editedName}
                      onChange={(e) => {
                        const updated = { ...bookrunnerDedupData };
                        updated.entries = [...updated.entries];
                        updated.entries[idx] = { ...updated.entries[idx], editedName: e.target.value };
                        setBookrunnerDedupData(updated);
                      }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-muted" onClick={() => { setShowBookrunnerDedupModal(false); setBookrunnerDedupData(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmBookrunnerDedup}>Confirm & Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ======================== DELETE CONFIRM MODAL ======================== */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '32px', maxWidth: '400px', width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '15px', marginBottom: '24px' }}>Delete <strong>{deleteConfirm.label}</strong>? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-muted" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={async () => {
                if (deleteConfirm.type === 'issue') await executeDeleteIssue(deleteConfirm.id);
                else if (deleteConfirm.type === 'order') await executeDeleteOrder(deleteConfirm.id);
                setDeleteConfirm(null);
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ======================== CLIENT FEEDBACK MODAL ======================== */}
      {showFeedbackModal && feedbackTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', maxWidth: '640px', width: '95%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Client Feedback</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  {feedbackTarget.issueName}
                  {feedbackTarget.trancheId && <span> — {feedbackTarget.trancheTenor} {feedbackTarget.trancheCurrency}</span>}
                </p>
              </div>
              <button className="btn-icon" onClick={closeFeedbackModal} style={{ fontSize: '18px', color: 'var(--text-muted)' }}>&#x2715;</button>
            </div>

            {/* Existing feedback entries */}
            {(() => {
              const entries = getModalFeedbackEntries();
              if (entries.length === 0) return (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--table-odd)', borderRadius: '8px', marginBottom: '16px' }}>
                  No feedback yet for this {feedbackTarget.trancheId ? 'tranche' : 'deal'}.
                </div>
              );
              return (
                <div style={{ marginBottom: '16px', maxHeight: '300px', overflowY: 'auto' }}>
                  {entries.map(entry => {
                    const sc = FEEDBACK_SENTIMENT_COLORS[entry.sentiment] || FEEDBACK_SENTIMENT_COLORS.UNDECIDED;
                    return (
                      <div key={entry.id} className="feedback-entry">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{entry.clientName}</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: sc.bg, color: sc.color, letterSpacing: '0.04em' }}>
                              {entry.sentiment}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {entry.createdBy} {entry.createdAt ? `· ${new Date(entry.createdAt).toLocaleDateString()}` : ''}
                            </span>
                            {(isAdmin || entry.createdBy === (userData.name || userData.email)) && (
                              <button className="btn-icon" onClick={() => handleDeleteFeedback(entry.id)} title="Delete" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>&#x2715;</button>
                            )}
                          </div>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>{entry.comment}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Add feedback form */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Add Feedback</h4>
              <form onSubmit={handleFeedbackSubmit}>
                {feedbackTarget.lockedClientName ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div className="field-group">
                      <label className="form-label">Client</label>
                      <div style={{ padding: '10px 12px', background: 'var(--table-odd)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {feedbackTarget.lockedClientName}
                      </div>
                    </div>
                    <div className="field-group">
                      <label className="form-label">Sentiment *</label>
                      <select className="form-select" value={feedbackForm.sentiment} onChange={e => setFeedbackForm({ ...feedbackForm, sentiment: e.target.value })}>
                        {FEEDBACK_SENTIMENTS.map(s => (
                          <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div className="field-group">
                      <label className="form-label">Client *</label>
                      <select className="form-select" value={feedbackForm.clientName} onChange={e => setFeedbackForm({ ...feedbackForm, clientName: e.target.value })}>
                        <option value="">Select Client</option>
                        {clients.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="form-label">Sentiment *</label>
                      <select className="form-select" value={feedbackForm.sentiment} onChange={e => setFeedbackForm({ ...feedbackForm, sentiment: e.target.value })}>
                        {FEEDBACK_SENTIMENTS.map(s => (
                          <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                <div className="field-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Feedback *</label>
                  <textarea className="form-textarea" rows="3" placeholder="e.g., Client likes the credit but wants tighter pricing..." value={feedbackForm.comment}
                    onChange={e => setFeedbackForm({ ...feedbackForm, comment: e.target.value })}
                    style={{ resize: 'vertical', minHeight: '60px' }} />
                </div>
                {feedbackError && <div className="form-error-banner" style={{ marginBottom: '12px' }}>{feedbackError}</div>}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-muted" onClick={closeFeedbackModal}>Close</button>
                  <button type="submit" className="btn btn-primary" disabled={feedbackLoading}>
                    {feedbackLoading ? 'Saving...' : 'Add Feedback'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ======================== NOTIFICATION TOAST ======================== */}
      {notification && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--card-bg)', border: '1px solid rgba(200,162,88,0.4)', borderRadius: '8px', padding: '12px 20px', color: 'var(--text-primary)', fontSize: '14px', zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', maxWidth: '320px' }}>
          {notification}
        </div>
      )}

      <style jsx>{`
        .app-container {
          min-height: 100vh;
          background: var(--bg-base);
          color: var(--text-primary);
        }

        .main-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 32px 24px;
        }

        .page-header {
          margin-bottom: 32px;
        }

        .page-title {
          font-size: 32px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .page-description {
          font-size: 16px;
          color: var(--text-secondary);
        }

        .sub-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 2px solid var(--border);
        }

        .sub-tab {
          padding: 12px 20px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: -2px;
        }

        .sub-tab:hover {
          color: var(--accent);
        }

        .sub-tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }

        .card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow);
        }

        .card-header {
          font-size: 17px;
          font-weight: 700;
          color: var(--text-primary);
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .form-grid {
          padding: 24px;
        }

        .field-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .field-group {
          display: flex;
          flex-direction: column;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 5px;
        }

        .form-input,
        .form-select,
        .form-textarea {
          width: 100%;
          padding: 10px 14px;
          background: var(--bg-input);
          border: 1.5px solid var(--border);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 14px;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          outline: none;
          border-color: var(--border-focus);
          background: var(--bg-input-focus);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }

        .form-textarea {
          resize: vertical;
        }

        .btn {
          padding: 10px 18px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13.5px;
          transition: all 0.2s ease;
          cursor: pointer;
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-family: inherit;
          white-space: nowrap;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--accent), var(--accent-hover));
          color: #fff;
          box-shadow: 0 2px 8px var(--accent-glow-strong);
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px var(--accent-glow-strong);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: var(--btn-secondary-bg);
          color: #fff;
          padding: 8px 14px;
          font-size: 13px;
        }

        .btn-secondary:hover {
          background: var(--btn-secondary-hover);
        }

        .btn-muted {
          background: var(--btn-muted-bg);
          color: var(--btn-muted-text);
        }

        .btn-muted:hover {
          background: var(--btn-muted-hover);
        }

        .btn-icon {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          padding: 4px;
          transition: transform 0.2s;
        }

        .btn-icon:hover {
          transform: scale(1.2);
        }

        .btn-edit {
          background: none;
          border: 1px solid var(--accent);
          border-radius: 6px;
          cursor: pointer;
          padding: 5px 7px;
          color: var(--accent);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .btn-edit:hover {
          background: var(--accent);
          color: #fff;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px var(--accent-glow);
        }

        .table-container {
          overflow-x: auto;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .table thead {
          background: var(--table-header-bg);
        }

        .table th {
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          color: var(--text-secondary);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--border);
        }

        .table td {
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
        }

        .table tbody tr:nth-child(odd) {
          background: var(--table-odd);
        }

        .table tbody tr:nth-child(even) {
          background: var(--table-even);
        }

        .table tbody tr:hover {
          background: var(--table-hover);
        }

        .badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          display: inline-block;
        }

        .badge-primary {
          background: var(--badge-primary-bg);
          color: var(--badge-primary-text);
        }

        .badge-warning {
          background: var(--badge-warning-bg);
          color: var(--badge-warning-text);
        }

        .spinner {
          display: inline-block;
          width: 10px;
          height: 10px;
          border: 2px solid var(--accent);
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .filter-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 24px;
          background: var(--table-header-bg);
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
        }

        .filter-search-wrap {
          position: relative;
          flex: 1;
          min-width: 180px;
        }

        .filter-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }

        .filter-input {
          width: 100%;
          padding: 7px 32px 7px 30px;
          background: var(--bg-input);
          border: 1.5px solid var(--border);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 13px;
          font-family: inherit;
          transition: border-color 0.2s;
        }

        .filter-input:focus {
          outline: none;
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }

        .filter-clear-x {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          font-size: 16px;
          line-height: 1;
          padding: 0;
          display: flex;
          align-items: center;
        }

        .filter-clear-x:hover { color: var(--text-primary); }

        .filter-select {
          padding: 7px 10px;
          background: var(--bg-input);
          border: 1.5px solid var(--border);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 13px;
          font-family: inherit;
          cursor: pointer;
        }

        .filter-select:focus {
          outline: none;
          border-color: var(--border-focus);
        }

        .form-error-banner{background:#fee2e2;border:1px solid #ef4444;color:#dc2626;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;}

        .btn-danger{background:#dc2626;color:#fff;padding:8px 14px;font-size:13px;}.btn-danger:hover{background:#b91c1c;}

        .feedback-btn {
          background: none;
          border: 1px solid var(--border);
          border-radius: 6px;
          cursor: pointer;
          padding: 5px 10px;
          color: var(--text-secondary);
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          transition: all 0.2s;
        }

        .feedback-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: var(--accent-glow);
        }

        .feedback-count {
          background: var(--accent);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          min-width: 18px;
          height: 18px;
          border-radius: 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
        }

        .feedback-entry {
          padding: 12px;
          background: var(--table-odd);
          border-radius: 8px;
          border: 1px solid var(--border);
          margin-bottom: 8px;
        }

        .feedback-entry:last-child {
          margin-bottom: 0;
        }

        @media (max-width: 768px) {
          .field-row {
            grid-template-columns: 1fr;
          }

          .card-header {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }

          .filter-bar {
            flex-direction: column;
            align-items: stretch;
          }

          .filter-search-wrap {
            min-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
