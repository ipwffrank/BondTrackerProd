import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';
import { logAudit } from '../services/audit.service';

export default function Analytics() {
  const { userData, currentUser, isAdmin } = useAuth();
  const _audit = (action, details) => { if(userData?.organizationId) logAudit(userData.organizationId,{action,details,userId:currentUser?.uid,userName:userData?.name,userEmail:userData?.email}); };
  const [activities, setActivities] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState(isAdmin ? 'desk' : 'my');
  const [stats, setStats] = useState({
    totalActivities:0,totalVolume:0,totalClients:0,
    buyCount:0,sellCount:0,twoWayCount:0,
    enquiryCount:0,quotedCount:0,executedCount:0,passedCount:0,tradedAwayCount:0,
    topClients:[],topUsers:[],currencyBreakdown:{},
    activityTypeBreakdown:{},regionBreakdown:{},conversionRate:0,
    executedVolume:0,avgTicketSize:0
  });
  const [tooltipState, setTooltipState] = useState({ visible: false, type: null, data: null, rect: null });
  const hideTimerRef = useRef(null);

  useEffect(() => {
    if(!userData?.organizationId){ setLoading(false); return; }
    const unsubscribes = [];
    try {
      unsubscribes.push(onSnapshot(query(collection(db,`organizations/${userData.organizationId}/activities`),orderBy('createdAt','desc')),(snapshot)=>{
        const data = snapshot.docs.map(d=>({id:d.id,...d.data(),createdAt:d.data().createdAt?.toDate()}));
        setActivities(data);
        setLoading(false);
      }));
      unsubscribes.push(onSnapshot(collection(db,`organizations/${userData.organizationId}/clients`),(snapshot)=>{
        setClients(snapshot.docs.map(d=>({id:d.id,...d.data()})));
      }));
    } catch(e){ console.error(e); setLoading(false); }
    return ()=>unsubscribes.forEach(u=>u());
  },[userData?.organizationId]);

  // Derive filteredActivities from activities + date range + viewMode
  const filteredActivities = activities.filter(a => {
    const d = a.createdAt;
    if (d) {
      if (startDate && d < new Date(startDate)) return false;
      if (endDate && d > new Date(endDate + 'T23:59:59')) return false;
    }
    if (viewMode === 'my') return a.createdBy === userData?.email || a.createdBy === userData?.name || a.userId === currentUser?.uid;
    return true; // desk view: all activities
  });

  // Recalculate stats whenever activities or dates or viewMode change
  useEffect(() => {
    calculateStats(filteredActivities);
  }, [startDate, endDate, activities, viewMode]);

  function calculateStats(data) {
    const totalActivities = data.length;
    const totalVolume = data.reduce((s,a)=>s+(parseFloat(a.size)||0),0);
    const buyCount = data.filter(a=>a.direction==='BUY').length;
    const sellCount = data.filter(a=>a.direction==='SELL').length;
    const twoWayCount = data.filter(a=>a.direction==='TWO-WAY').length;
    const enquiryCount = data.filter(a=>a.status==='ENQUIRY').length;
    const quotedCount = data.filter(a=>a.status==='QUOTED').length;
    const executedCount = data.filter(a=>a.status==='EXECUTED').length;
    const passedCount = data.filter(a=>a.status==='PASSED').length;
    const tradedAwayCount = data.filter(a=>a.status==='TRADED AWAY').length;
    const executedVolume = data.filter(a=>a.status==='EXECUTED').reduce((s,a)=>s+(parseFloat(a.size)||0),0);
    const conversionRate = totalActivities>0 ? ((executedCount/totalActivities)*100).toFixed(1) : 0;
    const avgTicketSize = executedCount>0 ? (executedVolume/executedCount).toFixed(2) : 0;

    const clientVolumes = {};
    data.forEach(a=>{ if(!clientVolumes[a.clientName]) clientVolumes[a.clientName]=0; clientVolumes[a.clientName]+=parseFloat(a.size)||0; });
    const topClients = Object.entries(clientVolumes).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,volume])=>({name,volume:volume.toFixed(2)}));

    const userCounts = {};
    data.forEach(a=>{ if(!userCounts[a.createdBy]) userCounts[a.createdBy]=0; userCounts[a.createdBy]++; });
    const topUsers = Object.entries(userCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,count])=>({name,count}));

    const currencyBreakdown = {};
    data.forEach(a=>{ if(!currencyBreakdown[a.currency]) currencyBreakdown[a.currency]={count:0,volume:0}; currencyBreakdown[a.currency].count++; currencyBreakdown[a.currency].volume+=parseFloat(a.size)||0; });

    const activityTypeBreakdown = {};
    data.forEach(a=>{ if(!activityTypeBreakdown[a.activityType]) activityTypeBreakdown[a.activityType]=0; activityTypeBreakdown[a.activityType]++; });

    const regionBreakdown = {};
    data.forEach(a=>{ const r=a.clientRegion||'Unknown'; if(!regionBreakdown[r]) regionBreakdown[r]=0; regionBreakdown[r]++; });

    setStats({ totalActivities,totalVolume:totalVolume.toFixed(2),totalClients:new Set(data.map(a=>a.clientName)).size,buyCount,sellCount,twoWayCount,enquiryCount,quotedCount,executedCount,passedCount,tradedAwayCount,topClients,topUsers,currencyBreakdown,activityTypeBreakdown,regionBreakdown,conversionRate,executedVolume:executedVolume.toFixed(2),avgTicketSize });
  }

  // ─── Tooltip helpers ───────────────────────────────────────────────────────
  function showTooltip(type, data, rect) {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setTooltipState({ visible: true, type, data, rect });
  }
  function scheduleHide() {
    hideTimerRef.current = setTimeout(() =>
      setTooltipState(s => ({ ...s, visible: false })), 150);
  }
  function cancelHide() {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }
  function getTooltipStyle(rect) {
    const TIP_W = 280;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.right + 12;
    if (left + TIP_W > vw - 8) left = rect.left - TIP_W - 12;
    let top = rect.top;
    if (top + 320 > vh) top = Math.max(8, vh - 320);
    return { position:'fixed', left, top, zIndex:9999, width:TIP_W };
  }

  // ─── CSV download helpers ───────────────────────────────────────────────────
  function downloadVolumeCSV() {
    const totalVol = parseFloat(stats.totalVolume) || 1;
    const data = Object.entries(stats.currencyBreakdown).sort((a,b)=>b[1].volume-a[1].volume).map(([currency,d]) => ({
      currency,
      totalVolume: d.volume.toFixed(2),
      buyVolume: filteredActivities.filter(a=>a.currency===currency&&a.direction==='BUY').reduce((s,a)=>s+(parseFloat(a.size)||0),0).toFixed(2),
      sellVolume: filteredActivities.filter(a=>a.currency===currency&&a.direction==='SELL').reduce((s,a)=>s+(parseFloat(a.size)||0),0).toFixed(2),
      executedVolume: filteredActivities.filter(a=>a.currency===currency&&a.status==='EXECUTED').reduce((s,a)=>s+(parseFloat(a.size)||0),0).toFixed(2),
      count: d.count,
      pct: ((d.volume/totalVol)*100).toFixed(1)+'%',
    }));
    exportToExcel(data,[
      {header:'Currency',field:'currency'},{header:'Total Volume (MM)',field:'totalVolume'},
      {header:'BUY Volume (MM)',field:'buyVolume'},{header:'SELL Volume (MM)',field:'sellVolume'},
      {header:'Executed Volume (MM)',field:'executedVolume'},{header:'Count',field:'count'},{header:'% of Total',field:'pct'}
    ],'volume-breakdown','Volume');
    _audit('export_analytics_csv','Exported volume breakdown CSV');
  }

  function downloadClientsVolumeCSV() {
    const clientVolumes = {};
    const clientCounts = {};
    filteredActivities.forEach(a => {
      if(!clientVolumes[a.clientName]){ clientVolumes[a.clientName]=0; clientCounts[a.clientName]=0; }
      clientVolumes[a.clientName]+=parseFloat(a.size)||0;
      clientCounts[a.clientName]++;
    });
    const data = Object.entries(clientVolumes).sort((a,b)=>b[1]-a[1]).map(([name,volume])=>({name, totalVolume:volume.toFixed(2), activityCount:clientCounts[name]}));
    exportToExcel(data,[{header:'Client',field:'name'},{header:'Total Volume (MM)',field:'totalVolume'},{header:'Activity Count',field:'activityCount'}],'active-clients-volume','Clients');
    _audit('export_analytics_csv','Exported clients volume CSV');
  }

  function downloadExecutedTradesCSV() {
    const data = filteredActivities.filter(a=>a.status==='EXECUTED').map(a=>({
      date: a.createdAt ? a.createdAt.toLocaleDateString() : '',
      client: a.clientName, isin: a.isin, ticker: a.ticker,
      size: a.size, currency: a.currency, direction: a.direction, price: a.price,
    }));
    exportToExcel(data,[
      {header:'Date',field:'date'},{header:'Client',field:'client'},{header:'ISIN',field:'isin'},
      {header:'Ticker',field:'ticker'},{header:'Size (MM)',field:'size'},{header:'Currency',field:'currency'},
      {header:'Direction',field:'direction'},{header:'Price',field:'price'}
    ],'executed-trades','Executed Trades');
    _audit('export_analytics_csv','Exported executed trades CSV');
  }

  function downloadExecVolumeCSV() {
    const execByCurrency = {};
    filteredActivities.filter(a=>a.status==='EXECUTED').forEach(a=>{
      if(!execByCurrency[a.currency]) execByCurrency[a.currency]={volume:0,count:0};
      execByCurrency[a.currency].volume+=parseFloat(a.size)||0;
      execByCurrency[a.currency].count++;
    });
    const data = Object.entries(execByCurrency).sort((a,b)=>b[1].volume-a[1].volume).map(([currency,d])=>({currency, volume:d.volume.toFixed(2), count:d.count}));
    exportToExcel(data,[{header:'Currency',field:'currency'},{header:'Executed Volume (MM)',field:'volume'},{header:'Count',field:'count'}],'executed-volume-by-currency','Executed Volume');
    _audit('export_analytics_csv','Exported executed volume by currency CSV');
  }

  function downloadClientActivitiesCSV(clientName) {
    const data = filteredActivities.filter(a=>a.clientName===clientName).map(a=>({
      date: a.createdAt ? a.createdAt.toLocaleDateString() : '',
      activityType: a.activityType, isin: a.isin, ticker: a.ticker,
      size: a.size, currency: a.currency, direction: a.direction,
      status: a.status, price: a.price, notes: a.notes,
    }));
    exportToExcel(data,[
      {header:'Date',field:'date'},{header:'Activity Type',field:'activityType'},{header:'ISIN',field:'isin'},
      {header:'Ticker',field:'ticker'},{header:'Size (MM)',field:'size'},{header:'Currency',field:'currency'},
      {header:'Direction',field:'direction'},{header:'Status',field:'status'},{header:'Price',field:'price'},{header:'Notes',field:'notes'}
    ],`${clientName}-activities`,'Client Activities');
    _audit('export_analytics_csv',`Exported ${clientName} activities CSV`);
  }

  function downloadDirectionCSV(direction) {
    const data = filteredActivities.filter(a=>a.direction===direction).map(a=>({
      date: a.createdAt ? a.createdAt.toLocaleDateString() : '',
      client: a.clientName, isin: a.isin, ticker: a.ticker,
      size: a.size, currency: a.currency, status: a.status,
    }));
    exportToExcel(data,[
      {header:'Date',field:'date'},{header:'Client',field:'client'},{header:'ISIN',field:'isin'},
      {header:'Ticker',field:'ticker'},{header:'Size (MM)',field:'size'},{header:'Currency',field:'currency'},{header:'Status',field:'status'}
    ],`${direction}-activities`,`${direction} Activities`);
    _audit('export_analytics_csv',`Exported ${direction} activities CSV`);
  }

  function downloadStatusCSV(status) {
    const data = filteredActivities.filter(a=>a.status===status).map(a=>({
      date: a.createdAt ? a.createdAt.toLocaleDateString() : '',
      client: a.clientName, isin: a.isin, ticker: a.ticker,
      size: a.size, currency: a.currency, direction: a.direction,
    }));
    exportToExcel(data,[
      {header:'Date',field:'date'},{header:'Client',field:'client'},{header:'ISIN',field:'isin'},
      {header:'Ticker',field:'ticker'},{header:'Size (MM)',field:'size'},{header:'Currency',field:'currency'},{header:'Direction',field:'direction'}
    ],`${status.replace(/\s+/g,'-')}-activities`,`${status} Activities`);
    _audit('export_analytics_csv',`Exported ${status} activities CSV`);
  }

  function downloadCurrencyCSV(currency) {
    const data = filteredActivities.filter(a=>a.currency===currency).map(a=>({
      date: a.createdAt ? a.createdAt.toLocaleDateString() : '',
      client: a.clientName, isin: a.isin,
      size: a.size, direction: a.direction, status: a.status, price: a.price,
    }));
    exportToExcel(data,[
      {header:'Date',field:'date'},{header:'Client',field:'client'},{header:'ISIN',field:'isin'},
      {header:'Size (MM)',field:'size'},{header:'Direction',field:'direction'},{header:'Status',field:'status'},{header:'Price',field:'price'}
    ],`${currency}-activities`,`${currency} Activities`);
    _audit('export_analytics_csv',`Exported ${currency} activities CSV`);
  }

  // ─── Tooltip content renderer ───────────────────────────────────────────────
  function renderTooltipContent() {
    const { type, data } = tooltipState;

    if (type === 'stat-activities') {
      return (
        <>
          <div className="hover-card-title">Activity Type Breakdown</div>
          {Object.entries(stats.activityTypeBreakdown).sort((a,b)=>b[1]-a[1]).map(([t,count])=>(
            <div key={t} className="hover-card-row">
              <span className="hover-card-label">{t}</span>
              <span className="hover-card-value">{count}</span>
            </div>
          ))}
          <hr className="hover-card-divider"/>
          <div className="hover-card-row"><span className="hover-card-label">BUY</span><span className="hover-card-value">{stats.buyCount}</span></div>
          <div className="hover-card-row"><span className="hover-card-label">SELL</span><span className="hover-card-value">{stats.sellCount}</span></div>
          <div className="hover-card-row"><span className="hover-card-label">TWO-WAY</span><span className="hover-card-value">{stats.twoWayCount}</span></div>
        </>
      );
    }

    if (type === 'stat-volume') {
      const totalVol = parseFloat(stats.totalVolume) || 1;
      const buyVol = filteredActivities.filter(a=>a.direction==='BUY').reduce((s,a)=>s+(parseFloat(a.size)||0),0);
      const sellVol = filteredActivities.filter(a=>a.direction==='SELL').reduce((s,a)=>s+(parseFloat(a.size)||0),0);
      const twVol = filteredActivities.filter(a=>a.direction==='TWO-WAY').reduce((s,a)=>s+(parseFloat(a.size)||0),0);
      return (
        <>
          <div className="hover-card-title">Volume by Currency</div>
          {Object.entries(stats.currencyBreakdown).sort((a,b)=>b[1].volume-a[1].volume).map(([currency,d])=>{
            const pct = ((d.volume/totalVol)*100).toFixed(0);
            return (
              <div key={currency} style={{marginBottom:'6px'}}>
                <div className="hover-card-row">
                  <span className="hover-card-label">{currency}</span>
                  <span className="hover-card-value">${d.volume.toFixed(1)}MM</span>
                </div>
                <div style={{height:'4px',background:'var(--border)',borderRadius:'2px',overflow:'hidden',marginTop:'2px'}}>
                  <div style={{width:`${pct}%`,height:'100%',background:'var(--accent)',borderRadius:'2px'}}></div>
                </div>
                <div style={{fontSize:'10px',color:'var(--text-muted)',textAlign:'right'}}>{pct}%</div>
              </div>
            );
          })}
          <hr className="hover-card-divider"/>
          <div className="hover-card-row"><span className="hover-card-label">BUY</span><span className="hover-card-value">${buyVol.toFixed(1)}MM</span></div>
          <div className="hover-card-row"><span className="hover-card-label">SELL</span><span className="hover-card-value">${sellVol.toFixed(1)}MM</span></div>
          <div className="hover-card-row"><span className="hover-card-label">TWO-WAY</span><span className="hover-card-value">${twVol.toFixed(1)}MM</span></div>
          <button className="hover-card-csv-btn" onClick={downloadVolumeCSV}>Download CSV</button>
        </>
      );
    }

    if (type === 'stat-clients') {
      const clientVolumes = {};
      const clientCounts = {};
      filteredActivities.forEach(a=>{
        if(!clientVolumes[a.clientName]){ clientVolumes[a.clientName]=0; clientCounts[a.clientName]=0; }
        clientVolumes[a.clientName]+=parseFloat(a.size)||0;
        clientCounts[a.clientName]++;
      });
      const sorted = Object.entries(clientVolumes).sort((a,b)=>b[1]-a[1]).slice(0,8);
      return (
        <>
          <div className="hover-card-title">Active Clients by Volume</div>
          {sorted.map(([name,vol])=>(
            <div key={name} className="hover-card-row">
              <span className="hover-card-label" style={{overflow:'hidden',textOverflow:'ellipsis',maxWidth:'160px'}}>{name}</span>
              <span className="hover-card-value" style={{fontSize:'11px'}}>${vol.toFixed(1)}MM · {clientCounts[name]}</span>
            </div>
          ))}
          <button className="hover-card-csv-btn" onClick={downloadClientsVolumeCSV}>Download CSV</button>
        </>
      );
    }

    if (type === 'stat-executed') {
      const execByClient = {};
      const execVolByClient = {};
      filteredActivities.filter(a=>a.status==='EXECUTED').forEach(a=>{
        if(!execByClient[a.clientName]){ execByClient[a.clientName]=0; execVolByClient[a.clientName]=0; }
        execByClient[a.clientName]++;
        execVolByClient[a.clientName]+=parseFloat(a.size)||0;
      });
      const sorted = Object.entries(execByClient).sort((a,b)=>b[1]-a[1]||execVolByClient[b[0]]-execVolByClient[a[0]]).slice(0,8);
      return (
        <>
          <div className="hover-card-title">Top Clients by Executed Trades</div>
          {sorted.map(([name,count])=>(
            <div key={name} className="hover-card-row">
              <span className="hover-card-label" style={{overflow:'hidden',textOverflow:'ellipsis',maxWidth:'160px'}}>{name}</span>
              <span className="hover-card-value" style={{fontSize:'11px'}}>{count} · ${execVolByClient[name].toFixed(1)}MM</span>
            </div>
          ))}
          <button className="hover-card-csv-btn" onClick={downloadExecutedTradesCSV}>Download CSV</button>
        </>
      );
    }

    if (type === 'stat-exec-volume') {
      const execByCurrency = {};
      filteredActivities.filter(a=>a.status==='EXECUTED').forEach(a=>{
        if(!execByCurrency[a.currency]) execByCurrency[a.currency]={volume:0,count:0};
        execByCurrency[a.currency].volume+=parseFloat(a.size)||0;
        execByCurrency[a.currency].count++;
      });
      return (
        <>
          <div className="hover-card-title">Executed Volume by Currency</div>
          {Object.entries(execByCurrency).sort((a,b)=>b[1].volume-a[1].volume).map(([currency,d])=>(
            <div key={currency} className="hover-card-row">
              <span className="hover-card-label">{currency}</span>
              <span className="hover-card-value">${d.volume.toFixed(1)}MM · {d.count}</span>
            </div>
          ))}
          <button className="hover-card-csv-btn" onClick={downloadExecVolumeCSV}>Download CSV</button>
        </>
      );
    }

    if (type === 'stat-conversion') {
      const total = stats.totalActivities;
      const exec = stats.executedCount;
      const dirs = ['BUY','SELL','TWO-WAY'];
      return (
        <>
          <div className="hover-card-title">Conversion Rate</div>
          <div className="hover-card-row">
            <span className="hover-card-label">Formula</span>
            <span className="hover-card-value">{exec} ÷ {total}</span>
          </div>
          <div className="hover-card-row">
            <span className="hover-card-label">Overall</span>
            <span className="hover-card-value">{stats.conversionRate}%</span>
          </div>
          <hr className="hover-card-divider"/>
          <div className="hover-card-sub">Per Direction</div>
          {dirs.map(dir=>{
            const dirTotal = filteredActivities.filter(a=>a.direction===dir).length;
            const dirExec = filteredActivities.filter(a=>a.direction===dir&&a.status==='EXECUTED').length;
            const rate = dirTotal>0 ? ((dirExec/dirTotal)*100).toFixed(1) : '0.0';
            return (
              <div key={dir} className="hover-card-row">
                <span className="hover-card-label">{dir}</span>
                <span className="hover-card-value">{dirExec}/{dirTotal} = {rate}%</span>
              </div>
            );
          })}
        </>
      );
    }

    if (type === 'stat-avg-ticket') {
      const sizes = filteredActivities.filter(a=>a.status==='EXECUTED').map(a=>parseFloat(a.size)||0).sort((a,b)=>a-b);
      const min = sizes.length ? sizes[0] : 0;
      const max = sizes.length ? sizes[sizes.length-1] : 0;
      const avg = sizes.length ? sizes.reduce((s,v)=>s+v,0)/sizes.length : 0;
      const mid = Math.floor(sizes.length/2);
      const median = sizes.length === 0 ? 0 : sizes.length%2===1 ? sizes[mid] : (sizes[mid-1]+sizes[mid])/2;
      return (
        <>
          <div className="hover-card-title">Ticket Size Stats (Executed)</div>
          <div className="hover-card-row"><span className="hover-card-label">Min</span><span className="hover-card-value">${min.toFixed(2)}MM</span></div>
          <div className="hover-card-row"><span className="hover-card-label">Max</span><span className="hover-card-value">${max.toFixed(2)}MM</span></div>
          <div className="hover-card-row"><span className="hover-card-label">Median</span><span className="hover-card-value">${median.toFixed(2)}MM</span></div>
          <div className="hover-card-row"><span className="hover-card-label">Average</span><span className="hover-card-value">${avg.toFixed(2)}MM</span></div>
          <div className="hover-card-row"><span className="hover-card-label">Count</span><span className="hover-card-value">{sizes.length}</span></div>
        </>
      );
    }

    if (type === 'client') {
      const clientName = data;
      const clientObj = clients.find(c=>c.name===clientName);
      const clientActs = filteredActivities.filter(a=>a.clientName===clientName);
      const clientVol = clientActs.reduce((s,a)=>s+(parseFloat(a.size)||0),0);
      const buyVol = clientActs.filter(a=>a.direction==='BUY').reduce((s,a)=>s+(parseFloat(a.size)||0),0);
      const sellVol = clientActs.filter(a=>a.direction==='SELL').reduce((s,a)=>s+(parseFloat(a.size)||0),0);
      const twVol = clientActs.filter(a=>a.direction==='TWO-WAY').reduce((s,a)=>s+(parseFloat(a.size)||0),0);
      return (
        <>
          <div className="hover-card-title">{clientName}</div>
          {clientObj && (
            <>
              <div className="hover-card-row"><span className="hover-card-label">Type</span><span className="hover-card-value">{clientObj.type||'—'}</span></div>
              <div className="hover-card-row"><span className="hover-card-label">Region</span><span className="hover-card-value">{clientObj.region||'—'}</span></div>
              <div className="hover-card-row"><span className="hover-card-label">Coverage</span><span className="hover-card-value">{clientObj.salesCoverage||'—'}</span></div>
              <div className="hover-card-row"><span className="hover-card-label">Created By</span><span className="hover-card-value">{clientObj.createdBy||'—'}</span></div>
            </>
          )}
          <hr className="hover-card-divider"/>
          <div className="hover-card-row"><span className="hover-card-label">Activities</span><span className="hover-card-value">{clientActs.length}</span></div>
          <div className="hover-card-row"><span className="hover-card-label">Total Volume</span><span className="hover-card-value">${clientVol.toFixed(2)}MM</span></div>
          <div className="hover-card-row"><span className="hover-card-label">BUY</span><span className="hover-card-value">${buyVol.toFixed(1)}MM</span></div>
          <div className="hover-card-row"><span className="hover-card-label">SELL</span><span className="hover-card-value">${sellVol.toFixed(1)}MM</span></div>
          <div className="hover-card-row"><span className="hover-card-label">TWO-WAY</span><span className="hover-card-value">${twVol.toFixed(1)}MM</span></div>
          <button className="hover-card-csv-btn" onClick={()=>downloadClientActivitiesCSV(clientName)}>Download CSV</button>
        </>
      );
    }

    if (type === 'direction') {
      const dir = data;
      const clientVols = {};
      const clientCounts = {};
      filteredActivities.filter(a=>a.direction===dir).forEach(a=>{
        if(!clientVols[a.clientName]){ clientVols[a.clientName]=0; clientCounts[a.clientName]=0; }
        clientVols[a.clientName]+=parseFloat(a.size)||0;
        clientCounts[a.clientName]++;
      });
      const sorted = Object.entries(clientVols).sort((a,b)=>b[1]-a[1]).slice(0,8);
      return (
        <>
          <div className="hover-card-title">Top {dir} Clients</div>
          {sorted.map(([name,vol])=>(
            <div key={name} className="hover-card-row">
              <span className="hover-card-label" style={{overflow:'hidden',textOverflow:'ellipsis',maxWidth:'160px'}}>{name}</span>
              <span className="hover-card-value" style={{fontSize:'11px'}}>${vol.toFixed(1)}MM · {clientCounts[name]}</span>
            </div>
          ))}
          {sorted.length===0 && <div style={{fontSize:'12px',color:'var(--text-muted)'}}>No data</div>}
          <button className="hover-card-csv-btn" onClick={()=>downloadDirectionCSV(dir)}>Download CSV</button>
        </>
      );
    }

    if (type === 'status') {
      const statusVal = data;
      const clientVols = {};
      filteredActivities.filter(a=>a.status===statusVal).forEach(a=>{
        if(!clientVols[a.clientName]) clientVols[a.clientName]=0;
        clientVols[a.clientName]+=parseFloat(a.size)||0;
      });
      const sorted = Object.entries(clientVols).sort((a,b)=>b[1]-a[1]).slice(0,8);
      return (
        <>
          <div className="hover-card-title">Top Clients — {statusVal}</div>
          {sorted.map(([name,vol])=>(
            <div key={name} className="hover-card-row">
              <span className="hover-card-label" style={{overflow:'hidden',textOverflow:'ellipsis',maxWidth:'170px'}}>{name}</span>
              <span className="hover-card-value">${vol.toFixed(1)}MM</span>
            </div>
          ))}
          {sorted.length===0 && <div style={{fontSize:'12px',color:'var(--text-muted)'}}>No data</div>}
          <button className="hover-card-csv-btn" onClick={()=>downloadStatusCSV(statusVal)}>Download CSV</button>
        </>
      );
    }

    if (type === 'currency') {
      const currency = data;
      const currActs = filteredActivities.filter(a=>a.currency===currency);
      const buyVol = currActs.filter(a=>a.direction==='BUY').reduce((s,a)=>s+(parseFloat(a.size)||0),0);
      const sellVol = currActs.filter(a=>a.direction==='SELL').reduce((s,a)=>s+(parseFloat(a.size)||0),0);
      const twVol = currActs.filter(a=>a.direction==='TWO-WAY').reduce((s,a)=>s+(parseFloat(a.size)||0),0);
      const clientVols = {};
      currActs.forEach(a=>{
        if(!clientVols[a.clientName]) clientVols[a.clientName]=0;
        clientVols[a.clientName]+=parseFloat(a.size)||0;
      });
      const topClients = Object.entries(clientVols).sort((a,b)=>b[1]-a[1]).slice(0,5);
      return (
        <>
          <div className="hover-card-title">{currency} Breakdown</div>
          <div className="hover-card-row"><span className="hover-card-label">BUY</span><span className="hover-card-value">${buyVol.toFixed(1)}MM</span></div>
          <div className="hover-card-row"><span className="hover-card-label">SELL</span><span className="hover-card-value">${sellVol.toFixed(1)}MM</span></div>
          <div className="hover-card-row"><span className="hover-card-label">TWO-WAY</span><span className="hover-card-value">${twVol.toFixed(1)}MM</span></div>
          <hr className="hover-card-divider"/>
          <div className="hover-card-sub">Top Clients</div>
          {topClients.map(([name,vol])=>(
            <div key={name} className="hover-card-row">
              <span className="hover-card-label" style={{overflow:'hidden',textOverflow:'ellipsis',maxWidth:'170px'}}>{name}</span>
              <span className="hover-card-value">${vol.toFixed(1)}MM</span>
            </div>
          ))}
          <button className="hover-card-csv-btn" onClick={()=>downloadCurrencyCSV(currency)}>Download CSV</button>
        </>
      );
    }

    return null;
  }

  // Export handlers
  function handleExportPDF() {
    if(filteredActivities.length===0){ alert('No data to export!'); return; }
    const summaryData = [
      { metric:'Total Activities', value:stats.totalActivities },
      { metric:'Total Volume (MM)', value:`$${stats.totalVolume}MM` },
      { metric:'Active Clients', value:stats.totalClients },
      { metric:'Executed Trades', value:stats.executedCount },
      { metric:'Executed Volume (MM)', value:`$${stats.executedVolume}MM` },
      { metric:'Conversion Rate', value:`${stats.conversionRate}%` },
      { metric:'Avg Ticket Size (MM)', value:`$${stats.avgTicketSize}MM` },
      { metric:'Buy Inquiries', value:stats.buyCount },
      { metric:'Sell Inquiries', value:stats.sellCount },
      { metric:'Two Way Inquiries', value:stats.twoWayCount },
      { metric:'Enquiries', value:stats.enquiryCount },
      { metric:'Quoted', value:stats.quotedCount },
      { metric:'Executed', value:stats.executedCount },
      { metric:'Passed', value:stats.passedCount },
      { metric:'Traded Away', value:stats.tradedAwayCount },
    ];
    exportToPDF(summaryData,[{header:'Metric',field:'metric'},{header:'Value',field:'value'}],'analytics-summary','Analytics Summary Report');
    _audit('export_analytics_pdf','Exported analytics summary to PDF');
  }

  function handleExportExcel() {
    if(filteredActivities.length===0){ alert('No data to export!'); return; }
    exportToExcel(filteredActivities,[
      {header:'Date',field:'createdAt'},{header:'Client',field:'clientName'},{header:'Client Type',field:'clientType'},
      {header:'Region',field:'clientRegion'},{header:'Sales Coverage',field:'salesCoverage'},
      {header:'Activity Type',field:'activityType'},{header:'ISIN',field:'isin'},{header:'Ticker',field:'ticker'},
      {header:'Size (MM)',field:'size'},{header:'Currency',field:'currency'},{header:'Price',field:'price'},
      {header:'Direction',field:'direction'},{header:'Status',field:'status'},{header:'Notes',field:'notes'},
      {header:'Created By',field:'createdBy'}
    ],'analytics-full-export','Analytics');
    _audit('export_analytics_excel',`Exported ${filteredActivities.length} analytics records to Excel`);
  }

  // Per-card CSV export handlers
  function handleExportDirectionCSV() {
    const data = [
      { direction: 'BUY', count: stats.buyCount, pct: stats.totalActivities>0?((stats.buyCount/stats.totalActivities)*100).toFixed(1)+'%':'0%' },
      { direction: 'SELL', count: stats.sellCount, pct: stats.totalActivities>0?((stats.sellCount/stats.totalActivities)*100).toFixed(1)+'%':'0%' },
      { direction: 'TWO-WAY', count: stats.twoWayCount, pct: stats.totalActivities>0?((stats.twoWayCount/stats.totalActivities)*100).toFixed(1)+'%':'0%' },
    ];
    exportToExcel(data,[{header:'Direction',field:'direction'},{header:'Count',field:'count'},{header:'% of Total',field:'pct'}],'direction-breakdown','Direction');
    _audit('export_analytics_csv','Exported direction breakdown CSV');
  }

  function handleExportStatusCSV() {
    const data = [
      { status:'ENQUIRY', count:stats.enquiryCount },
      { status:'QUOTED', count:stats.quotedCount },
      { status:'EXECUTED', count:stats.executedCount },
      { status:'PASSED', count:stats.passedCount },
      { status:'TRADED AWAY', count:stats.tradedAwayCount },
    ].map(r => ({...r, pct: stats.totalActivities>0?((r.count/stats.totalActivities)*100).toFixed(1)+'%':'0%'}));
    exportToExcel(data,[{header:'Status',field:'status'},{header:'Count',field:'count'},{header:'% of Total',field:'pct'}],'status-breakdown','Status');
    _audit('export_analytics_csv','Exported status breakdown CSV');
  }

  function handleExportClientsCSV() {
    const clientVolumes = {};
    const clientCounts = {};
    filteredActivities.forEach(a => {
      if(!clientVolumes[a.clientName]) { clientVolumes[a.clientName]=0; clientCounts[a.clientName]=0; }
      clientVolumes[a.clientName]+=parseFloat(a.size)||0;
      clientCounts[a.clientName]++;
    });
    const data = Object.entries(clientVolumes).sort((a,b)=>b[1]-a[1]).map(([name,volume])=>({name, totalVolume:volume.toFixed(2), activityCount:clientCounts[name]}));
    exportToExcel(data,[{header:'Client',field:'name'},{header:'Total Volume (MM)',field:'totalVolume'},{header:'Activity Count',field:'activityCount'}],'top-clients','Clients');
    _audit('export_analytics_csv','Exported top clients CSV');
  }

  function handleExportUsersCSV() {
    const data = stats.topUsers.map(u=>({name:u.name, count:u.count}));
    exportToExcel(data,[{header:'User',field:'name'},{header:'Activity Count',field:'count'}],'active-users','Users');
    _audit('export_analytics_csv','Exported active users CSV');
  }

  function handleExportActivityTypeCSV() {
    const total = stats.totalActivities;
    const data = Object.entries(stats.activityTypeBreakdown).sort((a,b)=>b[1]-a[1]).map(([type,count])=>({type, count, pct: total>0?((count/total)*100).toFixed(1)+'%':'0%'}));
    exportToExcel(data,[{header:'Activity Type',field:'type'},{header:'Count',field:'count'},{header:'%',field:'pct'}],'activity-type-breakdown','Activity Types');
    _audit('export_analytics_csv','Exported activity type breakdown CSV');
  }

  function handleExportRegionCSV() {
    const total = stats.totalActivities;
    const data = Object.entries(stats.regionBreakdown).sort((a,b)=>b[1]-a[1]).map(([region,count])=>({region, count, pct: total>0?((count/total)*100).toFixed(1)+'%':'0%'}));
    exportToExcel(data,[{header:'Region',field:'region'},{header:'Count',field:'count'},{header:'%',field:'pct'}],'region-breakdown','Regions');
    _audit('export_analytics_csv','Exported region breakdown CSV');
  }

  function handleExportCurrencyCSV() {
    const total = parseFloat(stats.totalVolume)||1;
    const data = Object.entries(stats.currencyBreakdown).sort((a,b)=>b[1].volume-a[1].volume).map(([currency,d])=>({
      currency, count:d.count, volume:d.volume.toFixed(2),
      executedVolume: filteredActivities.filter(a=>a.currency===currency&&a.status==='EXECUTED').reduce((s,a)=>s+(parseFloat(a.size)||0),0).toFixed(2),
      pct: ((d.volume/total)*100).toFixed(1)+'%'
    }));
    exportToExcel(data,[{header:'Currency',field:'currency'},{header:'Count',field:'count'},{header:'Volume (MM)',field:'volume'},{header:'Executed Volume (MM)',field:'executedVolume'},{header:'% of Total',field:'pct'}],'currency-breakdown','Currency');
    _audit('export_analytics_csv','Exported currency breakdown CSV');
  }

  // ─── Desk View: Performance by Salesperson ─────────────────────────────────
  function getSalespersonBreakdown() {
    const map = {};
    filteredActivities.forEach(a => {
      const key = a.createdBy || 'Unknown';
      if (!map[key]) map[key] = { name: key, count: 0, volume: 0, executed: 0 };
      map[key].count++;
      map[key].volume += parseFloat(a.size) || 0;
      if (a.status === 'EXECUTED') map[key].executed++;
    });
    return Object.values(map).sort((a,b) => b.volume - a.volume);
  }

  if(loading) return(<div className="app-container"><Navigation/><div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'50vh'}}><div style={{textAlign:'center'}}><div className="spinner" style={{width:'40px',height:'40px',margin:'0 auto 16px'}}></div><div style={{color:'var(--text-primary)'}}>Loading analytics...</div></div></div></div>);

  const statCards = [
    {value:stats.totalActivities, label:'Total Activities', type:'stat-activities'},
    {value:`$${stats.totalVolume}MM`, label:'Total Trades Volume', type:'stat-volume'},
    {value:stats.totalClients, label:'Active Clients', type:'stat-clients'},
    {value:stats.executedCount, label:'Executed Trades', type:'stat-executed'},
    {value:`$${stats.executedVolume}MM`, label:'Executed Volume', type:'stat-exec-volume'},
    {value:`${stats.conversionRate}%`, label:'Conversion Rate', type:'stat-conversion'},
    {value:`$${stats.avgTicketSize}MM`, label:'Average Ticket Size', type:'stat-avg-ticket'},
  ];

  const salespersonRows = viewMode === 'desk' ? getSalespersonBreakdown() : [];

  return (
    <div className="app-container">
      <Navigation/>
      <main className="main-content">

        {/* Header with export buttons */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-description">Business intelligence and performance metrics</p>
          </div>
          <div style={{display:'flex',gap:'10px'}}>
            <button onClick={handleExportExcel} className="btn btn-secondary">Export Excel</button>
            <button onClick={handleExportPDF} className="btn btn-secondary">Export PDF</button>
          </div>
        </div>

        {/* Date Range Filter + View Toggle */}
        <div className="card" style={{marginBottom:'24px'}}>
          <div style={{padding:'16px 24px',display:'flex',alignItems:'center',gap:'16px',flexWrap:'wrap'}}>
            {/* View Mode Toggle */}
            <div style={{display:'flex',gap:'8px',alignItems:'center',marginRight:'8px'}}>
              {['my', 'desk'].map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)} style={{
                  padding:'6px 16px', borderRadius:'6px', border:'1px solid',
                  borderColor: viewMode === mode ? '#C8A258' : 'var(--border)',
                  background: viewMode === mode ? 'rgba(200,162,88,0.1)' : 'transparent',
                  color: viewMode === mode ? '#C8A258' : 'var(--text-secondary)',
                  fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                  transition:'all 0.2s'
                }}>
                  {mode === 'my' ? 'My Activities' : 'Desk View'}
                </button>
              ))}
            </div>
            <div style={{width:'1px',height:'24px',background:'var(--border)',flexShrink:0}}/>
            <span style={{fontSize:'13px',fontWeight:600,color:'var(--text-secondary)'}}>Date Range:</span>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <label style={{fontSize:'12px',color:'var(--text-muted)'}}>From</label>
              <input type="date" className="form-input" style={{padding:'6px 10px',fontSize:'13px',width:'150px'}} value={startDate} onChange={e=>setStartDate(e.target.value)}/>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <label style={{fontSize:'12px',color:'var(--text-muted)'}}>To</label>
              <input type="date" className="form-input" style={{padding:'6px 10px',fontSize:'13px',width:'150px'}} value={endDate} onChange={e=>setEndDate(e.target.value)}/>
            </div>
            {(startDate||endDate) && (
              <button className="btn btn-muted" style={{padding:'6px 12px',fontSize:'12px'}} onClick={()=>{setStartDate('');setEndDate('');}}>Reset</button>
            )}
            <span style={{fontSize:'13px',color:'var(--text-muted)',marginLeft:'auto'}}>
              {(startDate||endDate||viewMode==='my') ? `Showing ${filteredActivities.length} of ${activities.length} activities` : `${activities.length} activities`}
            </span>
          </div>
        </div>

        {/* Overview Stats Cards */}
        <div style={{overflowX:'auto',marginBottom:'24px'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(140px,1fr))',gap:'16px',minWidth:'700px'}}>
            {statCards.map((s,i)=>(
              <div
                key={i}
                className="stat-card"
                style={{position:'relative',cursor:'default'}}
                onMouseEnter={e=>showTooltip(s.type, null, e.currentTarget.getBoundingClientRect())}
                onMouseLeave={scheduleHide}
              >
                <span className="stat-card-hint">i</span>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Direction + Status Row */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'24px'}}>
          <div className="card">
            <div className="card-header">
              <span>Direction Breakdown</span>
              <button onClick={handleExportDirectionCSV} className="btn btn-secondary" style={{fontSize:'12px',padding:'5px 10px'}}>CSV</button>
            </div>
            <div style={{padding:'24px',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>
              <div
                className="breakdown-box"
                style={{background:'var(--badge-success-bg)',cursor:'default'}}
                onMouseEnter={e=>showTooltip('direction','BUY',e.currentTarget.getBoundingClientRect())}
                onMouseLeave={scheduleHide}
              >
                <div style={{fontSize:'28px',fontWeight:'bold',color:'var(--badge-success-text)'}}>{stats.buyCount}</div>
                <div style={{fontSize:'12px',color:'var(--badge-success-text)',marginTop:'4px'}}>BUY</div>
                <div style={{fontSize:'11px',color:'var(--badge-success-text)',opacity:0.7}}>{stats.totalActivities>0?((stats.buyCount/stats.totalActivities)*100).toFixed(0):0}%</div>
              </div>
              <div
                className="breakdown-box"
                style={{background:'var(--badge-danger-bg)',cursor:'default'}}
                onMouseEnter={e=>showTooltip('direction','SELL',e.currentTarget.getBoundingClientRect())}
                onMouseLeave={scheduleHide}
              >
                <div style={{fontSize:'28px',fontWeight:'bold',color:'var(--badge-danger-text)'}}>{stats.sellCount}</div>
                <div style={{fontSize:'12px',color:'var(--badge-danger-text)',marginTop:'4px'}}>SELL</div>
                <div style={{fontSize:'11px',color:'var(--badge-danger-text)',opacity:0.7}}>{stats.totalActivities>0?((stats.sellCount/stats.totalActivities)*100).toFixed(0):0}%</div>
              </div>
              <div
                className="breakdown-box"
                style={{background:'var(--badge-warning-bg)',cursor:'default'}}
                onMouseEnter={e=>showTooltip('direction','TWO-WAY',e.currentTarget.getBoundingClientRect())}
                onMouseLeave={scheduleHide}
              >
                <div style={{fontSize:'28px',fontWeight:'bold',color:'var(--badge-warning-text)'}}>{stats.twoWayCount}</div>
                <div style={{fontSize:'12px',color:'var(--badge-warning-text)',marginTop:'4px'}}>TWO-WAY</div>
                <div style={{fontSize:'11px',color:'var(--badge-warning-text)',opacity:0.7}}>{stats.totalActivities>0?((stats.twoWayCount/stats.totalActivities)*100).toFixed(0):0}%</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span>Status Breakdown</span>
              <button onClick={handleExportStatusCSV} className="btn btn-secondary" style={{fontSize:'12px',padding:'5px 10px'}}>CSV</button>
            </div>
            <div style={{padding:'24px',display:'flex',flexDirection:'column',gap:'10px'}}>
              {[
                {label:'Enquiry',count:stats.enquiryCount,color:'var(--badge-primary-text)',bg:'var(--badge-primary-bg)'},
                {label:'Quoted',count:stats.quotedCount,color:'var(--badge-warning-text)',bg:'var(--badge-warning-bg)'},
                {label:'Executed',count:stats.executedCount,color:'var(--badge-success-text)',bg:'var(--badge-success-bg)'},
                {label:'Passed',count:stats.passedCount,color:'var(--badge-danger-text)',bg:'var(--badge-danger-bg)'},
                {label:'Traded Away',count:stats.tradedAwayCount,color:'var(--badge-danger-text)',bg:'var(--badge-danger-bg)'},
              ].map((s,i)=>(
                <div
                  key={i}
                  style={{display:'flex',alignItems:'center',gap:'12px',cursor:'default',borderRadius:'6px',padding:'2px 4px',transition:'background 0.15s'}}
                  onMouseEnter={e=>showTooltip('status', s.label==='Traded Away'?'TRADED AWAY':s.label.toUpperCase(), e.currentTarget.getBoundingClientRect())}
                  onMouseLeave={scheduleHide}
                >
                  <span style={{fontSize:'12px',fontWeight:600,width:'90px',color:'var(--text-secondary)'}}>{s.label}</span>
                  <div style={{flex:1,height:'8px',background:'var(--border)',borderRadius:'4px',overflow:'hidden'}}>
                    <div style={{width:`${stats.totalActivities>0?(s.count/stats.totalActivities)*100:0}%`,height:'100%',background:s.color,borderRadius:'4px',transition:'width 0.5s'}}></div>
                  </div>
                  <span style={{fontSize:'13px',fontWeight:700,color:s.color,minWidth:'30px',textAlign:'right'}}>{s.count}</span>
                  <span className="badge" style={{background:s.bg,color:s.color,minWidth:'42px',textAlign:'center'}}>
                    {stats.totalActivities>0?((s.count/stats.totalActivities)*100).toFixed(0):0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Clients + Top Users Row */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'24px'}}>
          <div className="card">
            <div className="card-header">
              <span>Top Clients (Executed)</span>
              <button onClick={handleExportClientsCSV} className="btn btn-secondary" style={{fontSize:'12px',padding:'5px 10px'}}>CSV</button>
            </div>
            <div style={{padding:'24px'}}>
              {stats.topClients.length===0?(<div style={{textAlign:'center',padding:'30px',color:'var(--text-muted)'}}>No data yet</div>):(
                <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                  {stats.topClients.map((c,i)=>(
                    <div
                      key={i}
                      style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px',background:'var(--section-label-bg)',borderRadius:'8px',cursor:'default'}}
                      onMouseEnter={e=>showTooltip('client', c.name, e.currentTarget.getBoundingClientRect())}
                      onMouseLeave={scheduleHide}
                    >
                      <div style={{fontSize:'18px',fontWeight:'bold',color:'var(--text-muted)',width:'28px'}}>#{i+1}</div>
                      <div style={{flex:1,fontWeight:600,color:'var(--text-primary)',fontSize:'14px'}}>{c.name}</div>
                      <div style={{fontSize:'16px',fontWeight:'bold',color:'var(--accent)'}}>${c.volume}MM</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span>Most Active Users</span>
              <button onClick={handleExportUsersCSV} className="btn btn-secondary" style={{fontSize:'12px',padding:'5px 10px'}}>CSV</button>
            </div>
            <div style={{padding:'24px'}}>
              {stats.topUsers.length===0?(<div style={{textAlign:'center',padding:'30px',color:'var(--text-muted)'}}>No data yet</div>):(
                <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                  {stats.topUsers.map((u,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px',background:'var(--section-label-bg)',borderRadius:'8px'}}>
                      <div style={{fontSize:'18px',fontWeight:'bold',color:'var(--text-muted)',width:'28px'}}>#{i+1}</div>
                      <div style={{flex:1,fontWeight:600,color:'var(--text-primary)',fontSize:'14px'}}>{u.name}</div>
                      <div style={{fontSize:'16px',fontWeight:'bold',color:'var(--accent)'}}>{u.count} <span style={{fontSize:'11px',fontWeight:'normal',color:'var(--text-muted)'}}>activities</span></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Activity Type + Region Row */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'24px'}}>
          <div className="card">
            <div className="card-header">
              <span>Activity Type Breakdown</span>
              <button onClick={handleExportActivityTypeCSV} className="btn btn-secondary" style={{fontSize:'12px',padding:'5px 10px'}}>CSV</button>
            </div>
            <div style={{padding:'24px',display:'flex',flexDirection:'column',gap:'10px'}}>
              {Object.keys(stats.activityTypeBreakdown).length===0?(<div style={{textAlign:'center',padding:'30px',color:'var(--text-muted)'}}>No data yet</div>):(
                Object.entries(stats.activityTypeBreakdown).sort((a,b)=>b[1]-a[1]).map(([type,count],i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'12px'}}>
                    <span style={{fontSize:'12px',fontWeight:600,width:'110px',color:'var(--text-secondary)'}}>{type}</span>
                    <div style={{flex:1,height:'8px',background:'var(--border)',borderRadius:'4px',overflow:'hidden'}}>
                      <div style={{width:`${stats.totalActivities>0?(count/stats.totalActivities)*100:0}%`,height:'100%',background:'var(--accent)',borderRadius:'4px'}}></div>
                    </div>
                    <span style={{fontSize:'13px',fontWeight:700,color:'var(--accent)',minWidth:'30px',textAlign:'right'}}>{count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span>Region Breakdown</span>
              <button onClick={handleExportRegionCSV} className="btn btn-secondary" style={{fontSize:'12px',padding:'5px 10px'}}>CSV</button>
            </div>
            <div style={{padding:'24px',display:'flex',flexDirection:'column',gap:'10px'}}>
              {Object.keys(stats.regionBreakdown).length===0?(<div style={{textAlign:'center',padding:'30px',color:'var(--text-muted)'}}>No data yet</div>):(
                Object.entries(stats.regionBreakdown).sort((a,b)=>b[1]-a[1]).map(([region,count],i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'12px'}}>
                    <span style={{fontSize:'12px',fontWeight:600,width:'80px',color:'var(--text-secondary)'}}>{region}</span>
                    <div style={{flex:1,height:'8px',background:'var(--border)',borderRadius:'4px',overflow:'hidden'}}>
                      <div style={{width:`${stats.totalActivities>0?(count/stats.totalActivities)*100:0}%`,height:'100%',background:'var(--accent)',borderRadius:'4px'}}></div>
                    </div>
                    <span style={{fontSize:'13px',fontWeight:700,color:'var(--accent)',minWidth:'30px',textAlign:'right'}}>{count}</span>
                    <span className="badge badge-primary">{stats.totalActivities>0?((count/stats.totalActivities)*100).toFixed(0):0}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Currency Breakdown */}
        <div className="card" style={{marginBottom:'24px'}}>
          <div className="card-header">
            <span>Currency Breakdown</span>
            <button onClick={handleExportCurrencyCSV} className="btn btn-secondary" style={{fontSize:'12px',padding:'5px 10px'}}>CSV</button>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Currency</th><th>Count</th><th>Total Volume (MM)</th><th>Executed Volume (MM)</th><th>% of Total</th></tr>
              </thead>
              <tbody>
                {Object.keys(stats.currencyBreakdown).length===0?(<tr><td colSpan="5" style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>No data yet</td></tr>):(
                  Object.entries(stats.currencyBreakdown).sort((a,b)=>b[1].volume-a[1].volume).map(([currency,data])=>{
                    const pct = ((data.volume/parseFloat(stats.totalVolume))*100).toFixed(1);
                    return(
                      <tr
                        key={currency}
                        style={{cursor:'default'}}
                        onMouseEnter={e=>showTooltip('currency', currency, e.currentTarget.getBoundingClientRect())}
                        onMouseLeave={scheduleHide}
                      >
                        <td><span className="badge badge-primary">{currency}</span></td>
                        <td>{data.count}</td>
                        <td style={{fontWeight:600}}>${data.volume.toFixed(2)}MM</td>
                        <td>${filteredActivities.filter(a=>a.currency===currency&&a.status==='EXECUTED').reduce((s,a)=>s+(parseFloat(a.size)||0),0).toFixed(2)}MM</td>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <div style={{flex:1,height:'8px',background:'var(--border)',borderRadius:'4px',overflow:'hidden'}}>
                              <div style={{width:`${pct}%`,height:'100%',background:'var(--accent)',borderRadius:'4px'}}></div>
                            </div>
                            <span style={{fontSize:'13px',fontWeight:600,color:'var(--text-secondary)',minWidth:'40px'}}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Desk View: Performance by Salesperson */}
        {viewMode === 'desk' && (
          <div className="card" style={{marginBottom:'24px'}}>
            <div className="card-header">
              <span>Performance by Salesperson</span>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Salesperson</th>
                    <th>Activities</th>
                    <th>Volume (MM)</th>
                    <th>Executed</th>
                    <th>Hit Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {salespersonRows.length === 0 ? (
                    <tr><td colSpan="5" style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>No data yet</td></tr>
                  ) : (
                    salespersonRows.map((row, i) => {
                      const hitRate = row.count > 0 ? ((row.executed / row.count) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={i}>
                          <td style={{fontWeight:600}}>{row.name}</td>
                          <td>{row.count}</td>
                          <td style={{fontWeight:600,color:'var(--accent)'}}>${row.volume.toFixed(2)}MM</td>
                          <td>{row.executed}</td>
                          <td>
                            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                              <div style={{width:'60px',height:'6px',background:'var(--border)',borderRadius:'3px',overflow:'hidden'}}>
                                <div style={{width:`${hitRate}%`,height:'100%',background:'var(--accent)',borderRadius:'3px'}}/>
                              </div>
                              <span style={{fontSize:'12px',fontWeight:600,color:'var(--text-secondary)'}}>{hitRate}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* Hover Card Overlay */}
      {tooltipState.visible && tooltipState.rect && (
        <div
          style={{
            ...getTooltipStyle(tooltipState.rect),
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            pointerEvents: 'auto',
            maxHeight: '380px',
            overflowY: 'auto',
          }}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          {renderTooltipContent()}
        </div>
      )}

      <style jsx>{`
        .app-container{min-height:100vh;background:var(--bg-base);color:var(--text-primary);}
        .main-content{max-width:1400px;margin:0 auto;padding:32px 24px;}
        .page-header{margin-bottom:32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:24px;}
        .page-title{font-size:32px;font-weight:700;color:var(--text-primary);margin-bottom:8px;}
        .page-description{font-size:16px;color:var(--text-secondary);}
        .stat-card{background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:20px;text-align:center;box-shadow:var(--shadow);position:relative;}
        .stat-value{font-size:24px;font-weight:700;color:var(--accent);margin-bottom:6px;}
        .stat-label{font-size:12px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;}
        .card{background:var(--card-bg);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);}
        .card-header{font-size:17px;font-weight:700;color:var(--text-primary);padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
        .breakdown-box{text-align:center;padding:16px;border-radius:8px;}
        .btn{padding:10px 18px;border-radius:8px;font-weight:600;font-size:13.5px;transition:all 0.2s ease;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:7px;font-family:inherit;white-space:nowrap;}
        .btn-secondary{background:var(--btn-secondary-bg);color:#fff;padding:8px 14px;font-size:13px;}
        .btn-secondary:hover{background:var(--btn-secondary-hover);}
        .btn-muted{background:var(--btn-muted-bg);color:var(--btn-muted-text);}
        .btn-muted:hover{background:var(--btn-muted-hover);}
        .form-input{width:100%;padding:10px 14px;background:var(--bg-input);border:1.5px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:14px;transition:all 0.2s ease;font-family:inherit;}
        .form-input:focus{outline:none;border-color:var(--border-focus);background:var(--bg-input-focus);box-shadow:0 0 0 3px var(--accent-glow);}
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
        .spinner{display:inline-block;width:10px;height:10px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @media(max-width:768px){.page-header{flex-direction:column;align-items:flex-start;} div[style*="grid-template-columns: 1fr 1fr"]{grid-template-columns:1fr !important;}}
        .hover-card-title{font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:10px;}
        .hover-card-sub{font-size:11px;color:var(--text-muted);margin-bottom:8px;}
        .hover-card-divider{border:none;border-top:1px solid var(--border);margin:8px 0;}
        .hover-card-row{display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:3px 0;gap:8px;}
        .hover-card-label{color:var(--text-secondary);white-space:nowrap;}
        .hover-card-value{font-weight:600;color:var(--text-primary);text-align:right;}
        .hover-card-csv-btn{width:100%;margin-top:10px;padding:7px 12px;background:var(--btn-secondary-bg);color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;}
        .hover-card-csv-btn:hover{background:var(--btn-secondary-hover);}
        .stat-card-hint{position:absolute;top:8px;right:10px;font-size:10px;color:var(--text-muted);opacity:0.5;pointer-events:none;}
      `}</style>
    </div>
  );
}
