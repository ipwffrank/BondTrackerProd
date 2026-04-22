import { useState, useEffect, useMemo } from 'react';
import Navigation from '../components/Navigation';
import { useAuth } from '../contexts/AuthContext';
import { collection, onSnapshot, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

const RANGES = [
  { key: 'week',     label: 'This Week' },
  { key: 'month',    label: 'This Month' },
  { key: 'quarter',  label: 'Last 3 Months' },
  { key: 'ytd',      label: 'Year to Date' },
];

function getRangeStart(range) {
  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (range === 'week') {
    // ISO-ish: Monday of current week
    const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diffToMonday);
    return d;
  }
  if (range === 'month') {
    d.setDate(1);
    return d;
  }
  if (range === 'quarter') {
    d.setMonth(d.getMonth() - 3);
    return d;
  }
  // ytd
  return new Date(now.getFullYear(), 0, 1);
}

function fmtMM(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(2)}B`;
  return `${v.toFixed(2)}MM`;
}
function fmtInt(n) {
  return (Number(n) || 0).toLocaleString();
}
function fmtPct(n) {
  if (!isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

// Activities are counted as EXECUTED strictly. Everything else (ENQUIRY,
// QUOTED, PASSED, TRADED AWAY) counts as an inquiry for the conversion-rate
// denominator. This mirrors how the sales desk talks about it.
function computeMetrics(activities) {
  const executed = activities.filter(a => (a.status || '').toUpperCase() === 'EXECUTED');
  const inquiries = activities.filter(a => (a.status || '').toUpperCase() !== 'EXECUTED');

  const execVolume = executed.reduce((s, a) => s + (parseFloat(a.size) || 0), 0);
  const inqVolume  = inquiries.reduce((s, a) => s + (parseFloat(a.size) || 0), 0);

  const activeClients = new Set(activities.map(a => (a.clientName || '').trim()).filter(Boolean)).size;
  const totalDenom = executed.length + inquiries.length;
  const conversion = totalDenom > 0 ? (executed.length / totalDenom) * 100 : 0;
  const avgTicket = executed.length > 0 ? execVolume / executed.length : 0;

  // Direction: counts + executed-volume per BUY/SELL/TWO-WAY
  const dirs = { BUY: { count: 0, vol: 0 }, SELL: { count: 0, vol: 0 }, 'TWO-WAY': { count: 0, vol: 0 } };
  for (const a of activities) {
    const d = (a.direction || '').toUpperCase();
    if (!dirs[d]) continue;
    dirs[d].count++;
    if ((a.status || '').toUpperCase() === 'EXECUTED') dirs[d].vol += parseFloat(a.size) || 0;
  }

  // Most Active Bonds: group by ticker (fallback to isin/bondName), show
  // trade count and the distinct client names that traded it.
  const bondMap = new Map();
  for (const a of activities) {
    const key = (a.ticker || a.isin || a.bondName || '').trim();
    if (!key) continue;
    if (!bondMap.has(key)) bondMap.set(key, { key, count: 0, executedVol: 0, clients: new Set() });
    const entry = bondMap.get(key);
    entry.count++;
    if ((a.status || '').toUpperCase() === 'EXECUTED') entry.executedVol += parseFloat(a.size) || 0;
    if (a.clientName) entry.clients.add(a.clientName);
  }
  const topBonds = [...bondMap.values()]
    .map(b => ({ ...b, clients: [...b.clients] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Top Clients: rank by EXECUTED volume (the user's definition).
  const clientMap = new Map();
  for (const a of executed) {
    const key = (a.clientName || '').trim();
    if (!key) continue;
    if (!clientMap.has(key)) clientMap.set(key, { name: key, count: 0, volume: 0 });
    const entry = clientMap.get(key);
    entry.count++;
    entry.volume += parseFloat(a.size) || 0;
  }
  const topClients = [...clientMap.values()].sort((a, b) => b.volume - a.volume).slice(0, 8);

  return {
    totalExecVolume: execVolume,
    executedCount: executed.length,
    inquiryCount: inquiries.length,
    inquiryVolume: inqVolume,
    activeClients,
    conversion,
    avgTicket,
    dirs,
    topBonds,
    topClients,
  };
}

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function DirectionPanel({ dirs }) {
  const maxCount = Math.max(dirs.BUY.count, dirs.SELL.count, dirs['TWO-WAY'].count, 1);
  const row = (key, color) => {
    const d = dirs[key];
    const pct = (d.count / maxCount) * 100;
    return (
      <div className="dir-row" key={key}>
        <div className="dir-label">{key}</div>
        <div className="dir-bar-wrap">
          <div className="dir-bar" style={{ width: `${pct}%`, background: color }} />
        </div>
        <div className="dir-count">{fmtInt(d.count)}</div>
        <div className="dir-vol">{fmtMM(d.vol)} exec</div>
      </div>
    );
  };
  return (
    <div className="panel">
      <div className="panel-title">Direction Breakdown</div>
      <div className="dir-table">
        {row('BUY', '#10b981')}
        {row('SELL', '#ef4444')}
        {row('TWO-WAY', '#C8A258')}
      </div>
    </div>
  );
}

function BondsPanel({ bonds }) {
  return (
    <div className="panel">
      <div className="panel-title">Most Active Bonds</div>
      {bonds.length === 0 ? (
        <div className="empty">No activity in this period.</div>
      ) : (
        <table className="mini-table">
          <thead>
            <tr><th>Bond</th><th style={{textAlign:'right'}}>Trades</th><th>Clients</th></tr>
          </thead>
          <tbody>
            {bonds.map(b => (
              <tr key={b.key}>
                <td className="mono">{b.key}</td>
                <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{fmtInt(b.count)}</td>
                <td className="clients-cell" title={b.clients.join(', ')}>
                  {b.clients.slice(0, 3).join(', ')}{b.clients.length > 3 ? ` +${b.clients.length - 3}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TopClientsPanel({ clients }) {
  return (
    <div className="panel">
      <div className="panel-title">Top Clients (Executed)</div>
      {clients.length === 0 ? (
        <div className="empty">No executed trades in this period.</div>
      ) : (
        <table className="mini-table">
          <thead>
            <tr><th>Client</th><th style={{textAlign:'right'}}>Volume</th><th style={{textAlign:'right'}}>Trades</th></tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.name}>
                <td>{c.name}</td>
                <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{fmtMM(c.volume)}</td>
                <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{fmtInt(c.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { userData, isAdmin } = useAuth();
  const [range, setRange] = useState('month');
  const [activities, setActivities] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.organizationId) { setLoading(false); return; }

    const unsubClients = onSnapshot(
      collection(db, `organizations/${userData.organizationId}/clients`),
      snap => setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const start = getRangeStart(range);
    const actsQ = query(
      collection(db, `organizations/${userData.organizationId}/activities`),
      where('createdAt', '>=', Timestamp.fromDate(start)),
      orderBy('createdAt', 'desc'),
    );
    const unsubActs = onSnapshot(actsQ, snap => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));

    return () => { unsubClients(); unsubActs(); };
  }, [userData?.organizationId, range]);

  // Scope: admins see everything; non-admin sales see only activities for
  // clients where they are the named coverage in the Clients Mapping. Writes
  // are not scoped — a salesperson can still enter activities on anyone.
  // Sales coverage for this user — primary OR backup. When a primary is out
  // the backup takes over, so the dashboard should already reflect that
  // permission.
  const scopedActivities = useMemo(() => {
    if (isAdmin) return activities;
    const myName = (userData?.name || '').trim().toLowerCase();
    if (!myName) return [];
    const mine = new Set(
      clients
        .filter(c => {
          const p = (c.salesCoverage || '').trim().toLowerCase();
          const s = (c.salesCoverageSecondary || '').trim().toLowerCase();
          return p === myName || s === myName;
        })
        .map(c => (c.name || '').trim().toLowerCase())
    );
    if (mine.size === 0) return [];
    return activities.filter(a => mine.has((a.clientName || '').trim().toLowerCase()));
  }, [activities, clients, isAdmin, userData?.name]);

  const m = useMemo(() => computeMetrics(scopedActivities), [scopedActivities]);
  const rangeLabel = RANGES.find(r => r.key === range)?.label || '';
  const myCoveredCount = useMemo(() => {
    if (isAdmin) return null;
    const myName = (userData?.name || '').trim().toLowerCase();
    return clients.filter(c => {
      const p = (c.salesCoverage || '').trim().toLowerCase();
      const s = (c.salesCoverageSecondary || '').trim().toLowerCase();
      return p === myName || s === myName;
    }).length;
  }, [clients, isAdmin, userData?.name]);

  return (
    <div className="app-container">
      <Navigation />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-description">
              {isAdmin
                ? 'Org-wide desk activity.'
                : myCoveredCount === 0
                  ? 'No clients assigned to your coverage yet. Ask an admin to set Sales Coverage on clients in Clients Mapping.'
                  : `Scoped to your ${myCoveredCount} covered client${myCoveredCount === 1 ? '' : 's'}.`}
            </p>
          </div>
          <div className="range-selector" role="tablist" aria-label="Time range">
            {RANGES.map(r => (
              <button
                key={r.key}
                role="tab"
                aria-selected={range === r.key}
                className={`range-btn ${range === r.key ? 'active' : ''}`}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading dashboard…</div>
        ) : (
          <>
            <div className="stat-row">
              <StatCard label="Total Trades Volume" value={fmtMM(m.totalExecVolume)} sub={`${fmtInt(m.executedCount)} executed · ${rangeLabel}`} />
              <StatCard label="Enquiries" value={fmtInt(m.inquiryCount)} sub={`${fmtMM(m.inquiryVolume)} notional`} />
              <StatCard label="Active Clients" value={fmtInt(m.activeClients)} sub={rangeLabel} />
              <StatCard label="Conversion Rate" value={fmtPct(m.conversion)} sub="executed / all activities" />
              <StatCard label="Average Ticket Size" value={fmtMM(m.avgTicket)} sub="per executed trade" />
            </div>

            <div className="panels-grid">
              <DirectionPanel dirs={m.dirs} />
              <BondsPanel bonds={m.topBonds} />
              <TopClientsPanel clients={m.topClients} />
            </div>
          </>
        )}
      </main>

      <style jsx>{`
        .app-container { min-height: 100vh; background: var(--bg-base); color: var(--text-primary); }
        .main-content { max-width: 1400px; margin: 0 auto; padding: 32px 24px; }

        .page-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 24px; flex-wrap: wrap; }
        .page-title { font-size: 32px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
        .page-description { font-size: 14px; color: var(--text-secondary); margin: 0; }

        .range-selector { display: inline-flex; background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 4px; gap: 2px; }
        .range-btn { background: none; border: none; padding: 8px 14px; font-size: 13px; font-weight: 600; color: var(--text-secondary); border-radius: 7px; cursor: pointer; font-family: inherit; transition: background 0.15s, color 0.15s; }
        .range-btn:hover { color: var(--text-primary); }
        .range-btn.active { background: rgba(200,162,88,0.15); color: #C8A258; }

        .loading { padding: 60px; text-align: center; color: var(--text-muted); }

        .stat-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; margin-bottom: 20px; }
        .stat-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; min-width: 0; }
        .stat-label { font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
        .stat-value { font-size: 24px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; line-height: 1.2; }
        .stat-sub { font-size: 11px; color: var(--text-muted); margin-top: 6px; }

        .panels-grid { display: grid; grid-template-columns: 1fr 1.3fr 1fr; gap: 14px; }
        .panel { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .panel-title { font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; padding: 14px 18px; border-bottom: 1px solid var(--border); }
        .empty { padding: 28px; text-align: center; color: var(--text-muted); font-size: 13px; }

        .dir-table { padding: 14px 18px; display: flex; flex-direction: column; gap: 12px; }
        .dir-row { display: grid; grid-template-columns: 70px 1fr 50px 90px; align-items: center; gap: 12px; font-size: 12px; }
        .dir-label { font-weight: 700; color: var(--text-primary); font-size: 12px; letter-spacing: 0.04em; }
        .dir-bar-wrap { height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; }
        .dir-bar { height: 100%; border-radius: 4px; transition: width 0.3s ease; }
        .dir-count { text-align: right; font-variant-numeric: tabular-nums; color: var(--text-primary); font-weight: 600; }
        .dir-vol { text-align: right; font-variant-numeric: tabular-nums; color: var(--text-muted); font-size: 11px; }

        .mini-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .mini-table th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--border); }
        .mini-table td { padding: 10px 14px; border-bottom: 1px solid var(--border); color: var(--text-primary); }
        .mini-table tbody tr:last-child td { border-bottom: none; }
        .mini-table tbody tr:hover { background: rgba(255,255,255,0.02); }
        .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; }
        .clients-cell { color: var(--text-secondary); font-size: 12px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        @media (max-width: 1100px) {
          .stat-row { grid-template-columns: repeat(3, 1fr); }
          .panels-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .stat-row { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
