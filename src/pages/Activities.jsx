import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';

export default function Activities() {
  const { userData, currentUser, isAdmin } = useAuth();
  const [activityForm, setActivityForm] = useState({ clientName:'',activityType:'',isin:'',ticker:'',size:'',currency:'USD',otherCurrency:'',price:'',direction:'',status:'',notes:'' });
  const [activities, setActivities] = useState([]);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({ totalActivities:0,totalVolume:0,buyCount:0,sellCount:0,twoWayCount:0 });
  const [editingActivity, setEditingActivity] = useState(null);
  const [savingStatus, setSavingStatus] = useState({});
  const [savingPrice, setSavingPrice] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [bondLookupLoading, setBondLookupLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [actSearch, setActSearch] = useState('');
  const [actFilterDir, setActFilterDir] = useState('');
  const [actFilterStatus, setActFilterStatus] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    if (!userData?.organizationId) { setLoading(false); return; }
    const unsubscribes = [];
    try {
      const activitiesQuery = query(collection(db,`organizations/${userData.organizationId}/activities`),orderBy('createdAt','desc'));
      unsubscribes.push(onSnapshot(activitiesQuery,(snapshot) => {
        const data = snapshot.docs.map(d=>({id:d.id,...d.data(),createdAt:d.data().createdAt?.toDate()}));
        setActivities(data);
        const totalVolume = data.reduce((s,a)=>s+(parseFloat(a.size)||0),0);
        setStats({ totalActivities:data.length,totalVolume:totalVolume.toFixed(2),buyCount:data.filter(a=>a.direction==='BUY').length,sellCount:data.filter(a=>a.direction==='SELL').length,twoWayCount:data.filter(a=>a.direction==='TWO-WAY').length });
        setLoading(false);
      }));
      unsubscribes.push(onSnapshot(query(collection(db,`organizations/${userData.organizationId}/clients`),orderBy('name','asc')),(snapshot) => {
        setClients(snapshot.docs.map(d=>({id:d.id,...d.data()})));
      }));
    } catch(e){ console.error(e); setLoading(false); }
    return ()=>unsubscribes.forEach(u=>u());
  },[userData?.organizationId]);

  useEffect(() => { setCurrentPage(1); }, [activities, actSearch, actFilterDir, actFilterStatus]);

  useEffect(() => {
    if (editingActivity) return;
    const t = setTimeout(async()=>{
      if(activityForm.isin&&!activityForm.ticker) await fetchBondDetails('isin',activityForm.isin);
      else if(activityForm.ticker&&!activityForm.isin) await fetchBondDetails('ticker',activityForm.ticker);
    },800);
    return ()=>clearTimeout(t);
  },[activityForm.isin,activityForm.ticker,editingActivity]);

  async function fetchBondDetails(type,value){
    if(!value||value.length<2) return;
    setBondLookupLoading(true);
    try{
      const r=await fetch('/.netlify/functions/bloomberg-lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(type==='isin'?{isin:value}:{ticker:value})});
      if(!r.ok) return;
      const result=await r.json();
      if(result.success&&result.data) setActivityForm(p=>({...p,isin:p.isin||result.data.isin||'',ticker:p.ticker||result.data.ticker||''}));
    }catch(e){console.error(e);}finally{setBondLookupLoading(false);}
  }

  const getSelectedClient=()=>clients.find(c=>c.name===activityForm.clientName);

  async function handleActivitySubmit(e){
    e.preventDefault();
    setFormError('');
    const missing = [];
    if(!activityForm.clientName) missing.push('Client Name');
    if(!activityForm.activityType) missing.push('Activity Type');
    if(!activityForm.size) missing.push('Size');
    if(!activityForm.direction) missing.push('Direction');
    if(!activityForm.status) missing.push('Status');
    if(activityForm.currency==='OTHER' && !activityForm.otherCurrency) missing.push('Currency');
    if(missing.length){ setFormError(`Please fill in: ${missing.join(', ')}`); return; }
    if(!userData?.organizationId){
      if(currentUser) {
        setFormError('Session loading — please wait a moment and try again.');
      } else {
        setFormError('Not connected — please refresh the page.');
      }
      return;
    }
    const sc=getSelectedClient();
    setSubmitLoading(true);
    try{
      const data={clientName:activityForm.clientName,clientType:sc?.type||'',clientRegion:sc?.region||'',salesCoverage:sc?.salesCoverage||'',activityType:activityForm.activityType,isin:activityForm.isin.toUpperCase(),ticker:activityForm.ticker.toUpperCase(),size:parseFloat(activityForm.size)||0,currency:activityForm.currency==='OTHER'?activityForm.otherCurrency:activityForm.currency,price:activityForm.price?parseFloat(activityForm.price):null,direction:activityForm.direction,status:activityForm.status,notes:activityForm.notes,createdAt:serverTimestamp(),createdBy:userData.name||userData.email};
      if(editingActivity){await updateDoc(doc(db,`organizations/${userData.organizationId}/activities`,editingActivity),data);setEditingActivity(null);}
      else{await addDoc(collection(db,`organizations/${userData.organizationId}/activities`),data);}
      setFormError('');
      setActivityForm({clientName:'',activityType:'',isin:'',ticker:'',size:'',currency:'USD',otherCurrency:'',price:'',direction:'',status:'',notes:''});
    }catch(e){console.error(e);alert('Failed to save activity');}finally{setSubmitLoading(false);}
  }

  async function handleDeleteActivity(id){
    if(!window.confirm('Delete this activity?')) return;
    try{await deleteDoc(doc(db,`organizations/${userData.organizationId}/activities`,id));}catch(e){alert('Failed to delete');}
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected activit${selectedIds.size === 1 ? 'y' : 'ies'}?`)) return;
    try {
      for (const id of selectedIds) {
        await deleteDoc(doc(db, `organizations/${userData.organizationId}/activities`, id));
      }
      setSelectedIds(new Set());
    } catch (e) {
      console.error(e);
      alert('Failed to delete some activities');
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const pageItems = filteredActivities.slice((currentPage-1)*ITEMS_PER_PAGE, currentPage*ITEMS_PER_PAGE);
    const allSelected = pageItems.every(a => selectedIds.has(a.id));
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pageItems.forEach(a => next.delete(a.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pageItems.forEach(a => next.add(a.id));
        return next;
      });
    }
  }

  function handleEditActivity(a){
    setActivityForm({clientName:a.clientName,activityType:a.activityType,isin:a.isin,ticker:a.ticker,size:a.size.toString(),currency:['USD','EUR','GBP','AUD','HKD','SGD','CNH'].includes(a.currency)?a.currency:'OTHER',otherCurrency:['USD','EUR','GBP','AUD','HKD','SGD','CNH'].includes(a.currency)?'':a.currency,price:a.price?.toString()||'',direction:a.direction,status:a.status,notes:a.notes||''});
    setEditingActivity(a.id);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  async function handleInlineStatusChange(activityId, newStatus) {
    setSavingStatus(p => ({...p, [activityId]: true}));
    try {
      await updateDoc(doc(db, `organizations/${userData.organizationId}/activities`, activityId), { status: newStatus });
    } catch(e) {
      console.error(e);
      alert('Failed to update status');
    } finally {
      setSavingStatus(p => ({...p, [activityId]: false}));
    }
  }

  async function handleInlinePriceUpdate(activityId, newPrice) {
    setSavingPrice(p => ({...p, [activityId]: true}));
    try {
      await updateDoc(doc(db, `organizations/${userData.organizationId}/activities`, activityId), {
        price: newPrice !== '' ? parseFloat(newPrice) : null
      });
    } catch(e) {
      console.error(e);
      alert('Failed to update price');
    } finally {
      setSavingPrice(p => ({...p, [activityId]: false}));
    }
  }

  function handleExportExcel(){
    if(activities.length===0){alert('No activities to export!');return;}
    exportToExcel(activities,[
      {header:'Date',field:'createdAt'},{header:'Client',field:'clientName'},{header:'Activity Type',field:'activityType'},
      {header:'ISIN',field:'isin'},{header:'Ticker',field:'ticker'},{header:'Size (MM)',field:'size'},
      {header:'Currency',field:'currency'},{header:'Direction',field:'direction'},{header:'Price',field:'price'},
      {header:'Status',field:'status'},{header:'Notes',field:'notes'},{header:'Created By',field:'createdBy'}
    ],'activity-log-export','Activity Log');
  }

  function handleExportPDF(){
    if(activities.length===0){alert('No activities to export!');return;}
    exportToPDF(activities,[
      {header:'Date',field:'createdAt'},{header:'Client',field:'clientName'},{header:'Type',field:'activityType'},
      {header:'ISIN',field:'isin'},{header:'Ticker',field:'ticker'},{header:'Size (MM)',field:'size'},
      {header:'Currency',field:'currency'},{header:'Direction',field:'direction'},
      {header:'Price',field:'price'},{header:'Status',field:'status'},{header:'Notes',field:'notes'}
    ],'activity-log-export','Activity Log');
  }

  const filteredActivities = activities.filter(a => {
    if (actFilterDir && a.direction !== actFilterDir) return false;
    if (actFilterStatus && a.status !== actFilterStatus) return false;
    if (actSearch) {
      const q = actSearch.toLowerCase();
      return (
        a.clientName?.toLowerCase().includes(q) ||
        a.isin?.toLowerCase().includes(q) ||
        a.ticker?.toLowerCase().includes(q) ||
        a.notes?.toLowerCase().includes(q) ||
        a.createdBy?.toLowerCase().includes(q) ||
        a.activityType?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const dirBadge=(d)=>({'BUY':'badge-success','SELL':'badge-danger','TWO-WAY':'badge-warning'}[d]||'badge-primary');
  const stsBadge=(s)=>({'ENQUIRY':'badge-primary','QUOTED':'badge-warning','EXECUTED':'badge-success','PASSED':'badge-danger','TRADED AWAY':'badge-danger'}[s]||'badge-primary');

  if(loading) return(<div className="app-container"><Navigation/><div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'50vh'}}><div style={{textAlign:'center'}}><div className="spinner" style={{width:'40px',height:'40px',margin:'0 auto 16px'}}></div><div style={{color:'var(--text-primary)'}}>Loading activities...</div></div></div></div>);

  return (
    <div className="app-container">
      <Navigation/>
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Activity Log</h1>
            <p className="page-description">Track client interactions and bond trading activities</p>
          </div>
          <div className="stats-summary">
            <div className="stat-item"><div className="stat-value">{stats.totalActivities}</div><div className="stat-label">Total</div></div>
            <div className="stat-item"><div className="stat-value">${stats.totalVolume}MM</div><div className="stat-label">Volume</div></div>
            <div className="stat-item"><div className="stat-value" style={{color:'#22c55e'}}>{stats.buyCount}</div><div className="stat-label">Buy</div></div>
            <div className="stat-item"><div className="stat-value" style={{color:'#ef4444'}}>{stats.sellCount}</div><div className="stat-label">Sell</div></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span>📝 {editingActivity?'Edit Activity':'New Activity'}</span>
            {editingActivity&&<button className="btn btn-muted" onClick={()=>{setEditingActivity(null);setActivityForm({clientName:'',activityType:'',isin:'',ticker:'',size:'',currency:'USD',otherCurrency:'',price:'',direction:'',status:'',notes:''});}}>Cancel Edit</button>}
          </div>
          <form onSubmit={handleActivitySubmit}>
            <div className="form-grid">
              <div className="field-row">
                <div className="field-group">
                  <label className="form-label">Client Name *</label>
                  <select className="form-select" value={activityForm.clientName} onChange={e=>setActivityForm({...activityForm,clientName:e.target.value})}>
                    <option value="">Select Client</option>
                    {clients.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  {activityForm.clientName&&getSelectedClient()&&<div className="auto-filled-info">Type: {getSelectedClient().type} | Region: {getSelectedClient().region} | Coverage: {getSelectedClient().salesCoverage||'N/A'}</div>}
                </div>
                <div className="field-group">
                  <label className="form-label">Activity Type *</label>
                  <select className="form-select" value={activityForm.activityType} onChange={e=>setActivityForm({...activityForm,activityType:e.target.value})}>
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
                  <input type="text" className="form-input" placeholder="e.g., US0378331005" value={activityForm.isin} onChange={e=>setActivityForm({...activityForm,isin:e.target.value.toUpperCase()})}/>
                </div>
                <div className="field-group">
                  <label className="form-label">Ticker</label>
                  <input type="text" className="form-input" placeholder="e.g., AAPL" value={activityForm.ticker} onChange={e=>setActivityForm({...activityForm,ticker:e.target.value.toUpperCase()})}/>
                  <div className="form-hint">Enter ISIN or Ticker - other auto-fills via Bloomberg API</div>
                  {bondLookupLoading&&<div style={{fontSize:'11px',color:'var(--accent)',marginTop:'4px',display:'flex',alignItems:'center',gap:'6px'}}><span className="spinner" style={{width:'10px',height:'10px'}}></span>Looking up bond details...</div>}
                </div>
              </div>
              <div className="field-row">
                <div className="field-group">
                  <label className="form-label">Size (MM) *{editingActivity && !isAdmin ? ' (admin only)' : ''}</label>
                  <input type="number" step="0.01" className="form-input" placeholder="e.g., 50" value={activityForm.size} onChange={e=>setActivityForm({...activityForm,size:e.target.value})} disabled={editingActivity && !isAdmin} title={editingActivity && !isAdmin ? 'Only admins can edit size' : ''}/>
                </div>
                <div className="field-group">
                  <label className="form-label">Currency *</label>
                  <select className="form-select" value={activityForm.currency} onChange={e=>setActivityForm({...activityForm,currency:e.target.value})}>
                    <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
                    <option value="AUD">AUD</option><option value="HKD">HKD</option><option value="SGD">SGD</option>
                    <option value="CNH">CNH</option><option value="OTHER">Other</option>
                  </select>
                  {activityForm.currency==='OTHER'&&<input type="text" className="form-input" placeholder="Specify currency" value={activityForm.otherCurrency} onChange={e=>setActivityForm({...activityForm,otherCurrency:e.target.value.toUpperCase()})} style={{marginTop:'8px'}}/>}
                </div>
              </div>
              <div className="field-row">
                <div className="field-group">
                  <label className="form-label">Price{editingActivity && !['ENQUIRY','QUOTED'].includes(activityForm.status) ? ' (locked)' : ''}</label>
                  <input type="number" step="0.0001" className="form-input" placeholder="e.g., 98.75" value={activityForm.price} onChange={e=>setActivityForm({...activityForm,price:e.target.value})} disabled={editingActivity && !['ENQUIRY','QUOTED'].includes(activityForm.status)} title={editingActivity && !['ENQUIRY','QUOTED'].includes(activityForm.status) ? 'Price can only be edited for Enquiry and Quoted statuses' : ''}/>
                </div>
                <div className="field-group">
                  <label className="form-label">Direction *</label>
                  <select className="form-select" value={activityForm.direction} onChange={e=>setActivityForm({...activityForm,direction:e.target.value})}>
                    <option value="">Select Direction</option>
                    <option value="BUY">Buy</option><option value="SELL">Sell</option><option value="TWO-WAY">Two Way</option>
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field-group">
                  <label className="form-label">Status *</label>
                  <select className="form-select" value={activityForm.status} onChange={e=>setActivityForm({...activityForm,status:e.target.value})}>
                    <option value="">Select Status</option>
                    <option value="ENQUIRY">Enquiry</option><option value="QUOTED">Quoted</option>
                    <option value="EXECUTED">Executed</option><option value="PASSED">Passed</option>
                    <option value="TRADED AWAY">Traded Away</option>
                  </select>
                </div>
                <div className="field-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" rows="2" placeholder="e.g., Client requested pricing for 3Y maturity" value={activityForm.notes} onChange={e=>setActivityForm({...activityForm,notes:e.target.value})}/>
                </div>
              </div>
            </div>
            <div style={{padding:'20px 24px',borderTop:'1px solid var(--border)'}}>
              {formError && <div className="form-error-banner">{formError}</div>}
              <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                {submitLoading?(editingActivity?'Updating...':'Adding...'):(editingActivity?'Update Activity':'+ Add Activity')}
              </button>
            </div>
          </form>
        </div>

        {/* Activity History - Export buttons IN the card header */}
        <div className="card" style={{marginTop:'24px'}}>
          <div className="card-header">
            <span>📊 Activity History ({filteredActivities.length < activities.length ? `${filteredActivities.length} of ${activities.length}` : activities.length})</span>
            <div style={{display:'flex',gap:'10px'}}>
              {selectedIds.size > 0 && (
                <button onClick={handleBulkDelete} className="btn btn-danger">🗑️ Delete {selectedIds.size} Selected</button>
              )}
              <button onClick={handleExportExcel} className="btn btn-secondary">📊 Export Excel</button>
              <button onClick={handleExportPDF} className="btn btn-secondary">📄 Export PDF</button>
            </div>
          </div>
          {/* Filter bar */}
          <div className="filter-bar">
            <div className="filter-search-wrap">
              <svg className="filter-search-icon" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input type="text" className="filter-input" placeholder="Search client, ISIN, ticker, notes…" value={actSearch} onChange={e=>setActSearch(e.target.value)}/>
              {actSearch&&<button className="filter-clear-x" onClick={()=>setActSearch('')}>×</button>}
            </div>
            <select className="filter-select" value={actFilterDir} onChange={e=>setActFilterDir(e.target.value)}>
              <option value="">All Directions</option>
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
              <option value="TWO-WAY">Two-Way</option>
            </select>
            <select className="filter-select" value={actFilterStatus} onChange={e=>setActFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="ENQUIRY">Enquiry</option>
              <option value="QUOTED">Quoted</option>
              <option value="EXECUTED">Executed</option>
              <option value="PASSED">Passed</option>
              <option value="TRADED AWAY">Traded Away</option>
            </select>
            {(actSearch||actFilterDir||actFilterStatus)&&(
              <button className="btn btn-muted" style={{padding:'6px 10px',fontSize:'12px'}} onClick={()=>{setActSearch('');setActFilterDir('');setActFilterStatus('');}}>Clear</button>
            )}
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th style={{width:'40px'}}><input type="checkbox" checked={filteredActivities.slice((currentPage-1)*ITEMS_PER_PAGE, currentPage*ITEMS_PER_PAGE).length > 0 && filteredActivities.slice((currentPage-1)*ITEMS_PER_PAGE, currentPage*ITEMS_PER_PAGE).every(a => selectedIds.has(a.id))} onChange={toggleSelectAll} style={{width:'16px',height:'16px',cursor:'pointer'}}/></th><th>Date</th><th>Client</th><th>Client Type</th><th>Activity Type</th><th>ISIN/Ticker</th><th>Size</th><th>Currency</th><th>Direction</th><th>Price</th><th>Status</th><th>Notes</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filteredActivities.length===0?(<tr><td colSpan="13" style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>{activities.length===0?'No activities yet. Add your first activity above!':'No activities match your filters.'}</td></tr>):(
                  filteredActivities.slice((currentPage-1)*ITEMS_PER_PAGE, currentPage*ITEMS_PER_PAGE).map(a=>(
                    <tr key={a.id} style={selectedIds.has(a.id) ? {background:'var(--accent-glow)'} : undefined}>
                      <td><input type="checkbox" checked={selectedIds.has(a.id)} onChange={()=>toggleSelect(a.id)} style={{width:'16px',height:'16px',cursor:'pointer'}}/></td>
                      <td>{a.createdAt?new Date(a.createdAt).toLocaleDateString():'-'}</td>
                      <td style={{fontWeight:600}}>{a.clientName}</td>
                      <td>{a.clientType?<span className="badge badge-primary">{a.clientType}</span>:'-'}</td>
                      <td><span className="badge badge-primary">{a.activityType}</span></td>
                      <td>{a.isin||a.ticker||'-'}</td>
                      <td>{a.size}MM</td>
                      <td>{a.currency}</td>
                      <td><span className={`badge ${dirBadge(a.direction)}`}>{a.direction}</span></td>
                      <td>
                        {['ENQUIRY','QUOTED'].includes(a.status) ? (
                          <input
                            type="number"
                            step="0.0001"
                            defaultValue={a.price||''}
                            placeholder="Price"
                            className="inline-price-input"
                            onBlur={e=>handleInlinePriceUpdate(a.id,e.target.value)}
                            onKeyDown={e=>{if(e.key==='Enter')e.target.blur();}}
                            title={savingPrice[a.id]?'Saving...':'Enter price, then press Enter or click away'}
                          />
                        ) : (a.price||'-')}
                      </td>
                      <td>
                        <select
                          value={a.status}
                          onChange={e=>handleInlineStatusChange(a.id,e.target.value)}
                          className={`inline-status-select status-${a.status.replace(/\s+/g,'-').toLowerCase()}`}
                          disabled={savingStatus[a.id]}
                        >
                          <option value="ENQUIRY">Enquiry</option>
                          <option value="QUOTED">Quoted</option>
                          <option value="EXECUTED">Executed</option>
                          <option value="PASSED">Passed</option>
                          <option value="TRADED AWAY">Traded Away</option>
                        </select>
                      </td>
                      <td style={{maxWidth:'180px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={a.notes||''}>{a.notes||'-'}</td>
                      <td><div style={{display:'flex',gap:'8px'}}><button className="btn-icon" onClick={()=>handleDeleteActivity(a.id)} title="Delete">🗑️</button></div></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredActivities.length > ITEMS_PER_PAGE && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderTop:'1px solid var(--border)'}}>
              <span style={{fontSize:'13px',color:'var(--text-muted)'}}>
                Page {currentPage} of {Math.ceil(filteredActivities.length/ITEMS_PER_PAGE)} · Showing {(currentPage-1)*ITEMS_PER_PAGE+1}–{Math.min(currentPage*ITEMS_PER_PAGE,filteredActivities.length)} of {filteredActivities.length} entries
              </span>
              <div style={{display:'flex',gap:'8px'}}>
                <button className="btn btn-secondary" onClick={()=>setCurrentPage(p=>p-1)} disabled={currentPage===1} style={{fontSize:'12px',padding:'6px 12px'}}>← Prev</button>
                <button className="btn btn-secondary" onClick={()=>setCurrentPage(p=>p+1)} disabled={currentPage>=Math.ceil(filteredActivities.length/ITEMS_PER_PAGE)} style={{fontSize:'12px',padding:'6px 12px'}}>Next →</button>
              </div>
            </div>
          )}
        </div>
      </main>
      <style jsx>{`
        .app-container{min-height:100vh;background:var(--bg-base);color:var(--text-primary);}
        .main-content{max-width:1400px;margin:0 auto;padding:32px 24px;}
        .page-header{margin-bottom:32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:24px;}
        .page-title{font-size:32px;font-weight:700;color:var(--text-primary);margin-bottom:8px;}
        .page-description{font-size:16px;color:var(--text-secondary);}
        .stats-summary{display:flex;gap:24px;}
        .stat-item{text-align:center;}
        .stat-value{font-size:24px;font-weight:700;color:var(--accent);}
        .stat-label{font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;}
        .card{background:var(--card-bg);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);}
        .card-header{font-size:17px;font-weight:700;color:var(--text-primary);padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
        .form-grid{padding:24px;}
        .field-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;}
        .field-group{display:flex;flex-direction:column;}
        .form-label{display:block;font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:5px;}
        .form-hint{font-size:11.5px;color:var(--text-muted);margin-top:4px;}
        .form-input,.form-select,.form-textarea{width:100%;padding:10px 14px;background:var(--bg-input);border:1.5px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:14px;transition:all 0.2s ease;font-family:inherit;}
        .form-input:focus,.form-select:focus,.form-textarea:focus{outline:none;border-color:var(--border-focus);background:var(--bg-input-focus);box-shadow:0 0 0 3px var(--accent-glow);}
        .form-textarea{resize:vertical;}
        .auto-filled-info{font-size:11px;color:var(--autofill-text);background:var(--autofill-bg);padding:6px 10px;border-radius:6px;margin-top:6px;border:1px solid var(--autofill-border);}
        .btn{padding:10px 18px;border-radius:8px;font-weight:600;font-size:13.5px;transition:all 0.2s ease;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:7px;font-family:inherit;white-space:nowrap;}
        .btn-primary{background:linear-gradient(135deg,var(--accent),var(--accent-hover));color:#fff;box-shadow:0 2px 8px var(--accent-glow-strong);}
        .btn-primary:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px var(--accent-glow-strong);}
        .btn-primary:disabled{opacity:0.5;cursor:not-allowed;}
        .btn-secondary{background:var(--btn-secondary-bg);color:#fff;padding:8px 14px;font-size:13px;}
        .btn-secondary:hover{background:var(--btn-secondary-hover);}
        .btn-muted{background:var(--btn-muted-bg);color:var(--btn-muted-text);}
        .btn-muted:hover{background:var(--btn-muted-hover);}
        .btn-icon{background:none;border:none;cursor:pointer;font-size:16px;padding:4px;transition:transform 0.2s;}
        .btn-icon:hover{transform:scale(1.2);}
        .btn-danger{background:#dc2626;color:#fff;padding:8px 14px;font-size:13px;}.btn-danger:hover{background:#b91c1c;}
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
        .badge-warning{background:var(--badge-warning-bg);color:var(--badge-warning-text);}
        .badge-danger{background:var(--badge-danger-bg);color:var(--badge-danger-text);}
        .spinner{display:inline-block;width:10px;height:10px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .inline-status-select{padding:4px 8px;border-radius:20px;font-size:11px;font-weight:600;border:1.5px solid var(--border);background:var(--bg-input);color:var(--text-primary);cursor:pointer;font-family:inherit;appearance:auto;}
        .inline-status-select:focus{outline:none;border-color:var(--border-focus);}
        .inline-status-select:disabled{opacity:0.6;cursor:wait;}
        .inline-status-select.status-enquiry{background:var(--badge-primary-bg);color:var(--badge-primary-text);border-color:var(--badge-primary-text);}
        .inline-status-select.status-quoted{background:var(--badge-warning-bg);color:var(--badge-warning-text);border-color:var(--badge-warning-text);}
        .inline-status-select.status-executed{background:var(--badge-success-bg);color:var(--badge-success-text);border-color:var(--badge-success-text);}
        .inline-status-select.status-passed{background:var(--badge-danger-bg);color:var(--badge-danger-text);border-color:var(--badge-danger-text);}
        .inline-status-select.status-traded-away{background:var(--badge-danger-bg);color:var(--badge-danger-text);border-color:var(--badge-danger-text);}
        .inline-price-input{width:90px;padding:4px 8px;background:var(--bg-input);border:1.5px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:13px;font-family:inherit;}
        .inline-price-input:focus{outline:none;border-color:var(--border-focus);background:var(--bg-input-focus);}
        .filter-bar{display:flex;align-items:center;gap:10px;padding:12px 24px;background:var(--table-header-bg);border-bottom:1px solid var(--border);flex-wrap:wrap;}
        .filter-search-wrap{position:relative;flex:1;min-width:180px;}
        .filter-search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none;}
        .filter-input{width:100%;padding:7px 32px 7px 30px;background:var(--bg-input);border:1.5px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;font-family:inherit;transition:border-color 0.2s;}
        .filter-input:focus{outline:none;border-color:var(--border-focus);box-shadow:0 0 0 3px var(--accent-glow);}
        .filter-clear-x{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;line-height:1;padding:0;display:flex;align-items:center;}
        .filter-clear-x:hover{color:var(--text-primary);}
        .filter-select{padding:7px 10px;background:var(--bg-input);border:1.5px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;font-family:inherit;cursor:pointer;transition:border-color 0.2s;}
        .filter-select:focus{outline:none;border-color:var(--border-focus);}
        .form-error-banner{background:#fee2e2;border:1px solid #ef4444;color:#dc2626;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;}
        @media(max-width:768px){.field-row{grid-template-columns:1fr;}.stats-summary{width:100%;justify-content:space-between;}.card-header{flex-direction:column;gap:12px;align-items:flex-start;}.filter-bar{flex-direction:column;align-items:stretch;}.filter-search-wrap{min-width:100%;}}
      `}</style>
    </div>
  );
}
