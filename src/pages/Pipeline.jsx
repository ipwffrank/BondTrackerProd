import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { collection, query, onSnapshot, addDoc, updateDoc, serverTimestamp, orderBy, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';
import { logAudit } from '../services/audit.service';
import { findSimilarClients } from '../utils/clientDedup';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'HKD', 'SGD', 'CNH'];
const TENOR_OPTIONS = ['2Y', '3Y', '5Y', '7Y', '10Y', '15Y', '20Y', '30Y'];
const CLIENT_TYPES = ['FUND', 'BANK', 'INSURANCE', 'PENSION', 'SOVEREIGN'];
const CLIENT_REGIONS = ['APAC', 'EMEA', 'AMERICAS'];

const EMPTY_TRANCHE = { tenor: '', currency: 'USD', targetSize: '' };
const EMPTY_NEW_ISSUE_FORM = {
  issuerName: '',
  bookrunners: { JPM: false, GS: false, MS: false, HSBC: false, SCB: false, BOCHK: false, other: false },
  otherBookrunner: '',
  tranches: [{ ...EMPTY_TRANCHE }]
};
const EMPTY_ORDER_FORM = { issueId: '', trancheId: '', clientName: '', orderSize: '', orderLimit: '', notes: '' };
const EMPTY_CLIENT_FORM = { name: '', type: 'FUND', region: 'APAC', salesCoverage: '' };

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

  useEffect(() => {
    if (!userData?.organizationId) { setLoading(false); return; }
    const unsubscribes = [];
    try {
      // New Issues with tranches
      const newIssuesRef = collection(db, `organizations/${userData.organizationId}/newIssues`);
      const newIssuesQuery = query(newIssuesRef, orderBy('createdAt', 'desc'));
      const newIssuesUnsub = onSnapshot(newIssuesQuery, async (snapshot) => {
        const issues = [];
        for (const docSnap of snapshot.docs) {
          const issueData = { id: docSnap.id, ...docSnap.data(), createdAt: docSnap.data().createdAt?.toDate() };
          // Load tranches sub-collection
          const tranchesRef = collection(db, `organizations/${userData.organizationId}/newIssues/${docSnap.id}/tranches`);
          const tranchesSnap = await getDocs(tranchesRef);
          issueData.tranches = tranchesSnap.docs.map(t => ({ id: t.id, ...t.data() }));
          issues.push(issueData);
        }
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
    } catch (error) { console.error('Setup error:', error); setLoading(false); }
    return () => unsubscribes.forEach(unsub => unsub());
  }, [userData?.organizationId]);

  // ============ ISSUER DEDUP ============
  function findSimilarIssuers(name) {
    if (!name || !newIssues.length) return [];
    const issuersAsClients = newIssues.map(i => ({ id: i.id, name: i.issuerName }));
    return findSimilarClients(name, issuersAsClients);
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

    await saveIssue(newIssueForm);
  }

  async function saveIssue(formData) {
    setSubmitLoading(true);
    try {
      const selectedBookrunners = Object.entries(formData.bookrunners)
        .filter(([, value]) => value)
        .map(([key]) => key === 'other' ? formData.otherBookrunner : key)
        .filter(Boolean);

      if (editingIssue) {
        // Update existing issue
        const issueRef = doc(db, `organizations/${userData.organizationId}/newIssues`, editingIssue);
        await updateDoc(issueRef, {
          issuerName: formData.issuerName,
          bookrunners: selectedBookrunners,
          updatedAt: serverTimestamp(),
          updatedBy: userData.name || userData.email
        });
        // Delete old tranches, add new ones
        const oldTranchesRef = collection(db, `organizations/${userData.organizationId}/newIssues/${editingIssue}/tranches`);
        const oldTranches = await getDocs(oldTranchesRef);
        for (const t of oldTranches.docs) { await deleteDoc(t.ref); }
        for (const t of formData.tranches) {
          await addDoc(oldTranchesRef, { tenor: t.tenor, currency: t.currency, targetSize: parseFloat(t.targetSize) || 0 });
        }
        setEditingIssue(null);
      } else {
        // Create new issue
        const newIssuesRef = collection(db, `organizations/${userData.organizationId}/newIssues`);
        const issueDoc = await addDoc(newIssuesRef, {
          issuerName: formData.issuerName,
          bookrunners: selectedBookrunners,
          createdAt: serverTimestamp(),
          createdBy: userData.name || userData.email
        });
        // Add tranches as sub-collection
        const tranchesRef = collection(db, `organizations/${userData.organizationId}/newIssues/${issueDoc.id}/tranches`);
        for (const t of formData.tranches) {
          await addDoc(tranchesRef, { tenor: t.tenor, currency: t.currency, targetSize: parseFloat(t.targetSize) || 0 });
        }
      }

      setFormError('');
      setNewIssueForm({ ...EMPTY_NEW_ISSUE_FORM, tranches: [{ ...EMPTY_TRANCHE }] });
    } catch (error) {
      console.error('Error saving new issue:', error);
      alert('Failed to save new issue');
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
    if (!isAdmin) { alert('Only org admins can edit issues.'); return; }
    const bookrunners = { JPM: false, GS: false, MS: false, HSBC: false, SCB: false, BOCHK: false, other: false };
    let otherBookrunner = '';
    (issue.bookrunners || []).forEach(b => {
      if (bookrunners.hasOwnProperty(b)) bookrunners[b] = true;
      else { bookrunners.other = true; otherBookrunner = b; }
    });
    setNewIssueForm({
      issuerName: issue.issuerName,
      bookrunners,
      otherBookrunner,
      tranches: (issue.tranches || []).map(t => ({ tenor: t.tenor, currency: t.currency, targetSize: String(t.targetSize) }))
    });
    if (newIssueForm.tranches?.length === 0) {
      setNewIssueForm(prev => ({ ...prev, tranches: [{ ...EMPTY_TRANCHE }] }));
    }
    setEditingIssue(issue.id);
    setActiveSubTab('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEditIssue() {
    setEditingIssue(null);
    setNewIssueForm({ ...EMPTY_NEW_ISSUE_FORM, tranches: [{ ...EMPTY_TRANCHE }] });
  }

  // ============ DELETE ISSUE ============
  async function handleDeleteNewIssue(issueId) {
    if (!isAdmin) { alert('Only org admins can delete issues.'); return; }
    if (!window.confirm('Are you sure you want to delete this issue and all its tranches?')) return;
    try {
      // Delete tranches first
      const tranchesRef = collection(db, `organizations/${userData.organizationId}/newIssues/${issueId}/tranches`);
      const tranchesSnap = await getDocs(tranchesRef);
      for (const t of tranchesSnap.docs) { await deleteDoc(t.ref); }
      await deleteDoc(doc(db, `organizations/${userData.organizationId}/newIssues`, issueId));
    } catch (error) { console.error('Error deleting issue:', error); alert('Failed to delete issue'); }
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
    } catch (error) { console.error('Error saving order:', error); alert('Failed to save order'); }
    finally { setSubmitLoading(false); }
  }

  async function handleDeleteOrder(orderId) {
    if (!isAdmin) { alert('Only org admins can delete orders.'); return; }
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    try { await deleteDoc(doc(db, `organizations/${userData.organizationId}/orderBooks`, orderId)); }
    catch (error) { console.error('Error deleting order:', error); alert('Failed to delete order'); }
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

  async function handleBulkDeleteIssues() {
    if (selectedIssueIds.size === 0) return;
    if (!isAdmin) { alert('Only org admins can delete issues.'); return; }
    if (!window.confirm(`Delete ${selectedIssueIds.size} selected issue${selectedIssueIds.size === 1 ? '' : 's'}?`)) return;
    try {
      for (const id of selectedIssueIds) {
        const tranchesRef = collection(db, `organizations/${userData.organizationId}/newIssues/${id}/tranches`);
        const tranchesSnap = await getDocs(tranchesRef);
        for (const t of tranchesSnap.docs) { await deleteDoc(t.ref); }
        await deleteDoc(doc(db, `organizations/${userData.organizationId}/newIssues`, id));
      }
      setSelectedIssueIds(new Set());
    } catch (e) { console.error(e); alert('Failed to delete some issues'); }
  }

  const filteredNewIssues = newIssues.filter(i => {
    if (filterIssueCurrency) {
      const hasCurrency = i.tranches?.some(t => t.currency === filterIssueCurrency);
      if (!hasCurrency) return false;
    }
    if (issueSearch) {
      const q = issueSearch.toLowerCase();
      return i.issuerName?.toLowerCase().includes(q) || i.bookrunners?.join(' ').toLowerCase().includes(q) || i.createdBy?.toLowerCase().includes(q);
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
      const target = t.targetSize || 0;
      const pct = target > 0 ? Math.round((total / target) * 100) : 0;
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
          currency: t.currency,
          bookrunners: issue.bookrunners?.join(', ') || '-',
          createdBy: issue.createdBy
        });
      });
    });
    const columns = [
      { header: 'Date', field: 'createdAt' }, { header: 'Issuer', field: 'issuerName' },
      { header: 'Tenor', field: 'tenor' }, { header: 'Target Size (MM)', field: 'targetIssueSize' },
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
          currency: t.currency,
          bookrunners: issue.bookrunners?.join(', ') || '-',
          createdBy: issue.createdBy
        });
      });
    });
    const columns = [
      { header: 'Date', field: 'createdAt' }, { header: 'Issuer', field: 'issuerName' },
      { header: 'Tenor', field: 'tenor' }, { header: 'Target Size (MM)', field: 'targetIssueSize' },
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
            <h1 className="page-title">Pipeline</h1>
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
                  <span>{editingIssue ? 'Edit Issue' : 'Create New Issue'}</span>
                  {editingIssue && <button className="btn btn-muted" onClick={cancelEditIssue}>Cancel Edit</button>}
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
                        <label className="form-label">Bookrunners</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                          {Object.keys(newIssueForm.bookrunners).map(key => (
                            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={newIssueForm.bookrunners[key]}
                                onChange={(e) => setNewIssueForm({ ...newIssueForm, bookrunners: { ...newIssueForm.bookrunners, [key]: e.target.checked } })}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{key.toUpperCase()}</span>
                            </label>
                          ))}
                        </div>
                        {newIssueForm.bookrunners.other && (
                          <input type="text" className="form-input" placeholder="Specify other bookrunner" value={newIssueForm.otherBookrunner}
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
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', marginBottom: '10px', padding: '12px', background: 'var(--table-odd)', borderRadius: '8px', border: '1px solid var(--border)' }}>
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
                            <label className="form-label">Target Size (MM) *</label>
                            <input type="number" step="0.01" className="form-input" placeholder="e.g., 500" value={tranche.targetSize}
                              onChange={(e) => updateTranche(idx, 'targetSize', e.target.value)} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                            {newIssueForm.tranches.length > 1 && (
                              <button type="button" className="btn-icon" onClick={() => removeTranche(idx)} title="Remove tranche" style={{ color: '#dc2626' }}>x</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)' }}>
                    {formError && <div className="form-error-banner">{formError}</div>}
                    <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                      {submitLoading ? (editingIssue ? 'Updating...' : 'Adding...') : (editingIssue ? 'Update Issue' : '+ Add New Issue')}
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
                              <td style={{ fontWeight: 600 }}>{issue.issuerName}</td>
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
                                    <button className="btn-icon" onClick={() => handleEditIssue(issue)} title="Edit">&#9998;</button>
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
                                    <span style={{ marginLeft: '8px', fontSize: '13px' }}>{t.targetSize}MM target</span>
                                  </td>
                                  <td colSpan={isAdmin ? 3 : 2}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <div style={{ flex: 1, background: 'var(--border)', borderRadius: '4px', height: '8px', maxWidth: '150px' }}>
                                        <div style={{ width: `${Math.min(s?.pct || 0, 100)}%`, background: (s?.pct || 0) >= 100 ? '#22c55e' : 'var(--accent)', height: '100%', borderRadius: '4px', transition: 'width 0.3s' }}></div>
                                      </div>
                                      <span style={{ fontSize: '12px', fontWeight: 600, color: (s?.pct || 0) >= 100 ? '#22c55e' : 'var(--text-secondary)' }}>
                                        {s?.orderTotal || 0}MM / {t.targetSize}MM ({s?.pct || 0}%)
                                      </span>
                                    </div>
                                  </td>
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
                    const pct = tranche.targetSize > 0 ? Math.round((projectedTotal / tranche.targetSize) * 100) : 0;
                    return (
                      <div style={{ padding: '12px', background: 'var(--table-header-bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                          Book Status: {selectedIssueForOrder?.issuerName} {tranche.tenor} {tranche.currency}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ flex: 1, background: 'var(--border)', borderRadius: '4px', height: '10px' }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? '#22c55e' : 'var(--accent)', height: '100%', borderRadius: '4px', transition: 'width 0.3s' }}></div>
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: pct >= 100 ? '#22c55e' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            {projectedTotal}MM / {tranche.targetSize}MM ({pct}%)
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
                <span>Order Book ({orderBooks.length})</span>
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
                      <th>Created By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderBooks.length === 0 ? (
                      <tr>
                        <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          No orders yet. Add your first order above!
                        </td>
                      </tr>
                    ) : (
                      orderBooks.map((order) => (
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
                            <td>{order.createdBy}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn-icon" onClick={() => startEditOrder(order)} title="Edit">&#9998;</button>
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
