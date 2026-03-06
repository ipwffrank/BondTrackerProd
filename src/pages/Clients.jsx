import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';

export default function Clients() {
  const { userData, isAdmin } = useAuth();
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
    if(!userData?.organizationId){ setFormError('Not connected — please refresh the page.'); return; }
    setSubmitLoading(true);
    try {
      const data={name:clientForm.name,type:clientForm.type,region:clientForm.region,salesCoverage:clientForm.salesCoverage,createdAt:serverTimestamp(),createdBy:userData.name||userData.email};
      if(editingClient){ await updateDoc(doc(db,`organizations/${userData.organizationId}/clients`,editingClient),data); setEditingClient(null); }
      else{ await addDoc(collection(db,`organizations/${userData.organizationId}/clients`),data); }
      setFormError('');
      setClientForm({name:'',type:'FUND',region:'APAC',salesCoverage:''});
    }catch(e){ console.error(e); alert('Failed to save client'); }finally{ setSubmitLoading(false); }
  }

  async function handleDeleteClient(id) {
    if(!isAdmin){ alert('Only admins can delete clients'); return; }
    if(!window.confirm('Delete this client?')) return;
    try{ await deleteDoc(doc(db,`organizations/${userData.organizationId}/clients`,id)); }
    catch(e){ alert('Failed to delete client'); }
  }

  function handleEditClient(c) {
    setClientForm({name:c.name,type:c.type,region:c.region,salesCoverage:c.salesCoverage||''});
    setEditingClient(c.id);
    window.scrollTo({top:0,behavior:'smooth'});
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

      // Match against existing clients by name (case-insensitive)
      const existingNames = new Set(clients.map(c => c.name.toLowerCase()));
      const toAdd = rows.filter(r => !existingNames.has(r.name.toLowerCase()));
      const skipped = rows.length - toAdd.length;

      for (const row of toAdd) {
        await addDoc(collection(db, `organizations/${userData.organizationId}/clients`), {
          name: row.name, type: row.type, region: row.region, salesCoverage: row.salesCoverage,
          createdAt: serverTimestamp(), createdBy: userData.name || userData.email,
        });
      }

      setCsvNotification({
        type: 'success',
        message: `Added ${toAdd.length} client${toAdd.length !== 1 ? 's' : ''}${skipped > 0 ? `, skipped ${skipped} duplicate${skipped !== 1 ? 's' : ''} already in directory` : ''}.`,
      });
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
            <span>📝 {editingClient?'Edit Client':'New Client'}</span>
            {editingClient&&<button className="btn btn-muted" onClick={()=>{setEditingClient(null);setClientForm({name:'',type:'FUND',region:'APAC',salesCoverage:''});}}>Cancel Edit</button>}
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
                {submitLoading?(editingClient?'Updating...':'Adding...'):(editingClient?'Update Client':'+ Add Client')}
              </button>
            </div>
          </form>
        </div>

        {/* Client Directory - Export buttons IN the card header */}
        <div className="card" style={{marginTop:'24px'}}>
          <div className="card-header">
            <span>📋 Client Directory ({filteredClients.length < clients.length ? `${filteredClients.length} of ${clients.length}` : clients.length})</span>
            <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
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
                <tr><th>Name</th><th>Type</th><th>Region</th><th>Sales Coverage</th><th>Created By</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filteredClients.length===0?(<tr><td colSpan="6" style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>{clients.length===0?'No clients yet. Add your first client above!':'No clients match your filters.'}</td></tr>):(
                  filteredClients.map(c=>(
                    <tr key={c.id}>
                      <td style={{fontWeight:600}}>{c.name}</td>
                      <td><span className="badge badge-primary">{c.type}</span></td>
                      <td><span className="badge badge-success">{c.region}</span></td>
                      <td>{c.salesCoverage||'-'}</td>
                      <td>{c.createdBy}</td>
                      <td>
                        <div style={{display:'flex',gap:'8px'}}>
                          <button className="btn-icon" onClick={()=>handleEditClient(c)} title="Edit">✏️</button>
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
        .btn-muted{background:var(--btn-muted-bg);color:var(--btn-muted-text);}
        .btn-muted:hover{background:var(--btn-muted-hover);}
        .btn-icon{background:none;border:none;cursor:pointer;font-size:16px;padding:4px;transition:transform 0.2s;}
        .btn-icon:hover{transform:scale(1.2);}
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
