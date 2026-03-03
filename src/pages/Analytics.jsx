import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';

export default function Analytics() {
  const { userData } = useAuth();
  const [activities, setActivities] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalActivities:0,totalVolume:0,totalClients:0,
    buyCount:0,sellCount:0,twoWayCount:0,
    enquiryCount:0,quotedCount:0,executedCount:0,passedCount:0,tradedAwayCount:0,
    topClients:[],topUsers:[],currencyBreakdown:{},
    activityTypeBreakdown:{},regionBreakdown:{},conversionRate:0,
    executedVolume:0,avgTicketSize:0
  });

  useEffect(() => {
    if(!userData?.organizationId){ setLoading(false); return; }
    const unsubscribes = [];
    try {
      unsubscribes.push(onSnapshot(query(collection(db,`organizations/${userData.organizationId}/activities`),orderBy('createdAt','desc')),(snapshot)=>{
        const data = snapshot.docs.map(d=>({id:d.id,...d.data(),createdAt:d.data().createdAt?.toDate()}));
        setActivities(data);
        calculateStats(data);
        setLoading(false);
      }));
      unsubscribes.push(onSnapshot(collection(db,`organizations/${userData.organizationId}/clients`),(snapshot)=>{
        setClients(snapshot.docs.map(d=>({id:d.id,...d.data()})));
      }));
    } catch(e){ console.error(e); setLoading(false); }
    return ()=>unsubscribes.forEach(u=>u());
  },[userData?.organizationId]);

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
    const avgTicketSize = executedCount>0 ? (executedVolume/executedCount/1000000).toFixed(2) : 0;

    // Top clients by volume
    const clientVolumes = {};
    data.forEach(a=>{ if(!clientVolumes[a.clientName]) clientVolumes[a.clientName]=0; clientVolumes[a.clientName]+=parseFloat(a.size)||0; });
    const topClients = Object.entries(clientVolumes).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,volume])=>({name,volume:(volume/1000000).toFixed(2)}));

    // Top users by count
    const userCounts = {};
    data.forEach(a=>{ if(!userCounts[a.createdBy]) userCounts[a.createdBy]=0; userCounts[a.createdBy]++; });
    const topUsers = Object.entries(userCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,count])=>({name,count}));

    // Currency breakdown
    const currencyBreakdown = {};
    data.forEach(a=>{ if(!currencyBreakdown[a.currency]) currencyBreakdown[a.currency]={count:0,volume:0}; currencyBreakdown[a.currency].count++; currencyBreakdown[a.currency].volume+=parseFloat(a.size)||0; });

    // Activity type breakdown
    const activityTypeBreakdown = {};
    data.forEach(a=>{ if(!activityTypeBreakdown[a.activityType]) activityTypeBreakdown[a.activityType]=0; activityTypeBreakdown[a.activityType]++; });

    // Region breakdown
    const regionBreakdown = {};
    data.forEach(a=>{ const r=a.clientRegion||'Unknown'; if(!regionBreakdown[r]) regionBreakdown[r]=0; regionBreakdown[r]++; });

    setStats({ totalActivities,totalVolume:(totalVolume/1000000).toFixed(2),totalClients:new Set(data.map(a=>a.clientName)).size,buyCount,sellCount,twoWayCount,enquiryCount,quotedCount,executedCount,passedCount,tradedAwayCount,topClients,topUsers,currencyBreakdown,activityTypeBreakdown,regionBreakdown,conversionRate,executedVolume:(executedVolume/1000000).toFixed(2),avgTicketSize });
  }

  // Export Summary PDF
  function handleExportPDF() {
    if(activities.length===0){ alert('No data to export!'); return; }

    // Build flat summary data for export
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

    exportToPDF(summaryData,[
      {header:'Metric',field:'metric'},
      {header:'Value',field:'value'}
    ],'analytics-summary','Analytics Summary Report');
  }

  // Export Full Activity Data to Excel (multi-sheet summary)
  function handleExportExcel() {
    if(activities.length===0){ alert('No data to export!'); return; }

    // Export activities with all fields
    exportToExcel(activities,[
      {header:'Date',field:'createdAt'},
      {header:'Client',field:'clientName'},
      {header:'Client Type',field:'clientType'},
      {header:'Region',field:'clientRegion'},
      {header:'Sales Coverage',field:'salesCoverage'},
      {header:'Activity Type',field:'activityType'},
      {header:'ISIN',field:'isin'},
      {header:'Ticker',field:'ticker'},
      {header:'Size (MM)',field:'size'},
      {header:'Currency',field:'currency'},
      {header:'Price',field:'price'},
      {header:'Direction',field:'direction'},
      {header:'Status',field:'status'},
      {header:'Notes',field:'notes'},
      {header:'Created By',field:'createdBy'}
    ],'analytics-full-export','Analytics');
  }

  if(loading) return(<div className="app-container"><Navigation/><div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'50vh'}}><div style={{textAlign:'center'}}><div className="spinner" style={{width:'40px',height:'40px',margin:'0 auto 16px'}}></div><div style={{color:'var(--text-primary)'}}>Loading analytics...</div></div></div></div>);

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

        {/* Overview Stats Cards */}
        <div style={{overflowX:'auto',marginBottom:'24px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(140px,1fr))',gap:'16px',minWidth:'700px'}}>
          {[
            {value:stats.totalActivities,label:'Total Activities'},
            {value:`$${stats.totalVolume}MM`,label:'Total Volume'},
            {value:stats.totalClients,label:'Active Clients'},
            {value:stats.executedCount,label:'Executed Trades'},
            {value:`$${stats.executedVolume}MM`,label:'Executed Volume'},
            {value:`${stats.conversionRate}%`,label:'Conversion Rate'},
            {value:`$${stats.avgTicketSize}MM`,label:'Avg Ticket Size'},
          ].map((s,i)=>(
            <div key={i} className="stat-card">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
        </div>

        {/* Direction + Status Row */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'24px'}}>
          <div className="card">
            <div className="card-header"><span>Direction Breakdown</span></div>
            <div style={{padding:'24px',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>
              <div className="breakdown-box" style={{background:'var(--badge-success-bg)'}}>
                <div style={{fontSize:'28px',fontWeight:'bold',color:'var(--badge-success-text)'}}>{stats.buyCount}</div>
                <div style={{fontSize:'12px',color:'var(--badge-success-text)',marginTop:'4px'}}>BUY</div>
                <div style={{fontSize:'11px',color:'var(--badge-success-text)',opacity:0.7}}>{stats.totalActivities>0?((stats.buyCount/stats.totalActivities)*100).toFixed(0):0}%</div>
              </div>
              <div className="breakdown-box" style={{background:'var(--badge-danger-bg)'}}>
                <div style={{fontSize:'28px',fontWeight:'bold',color:'var(--badge-danger-text)'}}>{stats.sellCount}</div>
                <div style={{fontSize:'12px',color:'var(--badge-danger-text)',marginTop:'4px'}}>SELL</div>
                <div style={{fontSize:'11px',color:'var(--badge-danger-text)',opacity:0.7}}>{stats.totalActivities>0?((stats.sellCount/stats.totalActivities)*100).toFixed(0):0}%</div>
              </div>
              <div className="breakdown-box" style={{background:'var(--badge-warning-bg)'}}>
                <div style={{fontSize:'28px',fontWeight:'bold',color:'var(--badge-warning-text)'}}>{stats.twoWayCount}</div>
                <div style={{fontSize:'12px',color:'var(--badge-warning-text)',marginTop:'4px'}}>TWO-WAY</div>
                <div style={{fontSize:'11px',color:'var(--badge-warning-text)',opacity:0.7}}>{stats.totalActivities>0?((stats.twoWayCount/stats.totalActivities)*100).toFixed(0):0}%</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span>Status Breakdown</span></div>
            <div style={{padding:'24px',display:'flex',flexDirection:'column',gap:'10px'}}>
              {[
                {label:'Enquiry',count:stats.enquiryCount,color:'var(--badge-primary-text)',bg:'var(--badge-primary-bg)'},
                {label:'Quoted',count:stats.quotedCount,color:'var(--badge-warning-text)',bg:'var(--badge-warning-bg)'},
                {label:'Executed',count:stats.executedCount,color:'var(--badge-success-text)',bg:'var(--badge-success-bg)'},
                {label:'Passed',count:stats.passedCount,color:'var(--badge-danger-text)',bg:'var(--badge-danger-bg)'},
                {label:'Traded Away',count:stats.tradedAwayCount,color:'var(--badge-danger-text)',bg:'var(--badge-danger-bg)'},
              ].map((s,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:'12px'}}>
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
            <div className="card-header"><span>Top Clients by Volume</span></div>
            <div style={{padding:'24px'}}>
              {stats.topClients.length===0?(<div style={{textAlign:'center',padding:'30px',color:'var(--text-muted)'}}>No data yet</div>):(
                <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                  {stats.topClients.map((c,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px',background:'var(--section-label-bg)',borderRadius:'8px'}}>
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
            <div className="card-header"><span>Most Active Users</span></div>
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
            <div className="card-header"><span>Activity Type Breakdown</span></div>
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
            <div className="card-header"><span>Region Breakdown</span></div>
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
          <div className="card-header"><span>Currency Breakdown</span></div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Currency</th><th>Count</th><th>Total Volume (MM)</th><th>Executed Volume (MM)</th><th>% of Total</th></tr>
              </thead>
              <tbody>
                {Object.keys(stats.currencyBreakdown).length===0?(<tr><td colSpan="5" style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>No data yet</td></tr>):(
                  Object.entries(stats.currencyBreakdown).sort((a,b)=>b[1].volume-a[1].volume).map(([currency,data])=>{
                    const pct = ((data.volume/1000000/parseFloat(stats.totalVolume))*100).toFixed(1);
                    return(
                      <tr key={currency}>
                        <td><span className="badge badge-primary">{currency}</span></td>
                        <td>{data.count}</td>
                        <td style={{fontWeight:600}}>${(data.volume/1000000).toFixed(2)}MM</td>
                        <td>${(activities.filter(a=>a.currency===currency&&a.status==='EXECUTED').reduce((s,a)=>s+(parseFloat(a.size)||0),0)/1000000).toFixed(2)}MM</td>
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

      </main>
      <style jsx>{`
        .app-container{min-height:100vh;background:var(--bg-base);color:var(--text-primary);}
        .main-content{max-width:1400px;margin:0 auto;padding:32px 24px;}
        .page-header{margin-bottom:32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:24px;}
        .page-title{font-size:32px;font-weight:700;color:var(--text-primary);margin-bottom:8px;}
        .page-description{font-size:16px;color:var(--text-secondary);}
        .stat-card{background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:20px;text-align:center;box-shadow:var(--shadow);}
        .stat-value{font-size:24px;font-weight:700;color:var(--accent);margin-bottom:6px;}
        .stat-label{font-size:12px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;}
        .card{background:var(--card-bg);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);}
        .card-header{font-size:17px;font-weight:700;color:var(--text-primary);padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
        .breakdown-box{text-align:center;padding:16px;border-radius:8px;}
        .btn{padding:10px 18px;border-radius:8px;font-weight:600;font-size:13.5px;transition:all 0.2s ease;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:7px;font-family:inherit;white-space:nowrap;}
        .btn-secondary{background:var(--btn-secondary-bg);color:#fff;padding:8px 14px;font-size:13px;}
        .btn-secondary:hover{background:var(--btn-secondary-hover);}
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
      `}</style>
    </div>
  );
}
