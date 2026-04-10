import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AxleLogo } from '@bridgelogic/ui';

const ACTION_LABELS = {
  export_activities_excel: 'Export Activities (Excel)',
  export_activities_pdf: 'Export Activities (PDF)',
  export_clients_excel: 'Export Clients (Excel)',
  export_clients_pdf: 'Export Clients (PDF)',
  export_pipeline_issues_excel: 'Export Pipeline Issues (Excel)',
  export_pipeline_issues_pdf: 'Export Pipeline Issues (PDF)',
  export_orderbook_excel: 'Export Order Book (Excel)',
  export_orderbook_pdf: 'Export Order Book (PDF)',
  export_analytics_excel: 'Export Analytics (Excel)',
  export_analytics_pdf: 'Export Analytics (PDF)',
  export_analytics_csv: 'Export Analytics (CSV)',
};

const STYLES = `
  .ha-root {
    font-family: 'Outfit', -apple-system, sans-serif;
    min-height: 100vh; background: #0f172a;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  .ha-card {
    background: #1e293b; border: 1px solid #334155;
    border-radius: 20px; padding: 40px; width: 100%; max-width: 420px;
    box-shadow: 0 40px 80px rgba(0,0,0,0.5);
  }
  .ha-card-wide {
    background: #1e293b; border: 1px solid #334155;
    border-radius: 20px; padding: 40px; width: 100%; max-width: 900px;
    box-shadow: 0 40px 80px rgba(0,0,0,0.5);
  }
  .ha-title {
    font-size: 22px; font-weight: 700; color: #f8fafc;
    margin: 0 0 6px; text-align: center;
  }
  .ha-subtitle {
    font-size: 13px; color: #64748b; text-align: center; margin: 0 0 28px;
  }
  .ha-label {
    display: block; font-size: 13px; font-weight: 600;
    color: #94a3b8; margin-bottom: 7px;
  }
  .ha-input {
    width: 100%; padding: 11px 14px;
    background: #0f172a; border: 1px solid #334155;
    border-radius: 10px; color: #f8fafc;
    font-size: 15px; font-family: inherit; outline: none;
    transition: border-color 0.2s; margin-bottom: 16px;
  }
  .ha-input:focus { border-color: #C8A258; }
  .ha-input::placeholder { color: #475569; }
  .ha-btn {
    width: 100%; padding: 13px;
    background: #C8A258; color: #0F2137;
    border: none; border-radius: 10px;
    font-size: 15px; font-weight: 600; font-family: inherit;
    cursor: pointer; transition: background 0.2s, transform 0.2s;
  }
  .ha-btn:hover:not(:disabled) { background: #D4B06A; transform: translateY(-1px); }
  .ha-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .ha-msg {
    border-radius: 8px; padding: 11px 14px; margin-bottom: 16px; font-size: 13px;
  }
  .ha-msg-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #fca5a5; }
  .ha-msg-success { background: rgba(200,162,88,0.1); border: 1px solid rgba(200,162,88,0.25); color: #C8A258; }
  .ha-tabs {
    display: flex; gap: 8px; margin-bottom: 24px; justify-content: center;
  }
  .ha-tab {
    background: none; border: 1px solid #334155; border-radius: 8px;
    color: #64748b; font-family: inherit; font-size: 13px; font-weight: 600;
    padding: 8px 16px; cursor: pointer; transition: all 0.2s;
  }
  .ha-tab:hover { color: #f8fafc; border-color: #475569; }
  .ha-tab.active { background: rgba(200,162,88,0.15); border-color: #C8A258; color: #C8A258; }
`;

