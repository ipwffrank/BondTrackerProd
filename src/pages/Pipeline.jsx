import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function Pipeline() {
  const { userData } = useAuth();
  
  const [activeSubTab, setActiveSubTab] = useState('create');
  
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

  const [orderBookForm, setOrderBookForm] = useState({
    clientName: '',
    orderSize: '',
    orderLimit: '',
    notes: ''
  });

  const [newIssues, setNewIssues] = useState([]);
  const [orderBooks, setOrderBooks] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    if (!userData?.organizationId) {
      setLoading(false);
      return;
    }

    const unsubscribes = [];

    try {
      const newIssuesRef = collection(db, `organizations/${userData.organizationId}/newIssues`);
      const newIssuesQuery = query(newIssuesRef, orderBy('createdAt', 'desc'));
      
      const newIssuesUnsub = onSnapshot(newIssuesQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }));
        setNewIssues(data);
        setLoading(false);
      });
      unsubscribes.push(newIssuesUnsub);

      const orderBooksRef = collection(db, `organizations/${userData.organizationId}/orderBooks`);
      const orderBooksQuery = query(orderBooksRef, orderBy('createdAt', 'desc'));
      
      const orderBooksUnsub = onSnapshot(orderBooksQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }));
        setOrderBooks(data);
      });
      unsubscribes.push(orderBooksUnsub);

      const clientsRef = collection(db, `organizations/${userData.organizationId}/clients`);
      const clientsUnsub = onSnapshot(clientsRef, (snapshot) => {
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

  async function handleNewIssueSubmit(e) {
    e.preventDefault();
    if (!userData?.organizationId) return;

    setSubmitLoading(true);
    try {
      const selectedBookrunners = Object.entries(newIssueForm.bookrunners)
        .filter(([key, value]) => value)
        .map(([key]) => key === 'other' ? newIssueForm.otherBookrunner : key)
        .filter(Boolean);

      const newIssuesRef = collection(db, `organizations/${userData.organizationId}/newIssues`);
      
      await addDoc(newIssuesRef, {
        issuerName: newIssueForm.issuerName,
        targetIssueSize: parseFloat(newIssueForm.targetIssueSize) || 0,
        currency: newIssueForm.currency,
        bookrunners: selectedBookrunners,
        createdAt: serverTimestamp(),
        createdBy: userData.name || userData.email
      });

      alert('New issue added successfully!');
      
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

    } catch (error) {
      console.error('Error saving new issue:', error);
      alert('Failed to save new issue');
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleOrderBookSubmit(e) {
    e.preventDefault();
    if (!userData?.organizationId) return;

    setSubmitLoading(true);
    try {
      const orderBooksRef = collection(db, `organizations/${userData.organizationId}/orderBooks`);
      
      await addDoc(orderBooksRef, {
        clientName: orderBookForm.clientName,
        orderSize: parseFloat(orderBookForm.orderSize) || 0,
        orderLimit: orderBookForm.orderLimit,
        notes: orderBookForm.notes,
        createdAt: serverTimestamp(),
        createdBy: userData.name || userData.email
      });

      alert('Order added successfully!');
      
      setOrderBookForm({
        clientName: '',
        orderSize: '',
        orderLimit: '',
        notes: ''
      });

    } catch (error) {
      console.error('Error saving order:', error);
      alert('Failed to save order');
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleDeleteNewIssue(issueId) {
    if (!window.confirm('Are you sure you want to delete this issue?')) return;
    
    try {
      await deleteDoc(doc(db, `organizations/${userData.organizationId}/newIssues`, issueId));
      alert('Issue deleted successfully!');
    } catch (error) {
      console.error('Error deleting issue:', error);
      alert('Failed to delete issue');
    }
  }

  async function handleDeleteOrder(orderId) {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    
    try {
      await deleteDoc(doc(db, `organizations/${userData.organizationId}/orderBooks`, orderId));
      alert('Order deleted successfully!');
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('Failed to delete order');
    }
  }

  if (loading) {
    return (
      <div className="app-container">
        <Navigation />
        <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh'}}>
          <div style={{textAlign: 'center'}}>
            <div className="spinner" style={{width: '40px', height: '40px', margin: '0 auto 16px'}}></div>
            <div style={{color: 'var(--text-primary)'}}>Loading pipeline...</div>
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
            <h1 className="page-title">🚀 Pipeline</h1>
            <p className="page-description">Manage new bond issues and order books</p>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="sub-tabs">
          <button 
            className={`sub-tab ${activeSubTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('create')}
          >
            📝 New Issues ({newIssues.length})
          </button>
          <button 
            className={`sub-tab ${activeSubTab === 'orderbook' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('orderbook')}
          >
            📊 Order Book ({orderBooks.length})
          </button>
        </div>

        {/* New Issues Tab */}
        {activeSubTab === 'create' && (
          <>
            <div className="card">
              <div className="card-header">
                <span>📝 Create New Issue</span>
              </div>
              
              <form onSubmit={handleNewIssueSubmit}>
                <div className="form-grid">
                  <div className="field-row">
                    <div className="field-group">
                      <label className="form-label">Issuer Name *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Company Name"
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
                        placeholder="500"
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
                      <label className="form-label">Bookrunners</label>
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px'}}>
                        {Object.keys(newIssueForm.bookrunners).map(key => (
                          <label key={key} style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                            <input
                              type="checkbox"
                              checked={newIssueForm.bookrunners[key]}
                              onChange={(e) => setNewIssueForm({
                                ...newIssueForm,
                                bookrunners: {...newIssueForm.bookrunners, [key]: e.target.checked}
                              })}
                              style={{width: '16px', height: '16px', cursor: 'pointer'}}
                            />
                            <span style={{fontSize: '13px', color: 'var(--text-primary)'}}>{key.toUpperCase()}</span>
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

                <div style={{padding: '20px 24px', borderTop: '1px solid var(--border)'}}>
                  <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                    {submitLoading ? 'Adding...' : '+ Add New Issue'}
                  </button>
                </div>
              </form>
            </div>

            {/* New Issues List */}
            <div className="card" style={{marginTop: '24px'}}>
              <div className="card-header">
                <span>📋 New Issues ({newIssues.length})</span>
              </div>
              
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Issuer</th>
                      <th>Target Size</th>
                      <th>Currency</th>
                      <th>Bookrunners</th>
                      <th>Created By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newIssues.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
                          No new issues yet. Add your first issue above!
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
                          <td>{issue.createdBy}</td>
                          <td>
                            <button 
                              className="btn-icon"
                              onClick={() => handleDeleteNewIssue(issue.id)}
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Order Book Tab */}
        {activeSubTab === 'orderbook' && (
          <>
            <div className="card">
              <div className="card-header">
                <span>📊 Add Order</span>
              </div>
              
              <form onSubmit={handleOrderBookSubmit}>
                <div className="form-grid">
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
                        placeholder="50"
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
                        placeholder="e.g., 3.5%"
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

                <div style={{padding: '20px 24px', borderTop: '1px solid var(--border)'}}>
                  <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                    {submitLoading ? 'Adding...' : '+ Add Order'}
                  </button>
                </div>
              </form>
            </div>

            {/* Order Book List */}
            <div className="card" style={{marginTop: '24px'}}>
              <div className="card-header">
                <span>📋 Order Book ({orderBooks.length})</span>
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
                      <th>Created By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderBooks.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
                          No orders yet. Add your first order above!
                        </td>
                      </tr>
                    ) : (
                      orderBooks.map((order) => (
                        <tr key={order.id}>
                          <td>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}</td>
                          <td style={{fontWeight: 600}}>{order.clientName}</td>
                          <td>{order.orderSize}MM</td>
                          <td>{order.orderLimit || '-'}</td>
                          <td style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis'}}>{order.notes || '-'}</td>
                          <td>{order.createdBy}</td>
                          <td>
                            <button 
                              className="btn-icon"
                              onClick={() => handleDeleteOrder(order.id)}
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
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
        }
      `}</style>
    </div>
  );
}
