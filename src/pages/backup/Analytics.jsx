import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function Analytics() {
  const { userData } = useAuth();
  
  const [activities, setActivities] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalActivities: 0,
    totalVolume: 0,
    totalClients: 0,
    buyCount: 0,
    sellCount: 0,
    twoWayCount: 0,
    enquiryCount: 0,
    quotedCount: 0,
    executedCount: 0,
    topClients: [],
    topUsers: [],
    currencyBreakdown: {}
  });

  useEffect(() => {
    if (!userData?.organizationId) {
      setLoading(false);
      return;
    }

    const unsubscribes = [];

    try {
      const activitiesRef = collection(db, `organizations/${userData.organizationId}/activities`);
      const activitiesQuery = query(activitiesRef, orderBy('createdAt', 'desc'));
      
      const activitiesUnsub = onSnapshot(activitiesQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }));
        setActivities(data);
        calculateStats(data);
        setLoading(false);
      });
      unsubscribes.push(activitiesUnsub);

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

  function calculateStats(data) {
    const totalActivities = data.length;
    const totalVolume = data.reduce((sum, a) => sum + (parseFloat(a.size) || 0), 0);
    
    const buyCount = data.filter(a => a.direction === 'BUY').length;
    const sellCount = data.filter(a => a.direction === 'SELL').length;
    const twoWayCount = data.filter(a => a.direction === 'TWO-WAY').length;
    
    const enquiryCount = data.filter(a => a.status === 'ENQUIRY').length;
    const quotedCount = data.filter(a => a.status === 'QUOTED').length;
    const executedCount = data.filter(a => a.status === 'EXECUTED').length;

    // Top clients by volume
    const clientVolumes = {};
    data.forEach(a => {
      if (!clientVolumes[a.clientName]) {
        clientVolumes[a.clientName] = 0;
      }
      clientVolumes[a.clientName] += parseFloat(a.size) || 0;
    });
    const topClients = Object.entries(clientVolumes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, volume]) => ({ name, volume: volume.toFixed(2) }));

    // Top users by activity count
    const userCounts = {};
    data.forEach(a => {
      if (!userCounts[a.createdBy]) {
        userCounts[a.createdBy] = 0;
      }
      userCounts[a.createdBy]++;
    });
    const topUsers = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Currency breakdown
    const currencyBreakdown = {};
    data.forEach(a => {
      if (!currencyBreakdown[a.currency]) {
        currencyBreakdown[a.currency] = { count: 0, volume: 0 };
      }
      currencyBreakdown[a.currency].count++;
      currencyBreakdown[a.currency].volume += parseFloat(a.size) || 0;
    });

    setStats({
      totalActivities,
      totalVolume: totalVolume.toFixed(2),
      totalClients: new Set(data.map(a => a.clientName)).size,
      buyCount,
      sellCount,
      twoWayCount,
      enquiryCount,
      quotedCount,
      executedCount,
      topClients,
      topUsers,
      currencyBreakdown
    });
  }

  if (loading) {
    return (
      <div className="app-container">
        <Navigation />
        <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh'}}>
          <div style={{textAlign: 'center'}}>
            <div className="spinner" style={{width: '40px', height: '40px', margin: '0 auto 16px'}}></div>
            <div style={{color: 'var(--text-primary)'}}>Loading analytics...</div>
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
            <h1 className="page-title">📊 Analytics</h1>
            <p className="page-description">Business intelligence and performance metrics</p>
          </div>
        </div>

        {/* Overview Stats */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px'}}>
          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-value">{stats.totalActivities}</div>
            <div className="stat-label">Total Activities</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-value">${stats.totalVolume}MM</div>
            <div className="stat-label">Total Volume</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{stats.totalClients}</div>
            <div className="stat-label">Active Clients</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value">{stats.executedCount}</div>
            <div className="stat-label">Executed Trades</div>
          </div>
        </div>

        {/* Direction Breakdown */}
        <div className="card" style={{marginBottom: '24px'}}>
          <div className="card-header">
            <span>📈 Direction Breakdown</span>
          </div>
          <div style={{padding: '24px'}}>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px'}}>
              <div style={{textAlign: 'center', padding: '20px', background: 'var(--badge-success-bg)', borderRadius: '8px'}}>
                <div style={{fontSize: '32px', fontWeight: 'bold', color: 'var(--badge-success-text)'}}>{stats.buyCount}</div>
                <div style={{fontSize: '13px', color: 'var(--badge-success-text)', marginTop: '4px'}}>BUY Orders</div>
              </div>
              <div style={{textAlign: 'center', padding: '20px', background: 'var(--badge-danger-bg)', borderRadius: '8px'}}>
                <div style={{fontSize: '32px', fontWeight: 'bold', color: 'var(--badge-danger-text)'}}>{stats.sellCount}</div>
                <div style={{fontSize: '13px', color: 'var(--badge-danger-text)', marginTop: '4px'}}>SELL Orders</div>
              </div>
              <div style={{textAlign: 'center', padding: '20px', background: 'var(--badge-warning-bg)', borderRadius: '8px'}}>
                <div style={{fontSize: '32px', fontWeight: 'bold', color: 'var(--badge-warning-text)'}}>{stats.twoWayCount}</div>
                <div style={{fontSize: '13px', color: 'var(--badge-warning-text)', marginTop: '4px'}}>TWO-WAY Orders</div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="card" style={{marginBottom: '24px'}}>
          <div className="card-header">
            <span>🎯 Status Breakdown</span>
          </div>
          <div style={{padding: '24px'}}>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px'}}>
              <div style={{textAlign: 'center', padding: '20px', background: 'var(--section-label-bg)', borderRadius: '8px', border: '1px solid var(--border)'}}>
                <div style={{fontSize: '32px', fontWeight: 'bold', color: 'var(--accent)'}}>{stats.enquiryCount}</div>
                <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px'}}>Enquiries</div>
              </div>
              <div style={{textAlign: 'center', padding: '20px', background: 'var(--section-label-bg)', borderRadius: '8px', border: '1px solid var(--border)'}}>
                <div style={{fontSize: '32px', fontWeight: 'bold', color: 'var(--accent)'}}>{stats.quotedCount}</div>
                <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px'}}>Quoted</div>
              </div>
              <div style={{textAlign: 'center', padding: '20px', background: 'var(--section-label-bg)', borderRadius: '8px', border: '1px solid var(--border)'}}>
                <div style={{fontSize: '32px', fontWeight: 'bold', color: '#22c55e'}}>{stats.executedCount}</div>
                <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px'}}>Executed</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px'}}>
          {/* Top Clients */}
          <div className="card">
            <div className="card-header">
              <span>🏆 Top Clients by Volume</span>
            </div>
            <div style={{padding: '24px'}}>
              {stats.topClients.length === 0 ? (
                <div style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
                  No data yet
                </div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  {stats.topClients.map((client, index) => (
                    <div key={index} style={{display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--section-label-bg)', borderRadius: '8px'}}>
                      <div style={{fontSize: '20px', fontWeight: 'bold', color: 'var(--text-muted)', width: '30px'}}>#{index + 1}</div>
                      <div style={{flex: 1}}>
                        <div style={{fontWeight: 600, color: 'var(--text-primary)'}}>{client.name}</div>
                      </div>
                      <div style={{fontSize: '18px', fontWeight: 'bold', color: 'var(--accent)'}}>${client.volume}MM</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top Users */}
          <div className="card">
            <div className="card-header">
              <span>👤 Most Active Users</span>
            </div>
            <div style={{padding: '24px'}}>
              {stats.topUsers.length === 0 ? (
                <div style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
                  No data yet
                </div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  {stats.topUsers.map((user, index) => (
                    <div key={index} style={{display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--section-label-bg)', borderRadius: '8px'}}>
                      <div style={{fontSize: '20px', fontWeight: 'bold', color: 'var(--text-muted)', width: '30px'}}>#{index + 1}</div>
                      <div style={{flex: 1}}>
                        <div style={{fontWeight: 600, color: 'var(--text-primary)'}}>{user.name}</div>
                      </div>
                      <div style={{fontSize: '18px', fontWeight: 'bold', color: 'var(--accent)'}}>{user.count} activities</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Currency Breakdown */}
        <div className="card" style={{marginTop: '24px'}}>
          <div className="card-header">
            <span>💱 Currency Breakdown</span>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>Count</th>
                  <th>Total Volume</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(stats.currencyBreakdown).length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
                      No data yet
                    </td>
                  </tr>
                ) : (
                  Object.entries(stats.currencyBreakdown)
                    .sort((a, b) => b[1].volume - a[1].volume)
                    .map(([currency, data]) => {
                      const percentage = ((data.volume / parseFloat(stats.totalVolume)) * 100).toFixed(1);
                      return (
                        <tr key={currency}>
                          <td><span className="badge badge-primary">{currency}</span></td>
                          <td>{data.count}</td>
                          <td style={{fontWeight: 600}}>${data.volume.toFixed(2)}MM</td>
                          <td>
                            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                              <div style={{flex: 1, height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden'}}>
                                <div style={{width: `${percentage}%`, height: '100%', background: 'var(--accent)', borderRadius: '4px'}}></div>
                              </div>
                              <span style={{fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '45px'}}>{percentage}%</span>
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

        .stat-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          box-shadow: var(--shadow);
        }

        .stat-icon {
          font-size: 32px;
          margin-bottom: 12px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: var(--accent);
          margin-bottom: 8px;
        }

        .stat-label {
          font-size: 13px;
          color: var(--text-secondary);
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
          .stat-card {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}