export default function HostAdmin() {
  const { currentUser } = useAuth();
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('reset');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Audit state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLoaded, setAuditLoaded] = useState(false);

  // SSO provisioning state
  const [ssoOrgId, setSsoOrgId] = useState('');
  const [ssoProviderId, setSsoProviderId] = useState('');
  const [ssoDomains, setSsoDomains] = useState('');
  const [ssoSaving, setSsoSaving] = useState(false);
  const [ssoMessage, setSsoMessage] = useState(null);
  const [ssoLookupLoading, setSsoLookupLoading] = useState(false);
  const [ssoCurrentConfig, setSsoCurrentConfig] = useState(null);

  // Helper to get Authorization headers for host admin requests
  async function getAuthHeaders() {
    if (!currentUser) throw new Error('Not authenticated');
    const idToken = await currentUser.getIdToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    };
  }

  // Verify current user is a host admin on mount
  useEffect(() => {
    async function checkHostAdmin() {
      if (!currentUser) {
        setAuthError('Please sign in to access host admin tools.');
        setAuthChecking(false);
        return;
      }
      try {
        const hostAdminDoc = await getDoc(doc(db, 'hostAdmins', currentUser.uid));
        if (hostAdminDoc.exists()) {
          setAuthenticated(true);
        } else {
          setAuthError('Your account does not have host admin access.');
        }
      } catch (err) {
        setAuthError('Failed to verify host admin status.');
      }
      setAuthChecking(false);
    }
    checkHostAdmin();
  }, [currentUser]);

  const handleReset = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setMessage({ type: 'error', text: 'Please enter an email.' }); return; }
    setLoading(true);
    setMessage(null);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/.netlify/functions/host-reset-password', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email: email.trim() }),
      });
      let data;
      try { data = await res.json(); } catch { data = { error: `HTTP ${res.status}: ${res.statusText}` }; }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessage({ type: 'success', text: data.message });
      setEmail('');
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    if (auditLoaded) return;
    setAuditLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/.netlify/functions/fetch-audit-logs', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ limit: 200 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setAuditLogs(data.logs || []);
      setAuditLoaded(true);
    } catch (err) {
      // non-blocking — keep UI functional
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated && activeTab === 'audit' && !auditLoaded) {
      loadAuditLogs();
    }
  }, [authenticated, activeTab]);

  const fmtDate = (ts) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString();
  };

  const handleSsoLookup = async () => {
    if (!ssoOrgId.trim()) { setSsoMessage({ type: 'error', text: 'Enter an organization ID.' }); return; }
    setSsoLookupLoading(true);
    setSsoMessage(null);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/.netlify/functions/host-sso-config', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action: 'get', orgId: ssoOrgId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSsoCurrentConfig(data.config || null);
      if (data.config) {
        setSsoProviderId(data.config.samlProviderId || '');
        setSsoDomains((data.config.allowedDomains || []).join(', '));
      } else {
        setSsoProviderId('');
        setSsoDomains('');
      }
    } catch (err) {
      setSsoMessage({ type: 'error', text: err.message });
    } finally {
      setSsoLookupLoading(false);
    }
  };

  const handleSsoSave = async () => {
    if (!ssoOrgId.trim() || !ssoProviderId.trim()) {
      setSsoMessage({ type: 'error', text: 'Organization ID and SAML Provider ID are required.' });
      return;
    }
    setSsoSaving(true);
    setSsoMessage(null);
    try {
      const domains = ssoDomains.split(',').map(d => d.trim()).filter(Boolean);
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/.netlify/functions/host-sso-config', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          action: 'set',
          orgId: ssoOrgId.trim(),
          samlProviderId: ssoProviderId.trim(),
          allowedDomains: domains,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSsoMessage({ type: 'success', text: 'SSO configuration saved successfully.' });
      setSsoCurrentConfig({ ssoEnabled: true, samlProviderId: ssoProviderId.trim(), allowedDomains: domains });
    } catch (err) {
      setSsoMessage({ type: 'error', text: err.message });
    } finally {
      setSsoSaving(false);
    }
  };

  const handleSsoDisable = async () => {
    if (!ssoOrgId.trim()) return;
    setSsoSaving(true);
    setSsoMessage(null);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/.netlify/functions/host-sso-config', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action: 'disable', orgId: ssoOrgId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSsoMessage({ type: 'success', text: 'SSO disabled for this organization.' });
      setSsoCurrentConfig(null);
      setSsoProviderId('');
      setSsoDomains('');
    } catch (err) {
      setSsoMessage({ type: 'error', text: err.message });
    } finally {
      setSsoSaving(false);
    }
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="ha-root" style={{ alignItems: authenticated ? 'flex-start' : 'center', paddingTop: authenticated ? '60px' : '24px' }}>
        {authChecking ? (
          <div className="ha-card" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <AxleLogo size="md" variant="dark" />
            </div>
            <p style={{ color: '#64748b', fontSize: '14px' }}>Verifying access...</p>
          </div>
        ) : !authenticated ? (
          <div className="ha-card">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <AxleLogo size="md" variant="dark" />
            </div>
            <h1 className="ha-title">Host Admin</h1>
            <p className="ha-subtitle">Access restricted</p>
            <div className="ha-msg ha-msg-error">{authError || 'Access denied.'}</div>
          </div>
        ) : (
          <div className={activeTab === 'audit' ? 'ha-card-wide' : 'ha-card'}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <AxleLogo size="md" variant="dark" />
            </div>
            <h1 className="ha-title">Host Admin</h1>
            <p className="ha-subtitle">Management tools</p>

            <div className="ha-tabs">
              <button className={`ha-tab ${activeTab === 'reset' ? 'active' : ''}`} onClick={() => setActiveTab('reset')}>
                Password Reset
              </button>
              <button className={`ha-tab ${activeTab === 'sso' ? 'active' : ''}`} onClick={() => setActiveTab('sso')}>
                SSO Config
              </button>
              <button className={`ha-tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
                Audit Trail
              </button>
            </div>

            {activeTab === 'reset' && (
              <form onSubmit={handleReset}>
                {message && (
                  <div className={`ha-msg ${message.type === 'success' ? 'ha-msg-success' : 'ha-msg-error'}`}>
                    {message.text}
                  </div>
                )}
                <label className="ha-label">User Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="ha-input" placeholder="user@firm.com" autoFocus
                />
                <button type="submit" disabled={loading} className="ha-btn">
                  {loading ? 'Sending...' : 'Send Password Reset'}
                </button>
              </form>
            )}

            {activeTab === 'sso' && (
              <div>
                {ssoMessage && (
                  <div className={`ha-msg ${ssoMessage.type === 'success' ? 'ha-msg-success' : 'ha-msg-error'}`}>
                    {ssoMessage.text}
                  </div>
                )}

                <label className="ha-label">Organization ID</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input
                    type="text" value={ssoOrgId} onChange={e => setSsoOrgId(e.target.value)}
                    className="ha-input" placeholder="org_example_com" style={{ marginBottom: 0, flex: 1 }}
                  />
                  <button
                    type="button" className="ha-btn" disabled={ssoLookupLoading}
                    style={{ width: 'auto', padding: '11px 20px', fontSize: '13px' }}
                    onClick={handleSsoLookup}
                  >
                    {ssoLookupLoading ? '...' : 'Lookup'}
                  </button>
                </div>

                {ssoCurrentConfig && (
                  <div className="ha-msg ha-msg-success" style={{ marginBottom: '16px' }}>
                    SSO is currently <strong>enabled</strong> — Provider: {ssoCurrentConfig.samlProviderId}
                  </div>
                )}

                <label className="ha-label">SAML Provider ID</label>
                <input
                  type="text" value={ssoProviderId} onChange={e => setSsoProviderId(e.target.value)}
                  className="ha-input" placeholder="saml.okta-clientname"
                />

                <label className="ha-label">Allowed Domains (comma-separated)</label>
                <input
                  type="text" value={ssoDomains} onChange={e => setSsoDomains(e.target.value)}
                  className="ha-input" placeholder="firm.com, subsidiary.com"
                />

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button" className="ha-btn" disabled={ssoSaving}
                    style={{ flex: 1 }} onClick={handleSsoSave}
                  >
                    {ssoSaving ? 'Saving...' : 'Enable / Update SSO'}
                  </button>
                  {ssoCurrentConfig && (
                    <button
                      type="button" disabled={ssoSaving}
                      style={{
                        padding: '13px 20px', background: 'transparent',
                        border: '1px solid rgba(239,68,68,0.4)', borderRadius: '10px',
                        color: '#fca5a5', fontSize: '13px', fontWeight: 600,
                        fontFamily: 'inherit', cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onClick={handleSsoDisable}
                    >
                      Disable
                    </button>
                  )}
                </div>

                <p style={{ color: '#475569', fontSize: '11px', marginTop: '16px', lineHeight: 1.5 }}>
                  The SAML provider must be configured in Firebase Console &rarr; Authentication &rarr; Sign-in method &rarr; SAML.
                  The Provider ID here must match the one created in Firebase.
                </p>
              </div>
            )}

            {activeTab === 'audit' && (
              <div>
                {auditLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading audit logs...</div>
                ) : auditLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No audit logs found.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #334155', textAlign: 'left' }}>
                          <th style={{ padding: '10px 12px', color: '#94a3b8', fontWeight: 600 }}>Timestamp</th>
                          <th style={{ padding: '10px 12px', color: '#94a3b8', fontWeight: 600 }}>Org</th>
                          <th style={{ padding: '10px 12px', color: '#94a3b8', fontWeight: 600 }}>User</th>
                          <th style={{ padding: '10px 12px', color: '#94a3b8', fontWeight: 600 }}>Action</th>
                          <th style={{ padding: '10px 12px', color: '#94a3b8', fontWeight: 600 }}>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map(log => (
                          <tr key={log.id} style={{ borderBottom: '1px solid #1e293b' }}>
                            <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(log.timestamp)}</td>
                            <td style={{ padding: '10px 12px', color: '#cbd5e1', fontSize: '12px' }}>{log.organizationName || log.organizationId || '-'}</td>
                            <td style={{ padding: '10px 12px', color: '#f8fafc' }}>
                              <div style={{ fontWeight: 500 }}>{log.userName || '-'}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>{log.userEmail || ''}</div>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#f8fafc' }}>{ACTION_LABELS[log.action] || log.action}</td>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
