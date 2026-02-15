import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function Clients() {
  const { userData, isAdmin } = useAuth();
  
  const [clientForm, setClientForm] = useState({
    name: '',
    type: 'FUND',
    region: 'APAC',
    salesCoverage: ''
  });

  const [clients, setClients] = useState([]);
  const [editingClient, setEditingClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    if (!userData?.organizationId) {
      setLoading(false);
      return;
    }

    const clientsRef = collection(db, `organizations/${userData.organizationId}/clients`);
    const clientsQuery = query(clientsRef, orderBy('name', 'asc'));
    
    const unsubscribe = onSnapshot(clientsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClients(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.organizationId]);

  async function handleClientSubmit(e) {
    e.preventDefault();
    if (!userData?.organizationId) return;

    setSubmitLoading(true);
    try {
      const clientData = {
        name: clientForm.name,
        type: clientForm.type,
        region: clientForm.region,
        salesCoverage: clientForm.salesCoverage,
        createdAt: serverTimestamp(),
        createdBy: userData.name || userData.email
      };

      if (editingClient) {
        await updateDoc(doc(db, `organizations/${userData.organizationId}/clients`, editingClient), clientData);
        setEditingClient(null);
        alert('Client updated successfully!');
      } else {
        const clientsRef = collection(db, `organizations/${userData.organizationId}/clients`);
        await addDoc(clientsRef, clientData);
        alert('Client added successfully!');
      }

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

  async function handleDeleteClient(clientId) {
    if (!isAdmin) {
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

  function handleExportExcel() {
    alert('Excel export feature coming soon! Install xlsx library to enable.');
  }

  function handleExportPDF() {
    alert('PDF export feature coming soon! Install jspdf library to enable.');
  }

  if (loading) {
    return (
      <div className="app-container">
        <Navigation />
        <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh'}}>
          <div style={{textAlign: 'center'}}>
            <div className="spinner" style={{width: '40px', height: '40px', margin: '0 auto 16px'}}></div>
            <div style={{color: 'var(--text-primary)'}}>Loading clients...</div>
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
            <h1 className="page-title">👥 Clients</h1>
            <p className="page-description">Manage your client database</p>
          </div>
          <div style={{display: 'flex', gap: '12px'}}>
            <button onClick={handleExportExcel} className="btn btn-secondary">
              📊 Export Excel
            </button>
            <button onClick={handleExportPDF} className="btn btn-secondary">
              📄 Export PDF
            </button>
          </div>
        </div>

        {/* Client Form */}
        <div className="card">
          <div className="card-header">
            <span>📝 {editingClient ? 'Edit Client' : 'New Client'}</span>
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
            <div className="form-grid">
              <div className="field-row">
                <div className="field-group">
                  <label className="form-label">Client Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ABC Fund Management"
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
                    placeholder="John Doe"
                    value={clientForm.salesCoverage}
                    onChange={(e) => setClientForm({...clientForm, salesCoverage: e.target.value})}
                  />
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

        {/* Client Directory */}
        <div className="card" style={{marginTop: '24px'}}>
          <div className="card-header">
            <span>📋 Client Directory ({clients.length})</span>
          </div>
          
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Region</th>
                  <th>Sales Coverage</th>
                  <th>Created By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
                      No clients yet. Add your first client above!
                    </td>
                  </tr>
                ) : (
                  clients.map((client) => (
                    <tr key={client.id}>
                      <td style={{fontWeight: 600}}>{client.name}</td>
                      <td><span className="badge badge-primary">{client.type}</span></td>
                      <td><span className="badge badge-success">{client.region}</span></td>
                      <td>{client.salesCoverage || '-'}</td>
                      <td>{client.createdBy}</td>
                      <td>
                        <div style={{display: 'flex', gap: '8px'}}>
                          <button 
                            className="btn-icon"
                            onClick={() => handleEditClient(client)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          {isAdmin && (
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

        {/* Info Box */}
        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: 'var(--badge-primary-bg)',
          borderRadius: '8px',
          border: '1px solid var(--badge-primary-text)'
        }}>
          <h4 style={{fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--badge-primary-text)'}}>
            💡 Client Management
          </h4>
          <ul style={{fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, paddingLeft: '20px', margin: 0}}>
            <li>All users can view, create, and edit clients</li>
            <li>Only admins can delete clients</li>
            <li>Clients are automatically populated in Activity Log and Order Book forms</li>
            <li>Export features available for Excel and PDF (coming soon)</li>
          </ul>
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
        .form-select {
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
        .form-select:focus {
          outline: none;
          border-color: var(--border-focus);
          background: var(--bg-input-focus);
          box-shadow: 0 0 0 3px var(--accent-glow);
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

        .badge-success {
          background: var(--badge-success-bg);
          color: var(--badge-success-text);
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

          .page-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
