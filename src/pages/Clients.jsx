import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';
import { logAudit } from '../services/audit.service';
import { findSimilarClients } from '../utils/clientDedup';

export default function Clients() {
  const { userData, isAdmin, currentUser } = useAuth();
  const [clientForm, setClientForm] = useState({ name:'',type:'FUND',region:'APAC',salesCoverage:'' });
  const [clients, setClients] = useState([]);
  const [editingClient, setEditingClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvNotification, setCsvNotification] = useState(null);
  const csvInputRef = useRef(null);
  const [clientSearch, setClientSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [dedupMatches, setDedupMatches] = useState([]);
  const [showDedupModal, setShowDedupModal] = useState(false);
  const [pendingClientData, setPendingClientData] = useState(null);

  useEffect(() => {
    if (!userData?.organizationId) { setLoading(false); return; }
    const unsubscribe = onSnapshot(
      query(collection(db,`organizations/${userData.organizationId}/clients`),orderBy('name','asc')),
      (snapshot) => { setClients(snapshot.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); }
    );
    return () => unsubscribe();
  },[userData?.organizationId]);

  async function handleClientSubmit(e) {
    e.preventDefault();
    setFormError('');
    const missing = [];
    if(!clientForm.name) missing.push('Client Name');
    if(!clientForm.type) missing.push('Client Type');
    if(!clientForm.region) missing.push('Region');
    if(missing.length){ setFormError(`Please fill in: ${missing.join(', ')}`); return; }
    if(!userData?.organizationId){
      if(currentUser) {
        setFormError('Session loading — please wait a moment and try again.');
      } else {
        setFormError('Not connected — please refresh the page.');
      }
      return;
    }
    const data={name:clientForm.name,type:clientForm.type,region:clientForm.region,salesCoverage:clientForm.salesCoverage,createdAt:serverTimestamp(),createdBy:userData.name||userData.email};

    // Check for similar clients
    const similar = findSimilarClients(clientForm.name, clients);
    if (similar.length > 0) {
      setDedupMatches(similar);
      setPendingClientData(data);
      setShowDedupModal(true);
      return;
    }

    await saveClient(data);
  }

  async function saveClient(data) {
    setSubmitLoading(true);
    try {
      await addDoc(collection(db,`organizations/${userData.organizationId}/clients`),data);
      setFormError('');
      setClientForm({name:'',type:'FUND',region:'APAC',salesCoverage:''});
    }catch(e){ console.error(e); alert('Failed to save client'); }finally{ setSubmitLoading(false); }
  }

  function confirmAddDespiteDupes() {
    setShowDedupModal(false);
    if (pendingClientData) saveClient(pendingClientData);
    setPendingClientData(null);
    setDedupMatches([]);
  }

  function cancelDedupAdd() {
    setShowDedupModal(false);
    setPendingClientData(null);
    setDedupMatches([]);
  }

  async function handleDeleteClient(id) {
    if(!isAdmin){ alert('Only admins can delete clients'); return; }
    if(!window.confirm('Delete this client?')) return;
    try{ await deleteDoc(doc(db,`organizations/${userData.organizationId}/clients`,id)); }
    catch(e){ alert('Failed to delete client'); }
  }

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({name:'',type:'FUND',region:'APAC',salesCoverage:''});

  function handleEditClient(c) {
    setEditForm({name:c.name,type:c.type,region:c.region,salesCoverage:c.salesCoverage||''});
    setEditingClient(c.id);
    setShowEditModal(true);
  }

  function cancelEditClient() {
    setEditingClient(null);
    setShowEditModal(false);
    setEditForm({name:'',type:'FUND',region:'APAC',salesCoverage:''});
  }

  async function handleEditClientSubmit(e) {
    e.preventDefault();
    const missing = [];
    if(!editForm.name) missing.push('Client Name');
    if(!editForm.type) missing.push('Client Type');
    if(!editForm.region) missing.push('Region');
    if(missing.length){ setFormError(`Please fill in: ${missing.join(', ')}`); return; }
    setSubmitLoading(true);
    try {
      await updateDoc(doc(db,`organizations/${userData.organizationId}/clients`,editingClient),{
        name:editForm.name,type:editForm.type,region:editForm.region,salesCoverage:editForm.salesCoverage,
      });
      cancelEditClient();
      setFormError('');
    }catch(e){ console.error(e); alert('Failed to update client'); }finally{ setSubmitLoading(false); }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allSelected = filteredClients.length > 0 && filteredClients.every(c => selectedIds.has(c.id));
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredClients.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredClients.forEach(c => next.add(c.id));
        return next;
      });
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!isAdmin) { alert('Only admins can delete clients'); return; }
    if (!window.confirm(`Delete ${selectedIds.size} selected client${selectedIds.size === 1 ? '' : 's'}?`)) return;
    try {
      for (const id of selectedIds) {
        await deleteDoc(doc(db, `organizations/${userData.organizationId}/clients`, id));
      }
      setSelectedIds(new Set());
    } catch (e) {
      console.error(e);
      alert('Failed to delete some clients');
    }
  }

  async function handleCsvUpload(e) {
    const file = e.target.files[0];
    if (!file || !userData?.organizationId) return;
    setCsvUploading(true);
    setCsvNotification(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length === 0) { setCsvNotification({ type: 'error', message: 'CSV file is empty.' }); return; }

      // Detect and skip header row
      let startIdx = 0;
      const firstLineLower = lines[0].toLowerCase();
      if (firstLineLower.includes('name') || firstLineLower.includes('client') || firstLineLower.includes('type')) startIdx = 1;

      const VALID_TYPES = ['FUND','BANK','INSURANCE','PENSION','SOVEREIGN'];
      const VALID_REGIONS = ['APAC','EMEA','AMERICAS'];

      const rows = lines.slice(startIdx).map(line => {
        const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        return {
          name: cols[0] || '',
          type: VALID_TYPES.includes((cols[1] || '').toUpperCase()) ? cols[1].toUpperCase() : 'FUND',
          region: VALID_REGIONS.includes((cols[2] || '').toUpperCase()) ? cols[2].toUpperCase() : 'APAC',
          salesCoverage: cols[3] || '',
        };
      }).filter(r => r.name);

      if (rows.length === 0) { setCsvNotification({ type: 'error', message: 'No valid rows found in CSV.' }); return; }

      // Match against existing clients by name (exact + fuzzy)
      const existingNames = new Set(clients.map(c => c.name.toLowerCase()));
      const toAdd = [];
      let skipped = 0;
      let fuzzySkipped = 0;

      for (const r of rows) {
        if (existingNames.has(r.name.toLowerCase())) {
          skipped++;
          continue;
        }
        const similar = findSimilarClients(r.name, clients);
        if (similar.length > 0) {
          fuzzySkipped++;
          continue;
        }
        toAdd.push(r);
      }

      for (const row of toAdd) {
        await addDoc(collection(db, `organizations/${userData.organizationId}/clients`), {
          name: row.name, type: row.type, region: row.region, salesCoverage: row.salesCoverage,
          createdAt: serverTimestamp(), createdBy: userData.name || userData.email,
        });
      }

      const parts = [`Added ${toAdd.length} client${toAdd.length !== 1 ? 's' : ''}`];
      if (skipped > 0) parts.push(`skipped ${skipped} exact duplicate${skipped !== 1 ? 's' : ''}`);
      if (fuzzySkipped > 0) parts.push(`skipped ${fuzzySkipped} similar name${fuzzySkipped !== 1 ? 's' : ''}`);
      setCsvNotification({ type: 'success', message: parts.join(', ') + '.' });
    } catch (err) {
      console.error(err);
      setCsvNotification({ type: 'error', message: 'Failed to parse CSV. Check file format.' });
    } finally {
      setCsvUploading(false);
      e.target.value = '';
    }
  }

  const filteredClients = clients.filter(c => {
    if (filterType && c.type !== filterType) return false;
    if (filterRegion && c.region !== filterRegion) return false;
    if (clientSearch) {
      const q = clientSearch.toLowerCase();
      return c.name?.toLowerCase().includes(q) || c.salesCoverage?.toLowerCase().includes(q) || c.createdBy?.toLowerCase().includes(q);
    }
    return true;
  });

  // Export functions
  function handleExportExcel() {
    if(clients.length===0){ alert('No clients to export!'); return; }
    exportToExcel(clients,[
      {header:'Name',field:'name'},
      {header:'Type',field:'type'},
      {header:'Region',field:'region'},
      {header:'Sales Coverage',field:'salesCoverage'},
      {header:'Created By',field:'createdBy'}
    ],'clients-export','Clients');
    if(userData?.organizationId) logAudit(userData.organizationId,{action:'export_clients_excel',details:`Exported ${clients.length} clients to Excel`,userId:currentUser?.uid,userName:userData?.name,userEmail:userData?.email});
  }

  function handleExportPDF() {
    if(clients.length===0){ alert('No clients to export!'); return; }
    exportToPDF(clients,[
      {header:'Name',field:'name'},
      {header:'Type',field:'type'},
      {header:'Region',field:'region'},
      {header:'Sales Coverage',field:'salesCoverage'},
      {header:'Created By',field:'createdBy'}
    ],'clients-export','Client Directory');
    if(userData?.organizationId) logAudit(userData.organizationId,{action:'export_clients_pdf',details:`Exported ${clients.length} clients to PDF`,userId:currentUser?.uid,userName:userData?.name,userEmail:userData?.email});
  }

  if(loading) return(<div className="app-container"><Navigation/><div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'50vh'}}><div style={{textAlign:'center'}}><div className="spinner" style={{width:'40px',height:'40px',margin:'0 auto 16px'}}></div><div style={{color:'var(--text-primary)'}}>Loading clients...</div></div></div></div>);

  return (
    <div className="app-container">
      <Navigation/>
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Clients</h1>
            <p className="page-description">Manage your client database</p>
          </div>
        </div>

        {/* Client Form */}
        <div className="card">
          <div className="card-header">
            <span>New Client</span>
          </div>
          <form onSubmit={handleClientSubmit}>
            <div className="form-grid">
              <div className="field-row">
                <div className="field-group">
                  <label className="form-label">Client Name *</label>
                  <input type="text" className="form-input" placeholder="e.g., ABC Fund Management Ltd" value={clientForm.name} onChange={e=>setClientForm({...clientForm,name:e.target.value})}/>
                </div>
                <div className="field-group">
                  <label className="form-label">Client Type *</label>
                  <select className="form-select" value={clientForm.type} onChange={e=>setClientForm({...clientForm,type:e.target.value})}>
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
                  <select className="form-select" value={clientForm.region} onChange={e=>setClientForm({...clientForm,region:e.target.value})}>
                    <option value="APAC">APAC</option>
                    <option value="EMEA">EMEA</option>
                    <option value="AMERICAS">Americas</option>
                  </select>
                </div>
                <div className="field-group">
                  <label className="form-label">Sales Coverage</label>
                  <input type="text" className="form-input" placeholder="e.g., John Doe" value={clientForm.salesCoverage} onChange={e=>setClientForm({...clientForm,salesCoverage:e.target.value})}/>
                </div>
              </div>
            </div>
            <div style={{padding:'20px 24px',borderTop:'1px solid var(--border)'}}>
              {formError && <div className="form-error-banner">{formError}</div>}
              <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                {submitLoading?'Adding...':'+ Add Client'}
              </button>
            </div>
          </form>
        </div>

        {/* Client Directory - Export buttons IN the card header */}
        <div className="card" style={{marginTop:'24px'}}>
          <div className="card-header">
            <span>📋 Client Directory ({filteredClients.length < clients.length ? `${filteredClients.length} of ${clients.length}` : clients.length})</span>
            <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
              {isAdmin && selectedIds.size > 0 && (
                <button onClick={handleBulkDelete} className="btn btn-danger">🗑️ Delete {selectedIds.size} Selected</button>
              )}
              <button onClick={handleExportExcel} className="btn btn-secondary">📊 Export Excel</button>
              <button onClick={handleExportPDF} className="btn btn-secondary">📄 Export PDF</button>
              <button onClick={() => csvInputRef.current?.click()} className="btn btn-secondary" disabled={csvUploading}>
                {csvUploading ? '⏳ Uploading...' : '📤 Upload CSV'}
              </button>
              <input ref={csvInputRef} type="file" accept=".csv" style={{display:'none'}} onChange={handleCsvUpload} />
            </div>
          </div>
          {/* Filter bar */}
          <div className="filter-bar">
            <div className="filter-search-wrap">
              <svg className="filter-search-icon" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input type="text" className="filter-input" placeholder="Search name, sales coverage…" value={clientSearch} onChange={e=>setClientSearch(e.target.value)}/>
              {clientSearch&&<button className="filter-clear-x" onClick={()=>setClientSearch('')}>×</button>}
            </div>
            <select className="filter-select" value={filterType} onChange={e=>setFilterType(e.target.value)}>
              <option value="">All Types</option>
              <option value="FUND">Fund</option>
              <option value="BANK">Bank</option>
              <option value="INSURANCE">Insurance</option>
              <option value="PENSION">Pension</option>
              <option value="SOVEREIGN">Sovereign</option>
            </select>
            <select className="filter-select" value={filterRegion} onChange={e=>setFilterRegion(e.target.value)}>
              <option value="">All Regions</option>
              <option value="APAC">APAC</option>
              <option value="EMEA">EMEA</option>
              <option value="AMERICAS">Americas</option>
            </select>
            {(clientSearch||filterType||filterRegion)&&(
              <button className="btn btn-muted" style={{padding:'6px 10px',fontSize:'12px'}} onClick={()=>{setClientSearch('');setFilterType('');setFilterRegion('');}}>Clear</button>
            )}
          </div>
          {csvNotification && (
            <div style={{
              padding:'12px 24px', display:'flex', justifyContent:'space-between', alignItems:'center',
              borderBottom:'1px solid var(--border)', fontSize:'13px', fontWeight:500,
              background: csvNotification.type === 'success' ? 'var(--badge-success-bg)' : 'var(--badge-danger-bg)',
              color: csvNotification.type === 'success' ? 'var(--badge-success-text)' : 'var(--badge-danger-text)',
            }}>
              <span>{csvNotification.type === 'success' ? '✓ ' : '⚠ '}{csvNotification.message}</span>
              <button onClick={() => setCsvNotification(null)} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',fontSize:'18px',padding:'0 4px',lineHeight:1}}>×</button>
            </div>
          )}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>{isAdmin && <th style={{width:'40px'}}><input type="checkbox" checked={filteredClients.length > 0 && filteredClients.every(c => selectedIds.has(c.id))} onChange={toggleSelectAll} style={{width:'16px',height:'16px',cursor:'pointer'}}/></th>}<th>Name</th><th>Type</th><th>Region</th><th>Sales Coverage</th><th>Created By</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filteredClients.length===0?(<tr><td colSpan={isAdmin ? 7 : 6} style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>{clients.length===0?'No clients yet. Add your first client above!':'No clients match your filters.'}</td></tr>):(
                  filteredClients.map(c=>(
                    <tr key={c.id} style={selectedIds.has(c.id) ? {background:'var(--accent-glow)'} : undefined}>
                      {isAdmin && <td><input type="checkbox" checked={selectedIds.has(c.id)} onChange={()=>toggleSelect(c.id)} style={{width:'16px',height:'16px',cursor:'pointer'}}/></td>}
                      <td style={{fontWeight:600}}>{c.name}</td>
                      <td><span className="badge badge-primary">{c.type}</span></td>
                      <td><span className="badge badge-success">{c.region}</span></td>
                      <td>{c.salesCoverage||'-'}</td>
                      <td>{c.createdBy}</td>
                      <td>
                        <div style={{display:'flex',gap:'8px'}}>
                          <button className="btn-edit" onClick={()=>handleEditClient(c)} title="Edit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                          {isAdmin&&<button className="btn-icon" onClick={()=>handleDeleteClient(c.id)} title="Delete (Admin only)">🗑️</button>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{marginTop:'24px',padding:'16px',background:'var(--badge-primary-bg)',borderRadius:'8px',border:'1px solid var(--badge-primary-text)'}}>
          <h4 style={{fontSize:'14px',fontWeight:600,marginBottom:'8px',color:'var(--badge-primary-text)'}}>💡 Client Management</h4>
          <ul style={{fontSize:'13px',color:'var(--text-primary)',lineHeight:1.6,paddingLeft:'20px',margin:0}}>
            <li>All users can view, create, and edit clients</li>
            <li>Only admins can delete clients</li>
            <li>Clients are automatically available in Activity Log and Order Book forms</li>
          </ul>
        </div>
        {/* Edit Client Modal */}
        {showEditModal && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
            <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:'12px',padding:'24px',maxWidth:'520px',width:'90%',boxShadow:'0 8px 32px rgba(0,0,0,0.4)'}}>
              <h3 style={{fontSize:'17px',fontWeight:700,color:'var(--text-primary)',marginBottom:'16px'}}>Edit Client</h3>
              <form onSubmit={handleEditClientSubmit}>
                <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                  <div className="field-group">
                    <label className="form-label">Client Name *</label>
                    <input type="text" className="form-input" value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})}/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                    <div className="field-group">
                      <label className="form-label">Client Type *</label>
                      <select className="form-select" value={editForm.type} onChange={e=>setEditForm({...editForm,type:e.target.value})}>
                        <option value="FUND">Fund</option>
                        <option value="BANK">Bank</option>
                        <option value="INSURANCE">Insurance</option>
                        <option value="PENSION">Pension</option>
                        <option value="SOVEREIGN">Sovereign</option>
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="form-label">Region *</label>
                      <select className="form-select" value={editForm.region} onChange={e=>setEditForm({...editForm,region:e.target.value})}>
                        <option value="APAC">APAC</option>
                        <option value="EMEA">EMEA</option>
                        <option value="AMERICAS">Americas</option>
                      </select>
                    </div>
                  </div>
                  <div className="field-group">
                    <label className="form-label">Sales Coverage</label>
                    <input type="text" className="form-input" value={editForm.salesCoverage} onChange={e=>setEditForm({...editForm,salesCoverage:e.target.value})}/>
                  </div>
                </div>
                {formError && showEditModal && <div className="form-error-banner" style={{marginTop:'12px'}}>{formError}</div>}
                <div style={{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'16px'}}>
                  <button type="button" className="btn btn-muted" onClick={cancelEditClient}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submitLoading}>{submitLoading?'Saving...':'Save Changes'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Dedup Confirmation Modal */}
        {showDedupModal && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
            <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:'12px',padding:'24px',maxWidth:'500px',width:'90%',boxShadow:'0 8px 32px rgba(0,0,0,0.4)'}}>
              <h3 style={{fontSize:'17px',fontWeight:700,color:'var(--text-primary)',marginBottom:'12px'}}>Similar Clients Found</h3>
              <p style={{fontSize:'13px',color:'var(--text-secondary)',marginBottom:'16px'}}>
                The following existing clients are similar to "<strong>{pendingClientData?.name}</strong>":
              </p>
              <div style={{maxHeight:'200px',overflow:'auto',marginBottom:'16px'}}>
                {dedupMatches.map((m,i) => (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',background:'var(--table-odd)',borderRadius:'8px',marginBottom:'6px',border:'1px solid var(--border)'}}>
                    <span style={{fontWeight:600,color:'var(--text-primary)'}}>{m.client.name}</span>
                    <span className="badge badge-warning" style={{fontSize:'10px'}}>{m.matchType === 'exact' ? 'Exact match' : m.matchType === 'contains' ? 'Name overlap' : 'Similar'} ({Math.round(m.score*100)}%)</span>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:'10px',justifyContent:'flex-end'}}>
                <button className="btn btn-muted" onClick={cancelDedupAdd}>Cancel</button>
                <button className="btn btn-primary" onClick={confirmAddDespiteDupes}>Add Anyway</button>
              </div>
            </div>
          </div>
        )}

        <div style={{marginTop:'16px',padding:'16px',background:'var(--badge-primary-bg)',borderRadius:'8px',border:'1px solid var(--badge-primary-text)'}}>
          <h4 style={{fontSize:'14px',fontWeight:600,marginBottom:'8px',color:'var(--badge-primary-text)'}}>📋 CSV Bulk Upload Format</h4>
          <p style={{fontSize:'13px',color:'var(--text-primary)',lineHeight:1.6,margin:'0 0 6px'}}>Columns: <strong>name, type, region, salesCoverage</strong> (header row optional)</p>
          <p style={{fontSize:'12px',color:'var(--text-muted)',margin:'0 0 4px'}}>Valid types: FUND, BANK, INSURANCE, PENSION, SOVEREIGN</p>
          <p style={{fontSize:'12px',color:'var(--text-muted)',margin:0}}>Valid regions: APAC, EMEA, AMERICAS · Example row: <em>Temasek Holdings,FUND,APAC,Jane Doe</em></p>
        </div>
      </main>
      <style jsx>{`
        .app-container{min-height:100vh;background:var(--bg-base);color:var(--text-primary);}
        .main-content{max-width:1400px;margin:0 auto;padding:32px 24px;}
        .page-header{margin-bottom:32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:24px;}
        .page-title{font-size:32px;font-weight:700;color:var(--text-primary);margin-bottom:8px;}
        .page-description{font-size:16px;color:var(--text-secondary);}
        .card{background:var(--card-bg);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);}
        .card-header{font-size:17px;font-weight:700;color:var(--text-primary);padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
        .form-grid{padding:24px;}
        .field-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;}
        .field-group{display:flex;flex-direction:column;}
        .form-label{display:block;font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:5px;}
        .form-input,.form-select{width:100%;padding:10px 14px;background:var(--bg-input);border:1.5px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:14px;transition:all 0.2s ease;font-family:inherit;}
        .form-input:focus,.form-select:focus{outline:none;border-color:var(--border-focus);background:var(--bg-input-focus);box-shadow:0 0 0 3px var(--accent-glow);}
        .btn{padding:10px 18px;border-radius:8px;font-weight:600;font-size:13.5px;transition:all 0.2s ease;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:7px;font-family:inherit;white-space:nowrap;}
        .btn-primary{background:linear-gradient(135deg,var(--accent),var(--accent-hover));color:#fff;box-shadow:0 2px 8px var(--accent-glow-strong);}
        .btn-primary:hover:not(:disabled){transform:translateY(-1px);}
        .btn-primary:disabled{opacity:0.5;cursor:not-allowed;}
        .btn-secondary{background:var(--btn-secondary-bg);color:#fff;padding:8px 14px;font-size:13px;}
        .btn-secondary:hover{background:var(--btn-secondary-hover);}
        .btn-danger{background:#dc2626;color:#fff;padding:8px 14px;font-size:13px;}.btn-danger:hover{background:#b91c1c;}
        .btn-muted{background:var(--btn-muted-bg);color:var(--btn-muted-text);}
        .btn-muted:hover{background:var(--btn-muted-hover);}
        .btn-icon{background:none;border:none;cursor:pointer;font-size:16px;padding:4px;transition:transform 0.2s;}
        .btn-icon:hover{transform:scale(1.2);}
        .btn-edit{background:none;border:1px solid var(--accent);border-radius:6px;cursor:pointer;padding:5px 7px;color:var(--accent);display:inline-flex;align-items:center;justify-content:center;transition:all 0.2s;}
        .btn-edit:hover{background:var(--accent);color:#fff;transform:translateY(-1px);box-shadow:0 2px 8px var(--accent-glow);}
        .table-container{overflow-x:auto;}
        .table{width:100%;border-collapse:collapse;font-size:14px;}
        .table thead{background:var(--table-header-bg);}
        .table th{padding:12px 16px;text-align:left;font-weight:600;color:var(--text-secondary);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid var(--border);}
        .table td{padding:14px 16px;border-bottom:1px solid var(--border);color:var(--text-primary);}
        .table tbody tr:nth-child(odd){background:var(--table-odd);}
        .table tbody tr:nth-child(even){background:var(--table-even);}
        .table tbody tr:hover{background:var(--table-hover);}
        .badge{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;display:inline-block;}
        .badge-primary{background:var(--badge-primary-bg);color:var(--badge-primary-text);}
        .badge-success{background:var(--badge-success-bg);color:var(--badge-success-text);}
        .spinner{display:inline-block;width:10px;height:10px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .filter-bar{display:flex;align-items:center;gap:10px;padding:12px 24px;background:var(--table-header-bg);border-bottom:1px solid var(--border);flex-wrap:wrap;}
        .filter-search-wrap{position:relative;flex:1;min-width:180px;}
        .filter-search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none;}
        .filter-input{width:100%;padding:7px 32px 7px 30px;background:var(--bg-input);border:1.5px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;font-family:inherit;transition:border-color 0.2s;}
        .filter-input:focus{outline:none;border-color:var(--border-focus);box-shadow:0 0 0 3px var(--accent-glow);}
        .filter-clear-x{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;line-height:1;padding:0;display:flex;align-items:center;}
        .filter-clear-x:hover{color:var(--text-primary);}
        .filter-select{padding:7px 10px;background:var(--bg-input);border:1.5px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;font-family:inherit;cursor:pointer;}
        .filter-select:focus{outline:none;border-color:var(--border-focus);}
        .form-error-banner{background:#fee2e2;border:1px solid #ef4444;color:#dc2626;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;}
        @media(max-width:768px){.field-row{grid-template-columns:1fr;}.card-header{flex-direction:column;gap:12px;align-items:flex-start;}.filter-bar{flex-direction:column;align-items:stretch;}.filter-search-wrap{min-width:100%;}}
      `}</style>
    </div>
  );
}
