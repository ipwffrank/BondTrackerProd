import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, limit, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function Dashboard() {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  
  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('bondtracker-theme') || 'dark';
  });

  // Active tab state
  const [activeTab, setActiveTab] = useState('activity');
  const [newIssuesSubTab, setNewIssuesSubTab] = useState('create'); // 'create' or 'orderbook'

  // Activity form state
  const [activityForm, setActivityForm] = useState({
    clientName: '',
    activityType: '',
    isin: '',
    ticker: '',
    size: '',
    currency: 'USD',
    otherCurrency: '',
    price: '',
    direction: '',
    status: '',
    notes: ''
  });

  // New Issues form state
  const [newIssueForm, setNewIssueForm] = useState({
    issuerName: '',
    targetIssueSize: '',
    currency: 'USD',
    bookrunners: {
      JPM: false,
      GS: false,
      MS: false,
      HSBC: false,
      SCB: false,
      BOCHK: false,
      other: false
    },
    otherBookrunner: ''
  });

  // Order Book form state
  const [orderBookForm, setOrderBookForm] = useState({
    clientName: '',
    orderSize: '',
    orderLimit: '',
    notes: ''
  });

  // Client form state
  const [clientForm, setClientForm] = useState({
    name: '',
    type: 'FUND',
    region: 'APAC',
    salesCoverage: ''
  });

  // Data state
  const [activities, setActivities] = useState([]);
  const [newIssues, setNewIssues] = useState([]);
  const [orderBooks, setOrderBooks] = useState([]);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({
    totalActivities: 0,
    totalVolume: 0,
    buyCount: 0,
    sellCount: 0,
    twoWayCount: 0
  });

  // AI Analysis state
  const [aiFile, setAiFile] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState([]);
  const [aiError, setAiError] = useState('');

  // Edit mode states
  const [editingActivity, setEditingActivity] = useState(null);
  const [editingClient, setEditingClient] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [bondLookupLoading, setBondLookupLoading] = useState(false);

  // Theme toggle
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('bondtracker-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Auto-fill client details when client name is selected
  useEffect(() => {
    if (activityForm.clientName) {
      const client = clients.find(c => c.name === activityForm.clientName);
      if (client) {
        // Auto-fill fields (these won't be in the form, but displayed separately)
        // We'll handle this in the render
      }
    }
  }, [activityForm.clientName, clients]);

  // Load data
  useEffect(() => {
    if (!userData?.organizationId) {
      setLoading(false);
      return;
    }

    const unsubscribes = [];

    try {
      // Activities
      const activitiesRef = collection(db, `organizations/${userData.organizationId}/activities`);
      const activitiesQuery = query(activitiesRef, orderBy('createdAt', 'desc'), limit(100));
      
      const activitiesUnsub = onSnapshot(activitiesQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }));
        
        setActivities(data);
        
        // Calculate stats
        const totalActivities = data.length;
        const totalVolume = data.reduce((sum, a) => sum + (parseFloat(a.size) || 0), 0);
        const buyCount = data.filter(a => a.direction === 'BUY').length;
        const sellCount = data.filter(a => a.direction === 'SELL').length;
        const twoWayCount = data.filter(a => a.direction === 'TWO-WAY').length;
        
        setStats({ totalActivities, totalVolume: totalVolume.toFixed(2), buyCount, sellCount, twoWayCount });
        setLoading(false);
      });
      unsubscribes.push(activitiesUnsub);

      // New Issues
      const newIssuesRef = collection(db, `organizations/${userData.organizationId}/newIssues`);
      const newIssuesQuery = query(newIssuesRef, orderBy('createdAt', 'desc'), limit(50));
      
      const newIssuesUnsub = onSnapshot(newIssuesQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }));
        setNewIssues(data);
      });
      unsubscribes.push(newIssuesUnsub);

      // Order Books
      const orderBooksRef = collection(db, `organizations/${userData.organizationId}/orderBooks`);
      const orderBooksQuery = query(orderBooksRef, orderBy('createdAt', 'desc'), limit(50));
      
      const orderBooksUnsub = onSnapshot(orderBooksQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }));
        setOrderBooks(data);
      });
      unsubscribes.push(orderBooksUnsub);

      // Clients
      const clientsRef = collection(db, `organizations/${userData.organizationId}/clients`);
      const clientsQuery = query(clientsRef, orderBy('name', 'asc'));
      
      const clientsUnsub = onSnapshot(clientsQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setClients(data);
      });
      unsubscribes.push(clientsUnsub);

    } catch (error) {
      console.error('Setup error:', error);
      setLoading(false);
    }

    return () => unsubscribes.forEach(unsub => unsub());
  }, [userData?.organizationId]);

  // ============================================
  // BLOOMBERG AUTO-FILL useEffect
  // ============================================
  
  // Auto-fill ISIN when ticker is entered (and vice versa)
  useEffect(() => {
    // Don't run during edit mode - only for new entries
    if (editingActivity) return;
    
    // Debounce to avoid too many API calls while user is typing
    const timeoutId = setTimeout(async () => {
      // Only fetch if we have one but not the other
      if (activityForm.isin && !activityForm.ticker) {
        // User entered ISIN, fetch ticker
        await fetchBondDetails('isin', activityForm.isin);
      } else if (activityForm.ticker && !activityForm.isin) {
        // User entered ticker, fetch ISIN
        await fetchBondDetails('ticker', activityForm.ticker);
      }
    }, 800); // Wait 800ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [activityForm.isin, activityForm.ticker, editingActivity]);

  // Helper function to fetch bond details from Bloomberg API
  async function fetchBondDetails(searchType, searchValue) {
    if (!searchValue || searchValue.length < 2) return;

    setBondLookupLoading(true);

    try {
      const payload = searchType === 'isin' 
        ? { isin: searchValue }
        : { ticker: searchValue };

      const response = await fetch('/.netlify/functions/bloomberg-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        // If not found, silently fail (don't show error to user)
        if (response.status === 404) {
          console.log(`${searchType} not found:`, searchValue);
          return;
        }
        throw new Error('Bloomberg lookup failed');
      }

      const result = await response.json();

      if (result.success && result.data) {
        const bond = result.data;
        
        // Update form with fetched data (without overwriting what user typed)
        setActivityForm(prev => {
          // Don't overwrite if user has manually entered both
          if (prev.isin && prev.ticker) return prev;
          
          return {
            ...prev,
            // Only update empty fields
            isin: prev.isin || bond.isin || '',
            ticker: prev.ticker || bond.ticker || ''
          };
        });

        // Optional: Show success in console
        console.log('✅ Bond details fetched:', {
          isin: bond.isin,
          ticker: bond.ticker,
          name: bond.bondName
        });
      }
    } catch (error) {
      console.error('Error fetching bond details:', error);
      // Fail silently - user can still submit manually
    } finally {
      setBondLookupLoading(false);
    }
  }

  // Handle logout
  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Get selected client details
  const getSelectedClient = () => {
    return clients.find(c => c.name === activityForm.clientName);
  };

  // Submit activity
  async function handleActivitySubmit(e) {
    e.preventDefault();
    if (!userData?.organizationId) return;

    const selectedClient = getSelectedClient();
    
    setSubmitLoading(true);
    try {
      const activitiesRef = collection(db, `organizations/${userData.organizationId}/activities`);
      
      const activityData = {
        clientName: activityForm.clientName,
        clientType: selectedClient?.type || '',
        clientRegion: selectedClient?.region || '',
        salesCoverage: selectedClient?.salesCoverage || '',
        activityType: activityForm.activityType,
        isin: activityForm.isin.toUpperCase(),
        ticker: activityForm.ticker.toUpperCase(),
        size: parseFloat(activityForm.size) || 0,
        currency: activityForm.currency === 'OTHER' ? activityForm.otherCurrency : activityForm.currency,
        price: activityForm.price ? parseFloat(activityForm.price) : null,
        direction: activityForm.direction,
        status: activityForm.status,
        notes: activityForm.notes,
        createdAt: serverTimestamp(),
        createdBy: userData.name || userData.email
      };

      if (editingActivity) {
        // Update existing activity
        await updateDoc(doc(db, `organizations/${userData.organizationId}/activities`, editingActivity), activityData);
        setEditingActivity(null);
        alert('Activity updated successfully!');
      } else {
        // Add new activity
        await addDoc(activitiesRef, activityData);
        alert('Activity added successfully!');
      }

      // Reset form
      setActivityForm({
        clientName: '',
        activityType: '',
        isin: '',
        ticker: '',
        size: '',
        currency: 'USD',
        otherCurrency: '',
        price: '',
        direction: '',
        status: '',
        notes: ''
      });

    } catch (error) {
      console.error('Error saving activity:', error);
      alert('Failed to save activity');
    } finally {
      setSubmitLoading(false);
    }
  }

  // Delete activity
  async function handleDeleteActivity(activityId) {
    if (!window.confirm('Are you sure you want to delete this activity?')) return;
    
    try {
      await deleteDoc(doc(db, `organizations/${userData.organizationId}/activities`, activityId));
      alert('Activity deleted successfully!');
    } catch (error) {
      console.error('Error deleting activity:', error);
      alert('Failed to delete activity');
    }
  }

  // Edit activity
  function handleEditActivity(activity) {
    setActivityForm({
      clientName: activity.clientName,
      activityType: activity.activityType,
      isin: activity.isin,
      ticker: activity.ticker,
      size: activity.size.toString(),
      currency: ['USD', 'EUR', 'GBP', 'AUD', 'HKD', 'SGD', 'CNH'].includes(activity.currency) ? activity.currency : 'OTHER',
      otherCurrency: ['USD', 'EUR', 'GBP', 'AUD', 'HKD', 'SGD', 'CNH'].includes(activity.currency) ? '' : activity.currency,
      price: activity.price?.toString() || '',
      direction: activity.direction,
      status: activity.status,
      notes: activity.notes || ''
    });
    setEditingActivity(activity.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Submit new issue
  async function handleNewIssueSubmit(e) {
    e.preventDefault();
    if (!userData?.organizationId) return;

    setSubmitLoading(true);
    try {
      const newIssuesRef = collection(db, `organizations/${userData.organizationId}/newIssues`);
      
      const bookrunnersList = Object.keys(newIssueForm.bookrunners)
        .filter(key => newIssueForm.bookrunners[key])
        .map(key => key === 'other' ? newIssueForm.otherBookrunner : key);

      await addDoc(newIssuesRef, {
        issuerName: newIssueForm.issuerName,
        targetIssueSize: parseFloat(newIssueForm.targetIssueSize) || 0,
        currency: newIssueForm.currency,
        bookrunners: bookrunnersList,
        createdAt: serverTimestamp(),
        createdBy: userData.name || userData.email
      });

      // Reset form
      setNewIssueForm({
        issuerName: '',
        targetIssueSize: '',
        currency: 'USD',
        bookrunners: {
          JPM: false,
          GS: false,
          MS: false,
          HSBC: false,
          SCB: false,
          BOCHK: false,
          other: false
        },
        otherBookrunner: ''
      });

      alert('New issue added successfully!');
    } catch (error) {
      console.error('Error adding new issue:', error);
      alert('Failed to add new issue');
    } finally {
      setSubmitLoading(false);
    }
  }

  // Submit order book entry
  async function handleOrderBookSubmit(e) {
    e.preventDefault();
    if (!userData?.organizationId) return;

    setSubmitLoading(true);
    try {
      const orderBooksRef = collection(db, `organizations/${userData.organizationId}/orderBooks`);
      await addDoc(orderBooksRef, {
        ...orderBookForm,
        orderSize: parseFloat(orderBookForm.orderSize) || 0,
        createdAt: serverTimestamp(),
        createdBy: userData.name || userData.email
      });

      // Reset form
      setOrderBookForm({
        clientName: '',
        orderSize: '',
        orderLimit: '',
        notes: ''
      });

      alert('Order book entry added successfully!');
    } catch (error) {
      console.error('Error adding order book entry:', error);
      alert('Failed to add order book entry');
    } finally {
      setSubmitLoading(false);
    }
  }

  // Submit client
  async function handleClientSubmit(e) {
    e.preventDefault();
    if (!userData?.organizationId) return;

    setSubmitLoading(true);
    try {
      const clientsRef = collection(db, `organizations/${userData.organizationId}/clients`);
      
      if (editingClient) {
        // Update existing client
        await updateDoc(doc(db, `organizations/${userData.organizationId}/clients`, editingClient), {
          ...clientForm,
          updatedAt: serverTimestamp(),
          updatedBy: userData.name || userData.email
        });
        setEditingClient(null);
        alert('Client updated successfully!');
      } else {
        // Add new client
        await addDoc(clientsRef, {
          ...clientForm,
          createdAt: serverTimestamp(),
          createdBy: userData.name || userData.email
        });
        alert('Client added successfully!');
      }

      // Reset form
      setClientForm({
        name: '',
        type: 'FUND',
        region: 'APAC',
        salesCoverage: ''
      });

    } catch (error) {
      console.error('Error saving client:', error);
      alert('Failed to save client');
    } finally {
      setSubmitLoading(false);
    }
  }

  // Delete client (admin only)
  async function handleDeleteClient(clientId) {
    if (!userData?.isAdmin) {
      alert('Only admins can delete clients');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    
    try {
      await deleteDoc(doc(db, `organizations/${userData.organizationId}/clients`, clientId));
      alert('Client deleted successfully!');
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Failed to delete client');
    }
  }

  // Edit client
  function handleEditClient(client) {
    setClientForm({
      name: client.name,
      type: client.type,
      region: client.region,
      salesCoverage: client.salesCoverage || ''
    });
    setEditingClient(client.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Export clients to Excel
  async function exportClientsToExcel() {
    // This would use a library like xlsx
    alert('Excel export feature - integrate with xlsx library');
  }

  // Export clients to PDF
  async function exportClientsToPDF() {
    // This would use a library like jsPDF
    alert('PDF export feature - integrate with jsPDF library');
  }

  // AI Analysis
  async function handleAiAnalysis() {
    if (!aiFile) return;

    setAiAnalyzing(true);
    setAiError('');
    setAiResults([]);

    try {
      const text = await aiFile.text();
      
      const response = await fetch('/.netlify/functions/analyze-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'AI analysis failed');
      }

      setAiResults(result.activities || []);
      if (result.activities?.length === 0) {
        setAiError('No activities detected in the transcript');
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      setAiError(error.message);
    } finally {
      setAiAnalyzing(false);
    }
  }

  // Import AI results
  async function handleImportAiResults() {
    if (!userData?.organizationId || aiResults.length === 0) return;

    setSubmitLoading(true);
    try {
      const activitiesRef = collection(db, `organizations/${userData.organizationId}/activities`);
      
      for (const activity of aiResults) {
        // Try to find matching client
        const matchingClient = clients.find(c => c.name.toUpperCase() === activity.clientName?.toUpperCase());
        
        await addDoc(activitiesRef, {
          clientName: activity.clientName || 'UNKNOWN',
          clientType: matchingClient?.type || '',
          clientRegion: matchingClient?.region || '',
          salesCoverage: matchingClient?.salesCoverage || '',
          activityType: 'Bloomberg Chat', // Default for AI imports
          isin: activity.isin || '',
          ticker: activity.ticker || '',
          size: parseFloat(activity.size) || 0,
          currency: activity.currency || 'USD',
          price: parseFloat(activity.price) || null,
          direction: activity.direction || '',
          status: 'ENQUIRY',
          notes: activity.notes || 'Imported from AI analysis',
          createdAt: serverTimestamp(),
          createdBy: `${userData.name || userData.email} (AI Import)`
        });
      }

      alert(`Imported ${aiResults.length} activities successfully!`);
      setAiResults([]);
      setAiFile(null);
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import activities');
    } finally {
      setSubmitLoading(false);
    }
  }

  // Helper functions
  const getDirectionBadge = (direction) => {
    const badges = {
      'BUY': 'badge-success',
      'SELL': 'badge-danger',
      'TWO-WAY': 'badge-warning'
    };
    return badges[direction] || 'badge-primary';
  };

  const getStatusBadge = (status) => {
    const badges = {
      'ENQUIRY': 'badge-primary',
      'QUOTED': 'badge-warning',
      'EXECUTED': 'badge-success',
      'PASSED': 'badge-danger',
      'TRADED AWAY': 'badge-danger'
    };
    return badges[status] || 'badge-primary';
  };

  return (
    <div className="app-container">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-content">
          <div className="nav-left">
            <div className="logo">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="6" fill="currentColor"/>
                <text x="16" y="22" textAnchor="middle" fontFamily="sans-serif" fontWeight="700" fontSize="18" fill="white">B</text>
              </svg>
              <span>BondTracker</span>
            </div>
            
            <div className="nav-links">
              <button 
                className={`nav-link ${activeTab === 'activity' ? 'active' : ''}`}
                onClick={() => setActiveTab('activity')}
              >
                Dashboard
              </button>
              <Link to="/activities" className="nav-link">Activities</Link>
              <Link to="/clients" className="nav-link">Clients</Link>
              <Link to="/analytics" className="nav-link">Analytics</Link>
              <Link to="/pipeline" className="nav-link">Pipeline</Link>
              {userData?.isAdmin && (
                <Link to="/team" className="nav-link">Team</Link>
              )}
            </div>
          </div>

          <div className="nav-right">
            <button onClick={toggleTheme} className="theme-toggle" title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            
            <div className="user-info">
              <div className="user-details">
                <div className="user-name">{userData?.name || 'Frank'}</div>
                <div className="user-org">{userData?.organizationName || 'Maybank'}</div>
              </div>
              {userData?.isAdmin && (
                <span className="badge badge-primary">Admin</span>
              )}
            </div>

            <button onClick={handleLogout} className="btn btn-danger">
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {/* Tabs */}
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            Activity Log
          </button>
          <button 
            className={`tab ${activeTab === 'newissues' ? 'active' : ''}`}
            onClick={() => setActiveTab('newissues')}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            New Issues
          </button>
          <button 
            className={`tab ${activeTab === 'clients' ? 'active' : ''}`}
            onClick={() => setActiveTab('clients')}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            Clients
          </button>
          <button 
            className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            Analytics
          </button>
          <button 
            className={`tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
            AI Assistant
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {/* Activity Log Tab */}
          {activeTab === 'activity' && (
            <div>
              {/* Activity Form Card */}
              <div className="card">
                <div className="card-header">
                  <span>📋 {editingActivity ? 'Edit Activity' : 'New Activity'}</span>
                  {editingActivity && (
                    <button 
                      className="btn btn-muted"
                      onClick={() => {
                        setEditingActivity(null);
                        setActivityForm({
                          clientName: '',
                          activityType: '',
                          isin: '',
                          ticker: '',
                          size: '',
                          currency: 'USD',
                          otherCurrency: '',
                          price: '',
                          direction: '',
                          status: '',
                          notes: ''
                        });
                      }}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
                
                <form onSubmit={handleActivitySubmit}>
                  <div className="single-panel-form">
                    <div className="form-section">
                      <div className="field-row">
                        <div className="field-group">
                          <label className="form-label">Client Name *</label>
                          <select
                            className="form-select"
                            value={activityForm.clientName}
                            onChange={(e) => setActivityForm({...activityForm, clientName: e.target.value})}
                            required
                          >
                            <option value="">Select Client</option>
                            {clients.map(client => (
                              <option key={client.id} value={client.name}>{client.name}</option>
                            ))}
                          </select>
                          {activityForm.clientName && getSelectedClient() && (
                            <div className="auto-filled-info">
                              Type: {getSelectedClient().type} | Region: {getSelectedClient().region} | Coverage: {getSelectedClient().salesCoverage || 'N/A'}
                            </div>
                          )}
                        </div>

                        <div className="field-group">
                          <label className="form-label">Activity Type *</label>
                          <select
                            className="form-select"
                            value={activityForm.activityType}
                            onChange={(e) => setActivityForm({...activityForm, activityType: e.target.value})}
                            required
                          >
                            <option value="">Select Type</option>
                            <option value="Phone Call">Phone Call</option>
                            <option value="Email">Email</option>
                            <option value="Meeting">Meeting</option>
                            <option value="Bloomberg Chat">Bloomberg Chat</option>
                          </select>
                        </div>
                      </div>

                      <div className="field-row">
                        <div className="field-group">
                          <label className="form-label">ISIN</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="US0378331005"
                            value={activityForm.isin}
                            onChange={(e) => setActivityForm({...activityForm, isin: e.target.value.toUpperCase()})}
                          />
                        </div>

                        <div className="field-group">
                          <label className="form-label">Ticker</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="AAPL"
                            value={activityForm.ticker}
                            onChange={(e) => setActivityForm({...activityForm, ticker: e.target.value.toUpperCase()})}
                          />
                          <div className="form-hint">Enter ISIN or Ticker - other auto-fills via Bloomberg API</div>
                          {bondLookupLoading && (
                            <div style={{
                              fontSize: '11px', 
                              color: 'var(--accent)', 
                              marginTop: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <span className="spinner"></span>
                              Looking up bond details...
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="field-row">
                        <div className="field-group">
                          <label className="form-label">Size (MM) *</label>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            value={activityForm.size}
                            onChange={(e) => setActivityForm({...activityForm, size: e.target.value})}
                            required
                          />
                        </div>

                        <div className="field-group">
                          <label className="form-label">Currency *</label>
                          <select
                            className="form-select"
                            value={activityForm.currency}
                            onChange={(e) => setActivityForm({...activityForm, currency: e.target.value})}
                            required
                          >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                            <option value="AUD">AUD</option>
                            <option value="HKD">HKD</option>
                            <option value="SGD">SGD</option>
                            <option value="CNH">CNH</option>
                            <option value="OTHER">Other</option>
                          </select>
                          {activityForm.currency === 'OTHER' && (
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Specify currency"
                              value={activityForm.otherCurrency}
                              onChange={(e) => setActivityForm({...activityForm, otherCurrency: e.target.value.toUpperCase()})}
                              style={{marginTop: '8px'}}
                            />
                          )}
                        </div>
                      </div>

                      <div className="field-row">
                        <div className="field-group">
                          <label className="form-label">Price</label>
                          <input
                            type="number"
                            step="0.0001"
                            className="form-input"
                            placeholder="98.75"
                            value={activityForm.price}
                            onChange={(e) => setActivityForm({...activityForm, price: e.target.value})}
                          />
                        </div>

                        <div className="field-group">
                          <label className="form-label">Direction *</label>
                          <select
                            className="form-select"
                            value={activityForm.direction}
                            onChange={(e) => setActivityForm({...activityForm, direction: e.target.value})}
                            required
                          >
                            <option value="">Select Direction</option>
                            <option value="BUY">Buy</option>
                            <option value="SELL">Sell</option>
                            <option value="TWO-WAY">Two Way</option>
                          </select>
                        </div>
                      </div>

                      <div className="field-row">
                        <div className="field-group">
                          <label className="form-label">Status *</label>
                          <select
                            className="form-select"
                            value={activityForm.status}
                            onChange={(e) => setActivityForm({...activityForm, status: e.target.value})}
                            required
                          >
                            <option value="">Select Status</option>
                            <option value="ENQUIRY">Enquiry</option>
                            <option value="QUOTED">Quoted</option>
                            <option value="EXECUTED">Executed</option>
                            <option value="PASSED">Passed</option>
                            <option value="TRADED AWAY">Traded Away</option>
                          </select>
                        </div>

                        <div className="field-group">
                          <label className="form-label">Notes</label>
                          <textarea
                            className="form-textarea"
                            rows="2"
                            value={activityForm.notes}
                            onChange={(e) => setActivityForm({...activityForm, notes: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{padding: '20px 24px', borderTop: '1px solid var(--border)'}}>
                    <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                      {submitLoading ? (editingActivity ? 'Updating...' : 'Adding...') : (editingActivity ? 'Update Activity' : '+ Add Activity')}
                    </button>
                  </div>
                </form>
              </div>

              {/* Activity History */}
              <div className="card" style={{marginTop: '24px'}}>
                <div className="card-header">
                  <span>Activity History ({stats.totalActivities})</span>
                  <div style={{fontSize: '13px', color: 'var(--text-muted)'}}>
                    Total Volume: ${stats.totalVolume}MM
                  </div>
                </div>
                
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Client</th>
                        <th>Type</th>
                        <th>ISIN/Ticker</th>
                        <th>Size</th>
                        <th>Currency</th>
                        <th>Direction</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.length === 0 ? (
                        <tr>
                          <td colSpan="10" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
                            No activities yet. Add your first activity above!
                          </td>
                        </tr>
                      ) : (
                        activities.map((activity) => (
                          <tr key={activity.id}>
                            <td>{activity.createdAt ? new Date(activity.createdAt).toLocaleDateString() : '-'}</td>
                            <td style={{fontWeight: 600}}>{activity.clientName}</td>
                            <td><span className="badge badge-primary">{activity.activityType}</span></td>
                            <td>{activity.isin || activity.ticker || '-'}</td>
                            <td>{activity.size}MM</td>
                            <td>{activity.currency}</td>
                            <td><span className={`badge ${getDirectionBadge(activity.direction)}`}>{activity.direction}</span></td>
                            <td>{activity.price || '-'}</td>
                            <td><span className={`badge ${getStatusBadge(activity.status)}`}>{activity.status}</span></td>
                            <td>
                              <div style={{display: 'flex', gap: '8px'}}>
                                <button 
                                  className="btn-icon"
                                  onClick={() => handleEditActivity(activity)}
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                                <button 
                                  className="btn-icon"
                                  onClick={() => handleDeleteActivity(activity.id)}
                                  title="Delete"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* New Issues Tab */}
          {activeTab === 'newissues' && (
            <div>
              {/* Sub-tabs */}
              <div className="sub-tabs">
                <button 
                  className={`sub-tab ${newIssuesSubTab === 'create' ? 'active' : ''}`}
                  onClick={() => setNewIssuesSubTab('create')}
                >
                  Create New Issue
                </button>
                <button 
                  className={`sub-tab ${newIssuesSubTab === 'orderbook' ? 'active' : ''}`}
                  onClick={() => setNewIssuesSubTab('orderbook')}
                >
                  Order Book
                </button>
              </div>

              {/* Create New Issue */}
              {newIssuesSubTab === 'create' && (
                <>
                  <div className="card">
                    <div className="card-header">
                      <span>🚀 Create New Issue</span>
                    </div>
                    
                    <form onSubmit={handleNewIssueSubmit}>
                      <div className="single-panel-form">
                        <div className="form-section">
                          <div className="field-row">
                            <div className="field-group">
                              <label className="form-label">Issuer Name *</label>
                              <input
                                type="text"
                                className="form-input"
                                value={newIssueForm.issuerName}
                                onChange={(e) => setNewIssueForm({...newIssueForm, issuerName: e.target.value})}
                                required
                              />
                            </div>

                            <div className="field-group">
                              <label className="form-label">Target Issue Size (MM) *</label>
                              <input
                                type="number"
                                step="0.01"
                                className="form-input"
                                value={newIssueForm.targetIssueSize}
                                onChange={(e) => setNewIssueForm({...newIssueForm, targetIssueSize: e.target.value})}
                                required
                              />
                            </div>
                          </div>

                          <div className="field-row">
                            <div className="field-group">
                              <label className="form-label">Currency *</label>
                              <select
                                className="form-select"
                                value={newIssueForm.currency}
                                onChange={(e) => setNewIssueForm({...newIssueForm, currency: e.target.value})}
                                required
                              >
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                                <option value="AUD">AUD</option>
                                <option value="HKD">HKD</option>
                                <option value="SGD">SGD</option>
                                <option value="CNH">CNH</option>
                              </select>
                            </div>

                            <div className="field-group">
                              <label className="form-label">Bookrunner(s) *</label>
                              <div className="checkbox-group">
                                {Object.keys(newIssueForm.bookrunners).map(key => (
                                  <label key={key} className="checkbox-label">
                                    <input
                                      type="checkbox"
                                      checked={newIssueForm.bookrunners[key]}
                                      onChange={(e) => setNewIssueForm({
                                        ...newIssueForm,
                                        bookrunners: {
                                          ...newIssueForm.bookrunners,
                                          [key]: e.target.checked
                                        }
                                      })}
                                    />
                                    <span>{key.toUpperCase()}</span>
                                  </label>
                                ))}
                              </div>
                              {newIssueForm.bookrunners.other && (
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Specify other bookrunner"
                                  value={newIssueForm.otherBookrunner}
                                  onChange={(e) => setNewIssueForm({...newIssueForm, otherBookrunner: e.target.value})}
                                  style={{marginTop: '8px'}}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{padding: '20px 24px', borderTop: '1px solid var(--border)'}}>
                        <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                          {submitLoading ? 'Creating...' : '+ Create New Issue'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* New Issues List */}
                  <div className="card" style={{marginTop: '24px'}}>
                    <div className="card-header">
                      <span>New Issues ({newIssues.length})</span>
                    </div>
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Issuer</th>
                            <th>Size</th>
                            <th>Currency</th>
                            <th>Bookrunners</th>
                          </tr>
                        </thead>
                        <tbody>
                          {newIssues.length === 0 ? (
                            <tr>
                              <td colSpan="5" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
                                No new issues yet
                              </td>
                            </tr>
                          ) : (
                            newIssues.map((issue) => (
                              <tr key={issue.id}>
                                <td>{issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : '-'}</td>
                                <td style={{fontWeight: 600}}>{issue.issuerName}</td>
                                <td>{issue.targetIssueSize}MM</td>
                                <td><span className="badge badge-primary">{issue.currency}</span></td>
                                <td>{issue.bookrunners?.join(', ') || '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Order Book */}
              {newIssuesSubTab === 'orderbook' && (
                <>
                  <div className="card">
                    <div className="card-header">
                      <span>📖 Order Book Entry</span>
                    </div>
                    
                    <form onSubmit={handleOrderBookSubmit}>
                      <div className="single-panel-form">
                        <div className="form-section">
                          <div className="field-row">
                            <div className="field-group">
                              <label className="form-label">Client Name *</label>
                              <select
                                className="form-select"
                                value={orderBookForm.clientName}
                                onChange={(e) => setOrderBookForm({...orderBookForm, clientName: e.target.value})}
                                required
                              >
                                <option value="">Select Client</option>
                                {clients.map(client => (
                                  <option key={client.id} value={client.name}>{client.name}</option>
                                ))}
                              </select>
                            </div>

                            <div className="field-group">
                              <label className="form-label">Order Size (MM) *</label>
                              <input
                                type="number"
                                step="0.01"
                                className="form-input"
                                value={orderBookForm.orderSize}
                                onChange={(e) => setOrderBookForm({...orderBookForm, orderSize: e.target.value})}
                                required
                              />
                            </div>
                          </div>

                          <div className="field-row">
                            <div className="field-group">
                              <label className="form-label">Order Limit</label>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., 5.5% or specific terms"
                                value={orderBookForm.orderLimit}
                                onChange={(e) => setOrderBookForm({...orderBookForm, orderLimit: e.target.value})}
                              />
                            </div>

                            <div className="field-group">
                              <label className="form-label">Notes</label>
                              <textarea
                                className="form-textarea"
                                rows="2"
                                value={orderBookForm.notes}
                                onChange={(e) => setOrderBookForm({...orderBookForm, notes: e.target.value})}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{padding: '20px 24px', borderTop: '1px solid var(--border)'}}>
                        <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                          {submitLoading ? 'Adding...' : '+ Add Order Book Entry'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Order Book List */}
                  <div className="card" style={{marginTop: '24px'}}>
                    <div className="card-header">
                      <span>Order Book ({orderBooks.length})</span>
                    </div>
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Client</th>
                            <th>Order Size</th>
                            <th>Order Limit</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderBooks.length === 0 ? (
                            <tr>
                              <td colSpan="5" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
                                No order book entries yet
                              </td>
                            </tr>
                          ) : (
                            orderBooks.map((order) => (
                              <tr key={order.id}>
                                <td>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}</td>
                                <td style={{fontWeight: 600}}>{order.clientName}</td>
                                <td>{order.orderSize}MM</td>
                                <td>{order.orderLimit || '-'}</td>
                                <td>{order.notes || '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Clients Tab */}
          {activeTab === 'clients' && (
            <div>
              <div className="card">
                <div className="card-header">
                  <span>👥 {editingClient ? 'Edit Client' : 'New Client'}</span>
                  {editingClient && (
                    <button 
                      className="btn btn-muted"
                      onClick={() => {
                        setEditingClient(null);
                        setClientForm({
                          name: '',
                          type: 'FUND',
                          region: 'APAC',
                          salesCoverage: ''
                        });
                      }}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
                
                <form onSubmit={handleClientSubmit}>
                  <div className="single-panel-form">
                    <div className="form-section">
                      <div className="field-row">
                        <div className="field-group">
                          <label className="form-label">Client Name *</label>
                          <input
                            type="text"
                            className="form-input"
                            value={clientForm.name}
                            onChange={(e) => setClientForm({...clientForm, name: e.target.value})}
                            required
                          />
                        </div>

                        <div className="field-group">
                          <label className="form-label">Client Type *</label>
                          <select
                            className="form-select"
                            value={clientForm.type}
                            onChange={(e) => setClientForm({...clientForm, type: e.target.value})}
                            required
                          >
                            <option value="FUND">Fund</option>
                            <option value="BANK">Bank</option>
                            <option value="INSURANCE">Insurance</option>
                            <option value="PENSION">Pension</option>
                            <option value="SOVEREIGN">Sovereign</option>
                          </select>
                        </div>
                      </div>

                      <div className="field-row">
                        <div className="field-group">
                          <label className="form-label">Region *</label>
                          <select
                            className="form-select"
                            value={clientForm.region}
                            onChange={(e) => setClientForm({...clientForm, region: e.target.value})}
                            required
                          >
                            <option value="APAC">APAC</option>
                            <option value="EMEA">EMEA</option>
                            <option value="AMERICAS">Americas</option>
                          </select>
                        </div>

                        <div className="field-group">
                          <label className="form-label">Sales Coverage</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Salesperson name"
                            value={clientForm.salesCoverage}
                            onChange={(e) => setClientForm({...clientForm, salesCoverage: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{padding: '20px 24px', borderTop: '1px solid var(--border)'}}>
                    <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                      {submitLoading ? (editingClient ? 'Updating...' : 'Adding...') : (editingClient ? 'Update Client' : '+ Add Client')}
                    </button>
                  </div>
                </form>
              </div>

              {/* Client List */}
              <div className="card" style={{marginTop: '24px'}}>
                <div className="card-header">
                  <span>Client Directory ({clients.length})</span>
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button className="btn btn-muted" onClick={exportClientsToExcel}>
                      📊 Export Excel
                    </button>
                    <button className="btn btn-muted" onClick={exportClientsToPDF}>
                      📄 Export PDF
                    </button>
                  </div>
                </div>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Region</th>
                        <th>Sales Coverage</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
                            No clients yet
                          </td>
                        </tr>
                      ) : (
                        clients.map((client) => (
                          <tr key={client.id}>
                            <td style={{fontWeight: 600}}>{client.name}</td>
                            <td><span className="badge badge-primary">{client.type}</span></td>
                            <td>{client.region}</td>
                            <td>{client.salesCoverage || '-'}</td>
                            <td>
                              <div style={{display: 'flex', gap: '8px'}}>
                                <button 
                                  className="btn-icon"
                                  onClick={() => handleEditClient(client)}
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                                {userData?.isAdmin && (
                                  <button 
                                    className="btn-icon"
                                    onClick={() => handleDeleteClient(client.id)}
                                    title="Delete (Admin only)"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div>
              <div className="card">
                <div className="card-header">
                  <span>📊 Activity Overview</span>
                </div>
                <div style={{padding: '24px'}}>
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px'}}>
                    <div style={{textAlign: 'center', padding: '20px', background: 'var(--section-label-bg)', borderRadius: '12px', border: '1px solid var(--border)'}}>
                      <div style={{fontSize: '32px', fontWeight: 'bold', color: 'var(--accent)'}}>{stats.totalActivities}</div>
                      <div style={{color: 'var(--text-secondary)', marginTop: '8px'}}>Total Activities</div>
                    </div>
                    
                    <div style={{textAlign: 'center', padding: '20px', background: 'var(--section-label-bg)', borderRadius: '12px', border: '1px solid var(--border)'}}>
                      <div style={{fontSize: '32px', fontWeight: 'bold', color: 'var(--accent)'}}>${stats.totalVolume}MM</div>
                      <div style={{color: 'var(--text-secondary)', marginTop: '8px'}}>Total Volume</div>
                    </div>
                    
                    <div style={{textAlign: 'center', padding: '20px', background: 'var(--section-label-bg)', borderRadius: '12px', border: '1px solid var(--border)'}}>
                      <div style={{fontSize: '32px', fontWeight: 'bold', color: '#22c55e'}}>{stats.buyCount}</div>
                      <div style={{color: 'var(--text-secondary)', marginTop: '8px'}}>Buy Activities</div>
                    </div>
                    
                    <div style={{textAlign: 'center', padding: '20px', background: 'var(--section-label-bg)', borderRadius: '12px', border: '1px solid var(--border)'}}>
                      <div style={{fontSize: '32px', fontWeight: 'bold', color: '#ef4444'}}>{stats.sellCount}</div>
                      <div style={{color: 'var(--text-secondary)', marginTop: '8px'}}>Sell Activities</div>
                    </div>
                    
                    <div style={{textAlign: 'center', padding: '20px', background: 'var(--section-label-bg)', borderRadius: '12px', border: '1px solid var(--border)'}}>
                      <div style={{fontSize: '32px', fontWeight: 'bold', color: '#f59e0b'}}>{stats.twoWayCount}</div>
                      <div style={{color: 'var(--text-secondary)', marginTop: '8px'}}>Two-Way</div>
                    </div>
                  </div>

                  <div style={{marginTop: '40px', textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
                    <div style={{fontSize: '48px', marginBottom: '16px'}}>📈</div>
                    <p>Advanced analytics and charts will be added in future updates!</p>
                    <p style={{fontSize: '14px', marginTop: '8px'}}>Navigate to the Analytics page for detailed reports.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Assistant Tab */}
          {activeTab === 'ai' && (
            <div>
              <div className="card">
                <div className="card-header">
                  <span>🤖 AI Transcript Analysis</span>
                </div>
                <div style={{padding: '24px'}}>
                  <div style={{marginBottom: '24px'}}>
                    <label className="form-label">Upload Transcript File (.txt, .csv, .md)</label>
                    <input
                      type="file"
                      accept=".txt,.csv,.md"
                      className="form-input"
                      onChange={(e) => setAiFile(e.target.files[0])}
                    />
                    {aiFile && (
                      <p style={{fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px'}}>
                        Selected: {aiFile.name}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={handleAiAnalysis}
                    className="btn btn-primary"
                    disabled={!aiFile || aiAnalyzing}
                  >
                    {aiAnalyzing ? 'Analyzing...' : '🔍 Analyze Transcript'}
                  </button>

                  {aiError && (
                    <div style={{marginTop: '20px', padding: '16px', background: 'var(--badge-danger-bg)', color: 'var(--badge-danger-text)', borderRadius: '8px'}}>
                      {aiError}
                    </div>
                  )}

                  {aiResults.length > 0 && (
                    <div style={{marginTop: '24px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                        <h3 style={{fontSize: '16px', fontWeight: 600}}>
                          Detected Activities ({aiResults.length})
                        </h3>
                        <button
                          onClick={handleImportAiResults}
                          className="btn btn-secondary"
                          disabled={submitLoading}
                        >
                          {submitLoading ? 'Importing...' : '📥 Import All to Activity Log'}
                        </button>
                      </div>

                      <div className="table-container">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Client</th>
                              <th>ISIN</th>
                              <th>Ticker</th>
                              <th>Size</th>
                              <th>Currency</th>
                              <th>Direction</th>
                              <th>Price</th>
                              <th>Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {aiResults.map((result, idx) => (
                              <tr key={idx}>
                                <td style={{fontWeight: 600}}>{result.clientName}</td>
                                <td>{result.isin || '-'}</td>
                                <td>{result.ticker || '-'}</td>
                                <td>{result.size}MM</td>
                                <td><span className="badge badge-primary">{result.currency}</span></td>
                                <td><span className={`badge ${getDirectionBadge(result.direction)}`}>{result.direction}</span></td>
                                <td>{result.price || '-'}</td>
                                <td style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis'}}>{result.notes || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        /* Inherit theme variables from globals.css */
        
        .app-container {
          min-height: 100vh;
          background: var(--bg-base);
          color: var(--text-primary);
        }

        /* Navigation */
        .nav {
          background: var(--nav-bg);
          border-bottom: 1px solid var(--nav-border);
          backdrop-filter: blur(10px);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .nav-left {
          display: flex;
          align-items: center;
          gap: 40px;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 20px;
          font-weight: 700;
          color: var(--logo-color);
        }

        .nav-links {
          display: flex;
          gap: 24px;
        }

        .nav-link {
          color: var(--text-secondary);
          text-decoration: none;
          font-weight: 500;
          font-size: 14px;
          transition: color 0.2s;
          padding: 6px 0;
          border-bottom: 2px solid transparent;
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
        }

        .nav-link:hover {
          color: var(--accent);
        }

        .nav-link.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .theme-toggle {
          background: var(--toggle-bg);
          border: none;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 18px;
          transition: all 0.2s;
        }

        .theme-toggle:hover {
          background: var(--accent);
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-details {
          text-align: right;
        }

        .user-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .user-org {
          font-size: 11px;
          color: var(--text-muted);
        }

        /* Main Content */
        .main-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 32px 24px;
        }

        /* Tabs */
        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 0;
        }

        .tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .tab:hover {
          color: var(--accent);
          background: var(--accent-glow);
        }

        .tab.active {
          color: var(--tab-active-color);
          border-bottom-color: var(--tab-active-color);
        }

        /* Sub-tabs */
        .sub-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--border);
        }

        .sub-tab {
          padding: 10px 18px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-secondary);
          font-weight: 500;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .sub-tab:hover {
          color: var(--accent);
        }

        .sub-tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }

        /* Card */
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

        /* Single Panel Form */
        .single-panel-form {
          padding: 24px;
        }

        .form-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .field-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .field-group {
          display: flex;
          flex-direction: column;
        }

        .auto-filled-info {
          font-size: 11px;
          color: var(--autofill-text);
          background: var(--autofill-bg);
          padding: 6px 10px;
          border-radius: 6px;
          margin-top: 6px;
          border: 1px solid var(--autofill-border);
        }

        /* Form Elements */
        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 5px;
        }

        .form-hint {
          font-size: 11.5px;
          color: var(--text-muted);
          margin-top: 4px;
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

        /* Checkbox Group */
        .checkbox-group {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 8px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--text-primary);
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        /* Buttons */
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
        }

        .btn-secondary:hover:not(:disabled) {
          background: var(--btn-secondary-hover);
        }

        .btn-muted {
          background: var(--btn-muted-bg);
          color: var(--btn-muted-text);
        }

        .btn-muted:hover {
          background: var(--btn-muted-hover);
        }

        .btn-danger {
          background: #dc2626;
          color: #fff;
        }

        .btn-danger:hover {
          background: #b91c1c;
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

        /* Table */
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

        /* Badges */
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

        .badge-success {
          background: var(--badge-success-bg);
          color: var(--badge-success-text);
        }

        .badge-warning {
          background: var(--badge-warning-bg);
          color: var(--badge-warning-text);
        }

        .badge-danger {
          background: var(--badge-danger-bg);
          color: var(--badge-danger-text);
        }

        /* Spinner for loading indicator */
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

        /* Responsive */
        @media (max-width: 768px) {
          .field-row {
            grid-template-columns: 1fr;
          }

          .nav-links {
            display: none;
          }

          .tabs {
            overflow-x: auto;
          }
        }
      `}</style>
    </div>
  );
}
