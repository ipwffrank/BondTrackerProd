import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, limit, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function Activities() {
  const { userData } = useAuth();
  
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

  const [activities, setActivities] = useState([]);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({
    totalActivities: 0,
    totalVolume: 0,
    buyCount: 0,
    sellCount: 0,
    twoWayCount: 0
  });

  const [editingActivity, setEditingActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [bondLookupLoading, setBondLookupLoading] = useState(false);

  useEffect(() => {
    if (!userData?.organizationId) {
      setLoading(false);
      return;
    }

    const unsubscribes = [];

    try {
      const activitiesRef = collection(db, `organizations/${userData.organizationId}/activities`);
      const activitiesQuery = query(activitiesRef, orderBy('createdAt', 'desc'), limit(100));
      
      const activitiesUnsub = onSnapshot(activitiesQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }));
        
        setActivities(data);
        
        const totalActivities = data.length;
        const totalVolume = data.reduce((sum, a) => sum + (parseFloat(a.size) || 0), 0);
        const buyCount = data.filter(a => a.direction === 'BUY').length;
        const sellCount = data.filter(a => a.direction === 'SELL').length;
        const twoWayCount = data.filter(a => a.direction === 'TWO-WAY').length;
        
        setStats({ totalActivities, totalVolume: totalVolume.toFixed(2), buyCount, sellCount, twoWayCount });
        setLoading(false);
      });
      unsubscribes.push(activitiesUnsub);

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

  useEffect(() => {
    if (editingActivity) return;
    
    const timeoutId = setTimeout(async () => {
      if (activityForm.isin && !activityForm.ticker) {
        await fetchBondDetails('isin', activityForm.isin);
      } else if (activityForm.ticker && !activityForm.isin) {
        await fetchBondDetails('ticker', activityForm.ticker);
      }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [activityForm.isin, activityForm.ticker, editingActivity]);

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
        if (response.status === 404) {
          console.log(`${searchType} not found:`, searchValue);
          return;
        }
        throw new Error('Bloomberg lookup failed');
      }

      const result = await response.json();

      if (result.success && result.data) {
        const bond = result.data;
        
        setActivityForm(prev => {
          if (prev.isin && prev.ticker) return prev;
          
          return {
            ...prev,
            isin: prev.isin || bond.isin || '',
            ticker: prev.ticker || bond.ticker || ''
          };
        });

        console.log('✅ Bond details fetched:', {
          isin: bond.isin,
          ticker: bond.ticker,
          name: bond.bondName
        });
      }
    } catch (error) {
      console.error('Error fetching bond details:', error);
    } finally {
      setBondLookupLoading(false);
    }
  }

  const getSelectedClient = () => {
    return clients.find(c => c.name === activityForm.clientName);
  };

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
        await updateDoc(doc(db, `organizations/${userData.organizationId}/activities`, editingActivity), activityData);
        setEditingActivity(null);
        alert('Activity updated successfully!');
      } else {
        await addDoc(activitiesRef, activityData);
        alert('Activity added successfully!');
      }

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

  if (loading) {
    return (
      <div className="app-container">
        <Navigation />
        <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh'}}>
          <div style={{textAlign: 'center'}}>
            <div className="spinner" style={{width: '40px', height: '40px', margin: '0 auto 16px'}}></div>
            <div style={{color: 'var(--text-primary)'}}>Loading activities...</div>
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
            <h1 className="page-title">📋 Activity Log</h1>
            <p className="page-description">Track client interactions and bond trading activities</p>
          </div>
          <div className="stats-summary">
            <div className="stat-item">
              <div className="stat-value">{stats.totalActivities}</div>
              <div className="stat-label">Total</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">${stats.totalVolume}MM</div>
              <div className="stat-label">Volume</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{color: '#22c55e'}}>{stats.buyCount}</div>
              <div className="stat-label">Buy</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{color: '#ef4444'}}>{stats.sellCount}</div>
              <div className="stat-label">Sell</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span>📝 {editingActivity ? 'Edit Activity' : 'New Activity'}</span>
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
            <div className="form-grid">
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
                      <span className="spinner" style={{width: '10px', height: '10px'}}></span>
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

            <div style={{padding: '20px 24px', borderTop: '1px solid var(--border)'}}>
              <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                {submitLoading ? (editingActivity ? 'Updating...' : 'Adding...') : (editingActivity ? 'Update Activity' : '+ Add Activity')}
              </button>
            </div>
          </form>
        </div>

        <div className="card" style={{marginTop: '24px'}}>
          <div className="card-header">
            <span>📊 Activity History ({stats.totalActivities})</span>
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
      </main>

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
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 24px;
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

        .stats-summary {
          display: flex;
          gap: 24px;
        }

        .stat-item {
          text-align: center;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: var(--accent);
        }

        .stat-label {
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
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

        .auto-filled-info {
          font-size: 11px;
          color: var(--autofill-text);
          background: var(--autofill-bg);
          padding: 6px 10px;
          border-radius: 6px;
          margin-top: 6px;
          border: 1px solid var(--autofill-border);
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

        @media (max-width: 768px) {
          .field-row {
            grid-template-columns: 1fr;
          }

          .stats-summary {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </div>
  );
}
