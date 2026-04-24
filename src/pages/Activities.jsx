import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, where, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';
import { logAudit } from '../services/audit.service';
import { canExport } from '../config/moduleAccess';

export default function Activities() {
  const { userData, currentUser, isAdmin, orgPlan } = useAuth();
  const [activityForm, setActivityForm] = useState({ clientName:'',activityType:'',isin:'',ticker:'',size:'',currency:'USD',otherCurrency:'',price:'',bidPrice:'',offerPrice:'',direction:'',status:'',notes:'',followUpDate:'' });
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
  const [actColFilters, setActColFilters] = useState({ date:'', client:'', clientType:'', activityType:'', isin:'', size:'', currency:'', direction:'', price:'', status:'', notes:'', followUp:'', createdBy:'' });
  const [selectedIds, setSelectedIds] = useState(new Set());
  // Toast and confirm modal state
  const [toastMsg, setToastMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, label } or { bulk: true, count: N }
  const [followUpBannerOpen, setFollowUpBannerOpen] = useState(true);
  const toastTimerRef = useRef(null);

  function showToast(msg) {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(''), 3000);
  }

  useEffect(() => {
    if (!userData?.organizationId) { setLoading(false); return; }
    const unsubscribes = [];
    try {
      // Non-admin sales only see activities where their name is in the
      // denormalized coverageUsers array (primary OR backup coverage). This
      // filter is required by Firestore rules — an unfiltered query by a
      // non-admin would be rejected with "missing or insufficient permissions".
      const actsColl = collection(db, `organizations/${userData.organizationId}/activities`);
      const myName = (userData?.name || '').trim();
      const activitiesQuery = isAdmin || !myName
        ? query(actsColl, orderBy('createdAt', 'desc'))
        : query(actsColl, where('coverageUsers', 'array-contains', myName), orderBy('createdAt', 'desc'));
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
  },[userData?.organizationId, userData?.name, isAdmin]);

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
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const r=await fetch('/.netlify/functions/bloomberg-lookup',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${idToken}`},body:JSON.stringify(type==='isin'?{isin:value}:{ticker:value})});
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
    if(activityForm.status==='EXECUTED'){
      const isTW=activityForm.direction==='TWO-WAY';
      if(isTW && !activityForm.bidPrice && !activityForm.offerPrice){ setFormError('Price is required for Executed activities. Please enter at least a bid or offer price.'); return; }
      if(!isTW && !activityForm.price){ setFormError('Price is required for Executed activities.'); return; }
    }
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
      const isTwoWay = activityForm.direction === 'TWO-WAY';
      // coverageUsers is the denormalized list of sales people who "own" this
      // activity for scope-filtering in the dashboard and (V2) Firestore rule
      // enforcement. We keep salesCoverage as a string for display and also
      // mirror the backup on salesCoverageSecondary for legibility.
      const primary = (sc?.salesCoverage || '').trim();
      const secondary = (sc?.salesCoverageSecondary || '').trim();
      const coverageUsers = [primary, secondary].filter(Boolean);
      const data={clientName:activityForm.clientName,clientType:sc?.type||'',clientRegion:sc?.region||'',salesCoverage:primary,salesCoverageSecondary:secondary,coverageUsers,activityType:activityForm.activityType,isin:activityForm.isin.toUpperCase(),ticker:activityForm.ticker.toUpperCase(),size:parseFloat(activityForm.size)||0,currency:activityForm.currency==='OTHER'?activityForm.otherCurrency:activityForm.currency,price:isTwoWay?null:(activityForm.price?parseFloat(activityForm.price):null),bidPrice:isTwoWay&&activityForm.bidPrice?parseFloat(activityForm.bidPrice):null,offerPrice:isTwoWay&&activityForm.offerPrice?parseFloat(activityForm.offerPrice):null,direction:activityForm.direction,status:activityForm.status,notes:activityForm.notes,followUpDate:activityForm.followUpDate||null,createdAt:serverTimestamp(),createdBy:userData.name||userData.email};
      if(editingActivity){await updateDoc(doc(db,`organizations/${userData.organizationId}/activities`,editingActivity),data);setEditingActivity(null);}
      else{await addDoc(collection(db,`organizations/${userData.organizationId}/activities`),data);}
      setFormError('');
      setActivityForm({clientName:'',activityType:'',isin:'',ticker:'',size:'',currency:'USD',otherCurrency:'',price:'',bidPrice:'',offerPrice:'',direction:'',status:'',notes:'',followUpDate:''});
    }catch(e){console.error(e);showToast('Failed to save activity');}finally{setSubmitLoading(false);}
  }

  async function handleDeleteActivity(id){
    setDeleteConfirm({ id, label: 'this activity' });
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    if (deleteConfirm.bulk) {
      try {
        for (const id of selectedIds) {
          await deleteDoc(doc(db, `organizations/${userData.organizationId}/activities`, id));
        }
        setSelectedIds(new Set());
      } catch (e) {
        console.error(e);
        showToast('Failed to delete some activities');
      }
    } else {
      try {
        await deleteDoc(doc(db,`organizations/${userData.organizationId}/activities`,deleteConfirm.id));
      } catch(e) {
        showToast('Failed to delete');
      }
    }
    setDeleteConfirm(null);
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setDeleteConfirm({ bulk: true, count: selectedIds.size });
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
    setActivityForm({clientName:a.clientName,activityType:a.activityType,isin:a.isin,ticker:a.ticker,size:a.size.toString(),currency:['USD','EUR','GBP','AUD','HKD','SGD','CNH'].includes(a.currency)?a.currency:'OTHER',otherCurrency:['USD','EUR','GBP','AUD','HKD','SGD','CNH'].includes(a.currency)?'':a.currency,price:a.price?.toString()||'',bidPrice:a.bidPrice?.toString()||'',offerPrice:a.offerPrice?.toString()||'',direction:a.direction,status:a.status,notes:a.notes||'',followUpDate:a.followUpDate||''});
    setEditingActivity(a.id);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  async function handleInlineStatusChange(activityId, newStatus) {
    setSavingStatus(p => ({...p, [activityId]: true}));
    try {
      await updateDoc(doc(db, `organizations/${userData.organizationId}/activities`, activityId), { status: newStatus });
    } catch(e) {
      console.error(e);
      showToast('Failed to update status');
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
      showToast('Failed to update price');
    } finally {
      setSavingPrice(p => ({...p, [activityId]: false}));
    }
  }

  async function handleInlineBidOfferUpdate(activityId, field, value) {
    setSavingPrice(p => ({...p, [activityId]: true}));
    try {
      await updateDoc(doc(db, `organizations/${userData.organizationId}/activities`, activityId), {
        [field]: value !== '' ? parseFloat(value) : null
      });
    } catch(e) {
      console.error(e);
      showToast('Failed to update price');
    } finally {
      setSavingPrice(p => ({...p, [activityId]: false}));
    }
  }

  const formatDisplayPrice=(a)=>a.direction==='TWO-WAY'&&(a.bidPrice!=null||a.offerPrice!=null)?`${a.bidPrice??'-'} / ${a.offerPrice??'-'}`:a.price??'';
  const activitiesWithDisplayPrice=()=>activities.map(a=>({...a,displayPrice:formatDisplayPrice(a)}));

  function handleExportExcel(){
    if(activities.length===0){showToast('No activities to export!');return;}
    exportToExcel(activitiesWithDisplayPrice(),[
      {header:'Date',field:'createdAt'},{header:'Client',field:'clientName'},{header:'Activity Type',field:'activityType'},
      {header:'ISIN',field:'isin'},{header:'Ticker',field:'ticker'},{header:'Size (MM)',field:'size'},
      {header:'Currency',field:'currency'},{header:'Direction',field:'direction'},{header:'Price',field:'displayPrice'},
      {header:'Status',field:'status'},{header:'Notes',field:'notes'},{header:'Follow-Up Date',field:'followUpDate'},{header:'Created By',field:'createdBy'}
    ],'activity-log-export','Activity Log');
    if(userData?.organizationId) logAudit(userData.organizationId,{action:'export_activities_excel',details:`Exported ${activities.length} activities to Excel`,userId:currentUser?.uid,userName:userData?.name,userEmail:userData?.email});
  }

  function handleExportPDF(){
    if(activities.length===0){showToast('No activities to export!');return;}
    exportToPDF(activitiesWithDisplayPrice(),[
      {header:'Date',field:'createdAt'},{header:'Client',field:'clientName'},{header:'Type',field:'activityType'},
      {header:'ISIN',field:'isin'},{header:'Ticker',field:'ticker'},{header:'Size (MM)',field:'size'},
      {header:'Currency',field:'currency'},{header:'Direction',field:'direction'},
      {header:'Price',field:'displayPrice'},{header:'Status',field:'status'},{header:'Notes',field:'notes'}
    ],'activity-log-export','Activity Log');
    if(userData?.organizationId) logAudit(userData.organizationId,{action:'export_activities_pdf',details:`Exported ${activities.length} activities to PDF`,userId:currentUser?.uid,userName:userData?.name,userEmail:userData?.email});
  }

  function handleExportCSV(){
    if(activities.length===0){showToast('No activities to export!');return;}
    const exportData=activitiesWithDisplayPrice();
    const cols=[{h:'Date',f:'createdAt'},{h:'Client',f:'clientName'},{h:'Activity Type',f:'activityType'},{h:'ISIN',f:'isin'},{h:'Ticker',f:'ticker'},{h:'Size (MM)',f:'size'},{h:'Currency',f:'currency'},{h:'Direction',f:'direction'},{h:'Price',f:'displayPrice'},{h:'Status',f:'status'},{h:'Notes',f:'notes'},{h:'Follow-Up Date',f:'followUpDate'},{h:'Created By',f:'createdBy'}];
    const esc=v=>{const s=String(v??'');return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:s;};
    const csv=[cols.map(c=>c.h).join(','),...exportData.map(a=>cols.map(c=>esc(a[c.f])).join(','))].join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);const el=document.createElement('a');el.href=url;el.download='activity-log-export.csv';el.click();URL.revokeObjectURL(url);
    if(userData?.organizationId) logAudit(userData.organizationId,{action:'export_activities_csv',details:`Exported ${activities.length} activities to CSV`,userId:currentUser?.uid,userName:userData?.name,userEmail:userData?.email});
  }

  const hasActColFilters = Object.values(actColFilters).some(v => v.trim());
  const filteredActivities = activities.filter(a => {
    if (actFilterDir && a.direction !== actFilterDir) return false;
    if (actFilterStatus && a.status !== actFilterStatus) return false;
    if (actSearch) {
      const q = actSearch.toLowerCase();
      if (!(
        a.clientName?.toLowerCase().includes(q) ||
        a.isin?.toLowerCase().includes(q) ||
        a.ticker?.toLowerCase().includes(q) ||
        a.notes?.toLowerCase().includes(q) ||
        a.createdBy?.toLowerCase().includes(q) ||
        a.activityType?.toLowerCase().includes(q)
      )) return false;
    }
    if (hasActColFilters) {
      const f = actColFilters;
      if (f.date && !(a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '').toLowerCase().includes(f.date.toLowerCase())) return false;
      if (f.client && !(a.clientName || '').toLowerCase().includes(f.client.toLowerCase())) return false;
      if (f.clientType && !(a.clientType || '').toLowerCase().includes(f.clientType.toLowerCase())) return false;
      if (f.activityType && !(a.activityType || '').toLowerCase().includes(f.activityType.toLowerCase())) return false;
      if (f.isin && !((a.isin || '') + ' ' + (a.ticker || '')).toLowerCase().includes(f.isin.toLowerCase())) return false;
      if (f.size && !(String(a.size || '')).toLowerCase().includes(f.size.toLowerCase())) return false;
      if (f.currency && !(a.currency || '').toLowerCase().includes(f.currency.toLowerCase())) return false;
      if (f.direction && !(a.direction || '').toLowerCase().includes(f.direction.toLowerCase())) return false;
      if (f.price && !(String(a.price || '') + ' ' + String(a.bidPrice || '') + ' ' + String(a.offerPrice || '')).toLowerCase().includes(f.price.toLowerCase())) return false;
      if (f.status && !(a.status || '').toLowerCase().includes(f.status.toLowerCase())) return false;
      if (f.notes && !(a.notes || '').toLowerCase().includes(f.notes.toLowerCase())) return false;
      if (f.followUp && !(a.followUpDate || '').toLowerCase().includes(f.followUp.toLowerCase())) return false;
    }
    return true;
  });

  // Compute follow-ups due within 7 days
  const today = new Date();
  today.setHours(0,0,0,0);
  const dueSoon = activities.filter(a => {
    if (!a.followUpDate) return false;
    if (a.followUpCompletedAt) return false; // already checked off
    const d = new Date(a.followUpDate);
    d.setHours(0,0,0,0);
    return d <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  }).sort((a,b)=>new Date(a.followUpDate)-new Date(b.followUpDate));

  async function markFollowUpDone(id) {
    try {
      await updateDoc(doc(db, `organizations/${userData.organizationId}/activities`, id), {
        followUpCompletedAt: serverTimestamp(),
        followUpCompletedBy: userData.name || userData.email || '',
      });
    } catch (e) {
      console.error('Failed to mark follow-up done', e);
      showToast('Failed to mark follow-up done');
    }
  }

  const dirBadge=(d)=>({'BUY':'badge-success','SELL':'badge-danger','TWO-WAY':'badge-warning'}[d]||'badge-primary');
  const stsBadge=(s)=>({'ENQUIRY':'badge-primary','QUOTED':'badge-warning','EXECUTED':'badge-success','PASSED':'badge-danger','TRADED AWAY':'badge-danger'}[s]||'badge-primary');

  if(loading) return(<div className="app-container"><Navigation/><div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'50vh'}}><div style={{textAlign:'center'}}><div className="spinner" style={{width:'40px',height:'40px',margin:'0 auto 16px'}}></div><div style={{color:'var(--text-primary)'}}>Loading activities...</div></div></div></div>);

  return (
    <div className="app-container">
      <Navigation/>
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Trade Activities</h1>
            <p className="page-description">Track client interactions and bond trading activities</p>
          </div>
          <div className="stats-summary">
            <div className="stat-item"><div className="stat-value">{stats.totalActivities}</div><div className="stat-label">Total</div></div>
            <div className="stat-item"><div className="stat-value">${stats.totalVolume}MM</div><div className="stat-label">Volume</div></div>
            <div className="stat-item"><div className="stat-value" style={{color:'#22c55e'}}>{stats.buyCount}</div><div className="stat-label">Buy</div></div>
            <div className="stat-item"><div className="stat-value" style={{color:'#ef4444'}}>{stats.sellCount}</div><div className="stat-label">Sell</div></div>
          </div>
        </div>

        {/* Follow-Up Banner */}
        {dueSoon.length > 0 && (
          <div style={{marginBottom:'24px',border:'1px solid rgba(200,162,88,0.4)',borderRadius:'10px',background:'rgba(200,162,88,0.08)',overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',cursor:'pointer',userSelect:'none'}} onClick={()=>setFollowUpBannerOpen(p=>!p)}>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <span style={{fontWeight:700,fontSize:'14px',color:'#C8A258'}}>Follow-Ups Due</span>
                <span style={{background:'#C8A258',color:'#0F2137',borderRadius:'12px',padding:'2px 8px',fontSize:'12px',fontWeight:700}}>{dueSoon.length}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                <span style={{fontSize:'12px',color:'var(--text-muted)'}}>{followUpBannerOpen?'▲ Collapse':'▼ Expand'}</span>
                <button onClick={e=>{e.stopPropagation();setFollowUpBannerOpen(false);}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:'18px',lineHeight:1,padding:'0 4px'}} title="Dismiss">×</button>
              </div>
            </div>
            {followUpBannerOpen && (
              <div style={{borderTop:'1px solid rgba(200,162,88,0.2)',padding:'4px 0 8px'}}>
                {dueSoon.map(a => {
                  const dDate = new Date(a.followUpDate);
                  dDate.setHours(0,0,0,0);
                  const isOverdue = dDate < today;
                  const isToday = dDate.getTime() === today.getTime();
                  const label = isOverdue ? 'Overdue' : isToday ? 'Today' : a.followUpDate;
                  return (
                    <div key={a.id} style={{display:'flex',alignItems:'center',gap:'16px',padding:'8px 20px',borderBottom:'1px solid rgba(200,162,88,0.1)'}}>
                      <button
                        onClick={()=>markFollowUpDone(a.id)}
                        title="Mark follow-up as done"
                        aria-label="Mark follow-up as done"
                        style={{
                          width:'18px', height:'18px', flexShrink:0,
                          border:'1.5px solid rgba(200,162,88,0.6)',
                          borderRadius:'4px', background:'transparent', cursor:'pointer',
                          padding:0, display:'flex', alignItems:'center', justifyContent:'center',
                          transition:'background 0.15s, border-color 0.15s',
                        }}
                        onMouseEnter={e=>{e.currentTarget.style.background='rgba(200,162,88,0.18)';e.currentTarget.style.borderColor='#C8A258';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.borderColor='rgba(200,162,88,0.6)';}}
                      />
                      <span style={{fontWeight:600,fontSize:'13px',color:'var(--text-primary)',minWidth:'160px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.clientName}</span>
                      <span style={{fontSize:'12px',color:'var(--text-muted)',minWidth:'120px'}}>{a.isin||a.ticker||'—'}</span>
                      <span style={{fontSize:'12px',fontWeight:700,color:isOverdue?'#ef4444':isToday?'#f59e0b':'#C8A258',minWidth:'80px'}}>{label}</span>
                      <button
                        onClick={()=>{setActSearch(a.clientName);window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});}}
                        style={{marginLeft:'auto',background:'none',border:'1px solid rgba(200,162,88,0.4)',borderRadius:'6px',padding:'3px 10px',fontSize:'12px',fontWeight:600,color:'#C8A258',cursor:'pointer'}}
                      >
                        View
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <span>{editingActivity?'Edit Activity':'New Activity'}</span>
            {editingActivity&&<button className="btn btn-muted" onClick={()=>{setEditingActivity(null);setActivityForm({clientName:'',activityType:'',isin:'',ticker:'',size:'',currency:'USD',otherCurrency:'',price:'',bidPrice:'',offerPrice:'',direction:'',status:'',notes:'',followUpDate:''});}}>Cancel Edit</button>}
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
                  <label className="form-label">Price{activityForm.status==='EXECUTED'?' *':''}{activityForm.direction==='TWO-WAY'?' (Bid / Offer)':''}</label>
                  {activityForm.direction==='TWO-WAY'?(
                    <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                      <input type="number" step="0.0001" className="form-input" placeholder="Bid" value={activityForm.bidPrice} onChange={e=>setActivityForm({...activityForm,bidPrice:e.target.value})} style={{flex:1}}/>
                      <span style={{color:'var(--text-muted)',fontWeight:600}}>/</span>
                      <input type="number" step="0.0001" className="form-input" placeholder="Offer" value={activityForm.offerPrice} onChange={e=>setActivityForm({...activityForm,offerPrice:e.target.value})} style={{flex:1}}/>
                    </div>
                  ):(
                    <input type="number" step="0.0001" className="form-input" placeholder="e.g., 98.75" value={activityForm.price} onChange={e=>setActivityForm({...activityForm,price:e.target.value})}/>
                  )}
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
              <div className="field-row">
                <div className="field-group">
                  <label className="form-label">Follow-Up Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={activityForm.followUpDate}
                    onChange={e=>setActivityForm(p=>({...p,followUpDate:e.target.value}))}
                  />
                  <div className="form-hint">Set a reminder date for follow-up with this client</div>
                </div>
                <div className="field-group"/>
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
            <span>Activity History ({filteredActivities.length < activities.length ? `${filteredActivities.length} of ${activities.length}` : activities.length})</span>
            <div style={{display:'flex',gap:'10px'}}>
              {selectedIds.size > 0 && (
                <button onClick={handleBulkDelete} className="btn btn-danger">Delete {selectedIds.size} Selected</button>
              )}
              <button onClick={handleExportCSV} className="btn btn-secondary">Export CSV</button>
              {canExport('excel', orgPlan) ? (
                <button onClick={handleExportExcel} className="btn btn-secondary">Export Excel</button>
              ) : (
                <button className="btn btn-secondary" disabled title="Upgrade to Growth for Excel export" style={{opacity:0.5,cursor:'not-allowed'}}>Export Excel <span style={{fontSize:'9px',fontWeight:700,background:'rgba(200,162,88,0.15)',color:'#C8A258',padding:'2px 6px',borderRadius:'4px',marginLeft:'4px',letterSpacing:'0.05em',border:'1px solid rgba(200,162,88,0.3)'}}>PRO</span></button>
              )}
              {canExport('pdf', orgPlan) ? (
                <button onClick={handleExportPDF} className="btn btn-secondary">Export PDF</button>
              ) : (
                <button className="btn btn-secondary" disabled title="Upgrade to Growth for PDF export" style={{opacity:0.5,cursor:'not-allowed'}}>Export PDF <span style={{fontSize:'9px',fontWeight:700,background:'rgba(200,162,88,0.15)',color:'#C8A258',padding:'2px 6px',borderRadius:'4px',marginLeft:'4px',letterSpacing:'0.05em',border:'1px solid rgba(200,162,88,0.3)'}}>PRO</span></button>
              )}
            </div>
            {!canExport('excel', orgPlan) && (
              <div style={{fontSize:'11px',color:'#64748b',textAlign:'right',paddingRight:'4px',marginTop:'6px'}}>
                Excel and PDF exports are available on the <span style={{color:'#C8A258',fontWeight:600}}>Growth</span> plan.{' '}
                <a href="mailto:info@axle-finance.com?subject=Upgrade%20to%20Growth" style={{color:'#C8A258',textDecoration:'underline',cursor:'pointer'}}>Learn more</a>
              </div>
            )}
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
                <tr><th style={{width:'40px'}}><input type="checkbox" checked={filteredActivities.slice((currentPage-1)*ITEMS_PER_PAGE, currentPage*ITEMS_PER_PAGE).length > 0 && filteredActivities.slice((currentPage-1)*ITEMS_PER_PAGE, currentPage*ITEMS_PER_PAGE).every(a => selectedIds.has(a.id))} onChange={toggleSelectAll} style={{width:'16px',height:'16px',cursor:'pointer'}}/></th><th>Date</th><th>Client</th><th>Client Type</th><th>Activity Type</th><th>ISIN/Ticker</th><th>Size</th><th>Currency</th><th>Direction</th><th>Price</th><th>Status</th><th>Notes</th><th>Follow-Up</th><th>Actions</th></tr>
                <tr style={{background:'var(--table-header-bg)'}}>
                  <th></th>
                  {['date','client','clientType','activityType','isin','size','currency','direction','price','status','notes','followUp'].map(k=>(
                    <th key={k}><input type="text" className="form-input" placeholder="Filter..." value={actColFilters[k]} onChange={e=>setActColFilters({...actColFilters,[k]:e.target.value})} style={{fontSize:'11px',padding:'4px 8px',width:'100%'}}/></th>
                  ))}
                  <th>{hasActColFilters&&<button className="btn btn-secondary" style={{padding:'4px 10px',fontSize:'11px'}} onClick={()=>setActColFilters({date:'',client:'',clientType:'',activityType:'',isin:'',size:'',currency:'',direction:'',price:'',status:'',notes:'',followUp:'',createdBy:''})}>Clear</button>}</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivities.length===0?(<tr><td colSpan="14" style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>{activities.length===0?'No activities yet. Add your first activity above!':'No activities match your filters.'}</td></tr>):(
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
                        {a.direction==='TWO-WAY'?(
                            <div style={{display:'flex',gap:'2px',alignItems:'center'}}>
                              <input type="number" step="0.0001" defaultValue={a.bidPrice||''} placeholder="Bid" className="inline-price-input" style={{width:'60px'}} onBlur={e=>handleInlineBidOfferUpdate(a.id,'bidPrice',e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.target.blur();}} title={savingPrice[a.id]?'Saving...':'Bid price'}/>
                              <span style={{color:'var(--text-muted)'}}>/</span>
                              <input type="number" step="0.0001" defaultValue={a.offerPrice||''} placeholder="Offer" className="inline-price-input" style={{width:'60px'}} onBlur={e=>handleInlineBidOfferUpdate(a.id,'offerPrice',e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.target.blur();}} title={savingPrice[a.id]?'Saving...':'Offer price'}/>
                            </div>
                        ):(
                            <input type="number" step="0.0001" defaultValue={a.price||''} placeholder="Price" className="inline-price-input" onBlur={e=>handleInlinePriceUpdate(a.id,e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.target.blur();}} title={savingPrice[a.id]?'Saving...':'Enter price, then press Enter or click away'}/>
                        )}
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
                      <td>
                        {a.followUpDate ? (
                          <span style={{fontSize:'12px',fontWeight:600,color:new Date(a.followUpDate)<today?'#ef4444':new Date(a.followUpDate).getTime()===today.getTime()?'#f59e0b':'#C8A258'}}>
                            {a.followUpDate}
                          </span>
                        ) : '-'}
                      </td>
                      <td><div style={{display:'flex',gap:'8px'}}><button className="btn-icon" onClick={()=>handleDeleteActivity(a.id)} title="Delete"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/><path d="M10 11v6M14 11v6"/></svg></button></div></td>
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

      {/* Toast notification */}
      {toastMsg && (
        <div style={{position:'fixed',top:'20px',right:'20px',zIndex:10000,background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px 20px',boxShadow:'0 8px 32px rgba(0,0,0,0.3)',fontSize:'14px',fontWeight:600,color:'var(--text-primary)',display:'flex',alignItems:'center',gap:'10px',maxWidth:'320px'}}>
          {toastMsg}
          <button onClick={()=>setToastMsg('')} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:'18px',lineHeight:1,padding:'0 4px'}}>×</button>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div style={{position:'fixed',inset:0,zIndex:10001,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setDeleteConfirm(null)}>
          <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:'14px',padding:'32px',maxWidth:'380px',width:'90%',boxShadow:'0 16px 48px rgba(0,0,0,0.4)'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:'18px',fontWeight:700,color:'var(--text-primary)',textAlign:'center',marginBottom:'8px'}}>Confirm Delete</div>
            <div style={{fontSize:'14px',color:'var(--text-secondary)',textAlign:'center',marginBottom:'28px'}}>
              {deleteConfirm.bulk
                ? `Delete ${deleteConfirm.count} selected activit${deleteConfirm.count===1?'y':'ies'}? This cannot be undone.`
                : 'Delete this activity? This cannot be undone.'}
            </div>
            <div style={{display:'flex',gap:'12px',justifyContent:'center'}}>
              <button className="btn btn-muted" onClick={()=>setDeleteConfirm(null)} style={{minWidth:'100px'}}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete} style={{minWidth:'100px'}}>Delete</button>
            </div>
          </div>
        </div>
      )}

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
