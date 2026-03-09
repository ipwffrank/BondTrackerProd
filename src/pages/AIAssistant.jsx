import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { collection, query, addDoc, onSnapshot, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { findSimilarClients } from '../utils/clientDedup';

export default function AIAssistant() {
  const { userData, isAdmin } = useAuth();

  const [aiFile, setAiFile] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState([]);
  const [aiError, setAiError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [analysisTimestamp, setAnalysisTimestamp] = useState(null);
  const [analysisFileName, setAnalysisFileName] = useState('');
  const [tokensUsed, setTokensUsed] = useState(null); // { promptTokens, completionTokens, totalTokens }

  // Clients list (for new client detection)
  const [clients, setClients] = useState([]);

  // New client registration forms: { [clientName]: { type, region, salesCoverage } }
  const [newClientForms, setNewClientForms] = useState({});
  // Map AI-extracted client names to existing clients: { [aiName]: existingClientName }
  const [clientMappings, setClientMappings] = useState({});
  // Similar client suggestions: { [aiName]: [{ client, matchType, score }] }
  const [similarSuggestions, setSimilarSuggestions] = useState({});

  // Upload history
  const [uploadHistory, setUploadHistory] = useState([]);

  useEffect(() => {
    if (!userData?.organizationId) return;
    const unsubscribes = [];

    unsubscribes.push(onSnapshot(
      query(collection(db, `organizations/${userData.organizationId}/clients`), orderBy('name', 'asc')),
      (snap) => setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ));

    unsubscribes.push(onSnapshot(
      query(collection(db, `organizations/${userData.organizationId}/transcriptUploads`), orderBy('analyzedAt', 'desc'), limit(50)),
      (snap) => setUploadHistory(snap.docs.map(d => ({ id: d.id, ...d.data(), analyzedAt: d.data().analyzedAt?.toDate() })))
    ));

    return () => unsubscribes.forEach(u => u());
  }, [userData?.organizationId]);

  // Detect new clients whenever aiResults or clients change (with fuzzy matching)
  useEffect(() => {
    if (aiResults.length === 0) { setNewClientForms({}); setSimilarSuggestions({}); return; }
    const existingNames = new Set(clients.map(c => c.name.toLowerCase().trim()));
    const unique = [...new Set(aiResults.map(r => r.clientName).filter(Boolean))];
    const trulyNew = [];
    const suggestions = {};

    for (const name of unique) {
      if (existingNames.has(name.toLowerCase().trim())) continue;
      // Already mapped to an existing client by user
      if (clientMappings[name]) continue;
      const similar = findSimilarClients(name, clients);
      if (similar.length > 0) {
        suggestions[name] = similar;
      }
      trulyNew.push(name);
    }

    setSimilarSuggestions(suggestions);
    setNewClientForms(prev => {
      const next = {};
      trulyNew.filter(name => !clientMappings[name]).forEach(name => {
        next[name] = prev[name] || { type: '', region: '', salesCoverage: '' };
      });
      return next;
    });
  }, [aiResults, clients, clientMappings]);

  const newClientNames = Object.keys(newClientForms);
  const allFormsValid = newClientNames.every(n => newClientForms[n].type && newClientForms[n].region);
  const importBlocked = newClientNames.length > 0 && !allFormsValid;
  const completedFormsCount = newClientNames.filter(
    n => newClientForms[n].type && newClientForms[n].region
  ).length;

  async function handleAiAnalysis() {
    if (!aiFile) return;
    setAiAnalyzing(true);
    setAiError('');
    setAiResults([]);
    setTokensUsed(null);
    setAnalysisFileName(aiFile.name);

    try {
      const text = await aiFile.text();
      const response = await fetch('/.netlify/functions/analyze-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'AI analysis failed');

      const ts = new Date();
      setAiResults(result.activities || []);
      setAnalysisTimestamp(ts);
      setTokensUsed(result.usage || null);

      if (result.activities?.length === 0) {
        setAiError('No activities detected in the transcript');
      }

      // Save upload history record (include raw text for admin download)
      if (userData?.organizationId) {
        await addDoc(collection(db, `organizations/${userData.organizationId}/transcriptUploads`), {
          fileName: aiFile.name,
          analyzedAt: serverTimestamp(),
          analyzedBy: userData.name || userData.email,
          activitiesDetected: result.activities?.length || 0,
          tokensUsed: result.usage?.totalTokens || 0,
          promptTokens: result.usage?.promptTokens || 0,
          completionTokens: result.usage?.completionTokens || 0,
          rawText: text
        });
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      setAiError(error.message);
    } finally {
      setAiAnalyzing(false);
    }
  }

  async function handleImportAiResults() {
    if (!userData?.organizationId || aiResults.length === 0) return;
    setSubmitLoading(true);
    try {
      const activitiesRef = collection(db, `organizations/${userData.organizationId}/activities`);
      const clientsRef = collection(db, `organizations/${userData.organizationId}/clients`);

      // Register new clients first
      const registeredClients = {}; // name → { type, region, salesCoverage }
      for (const [name, form] of Object.entries(newClientForms)) {
        await addDoc(clientsRef, {
          name,
          type: form.type,
          region: form.region,
          salesCoverage: form.salesCoverage || '',
          createdAt: serverTimestamp(),
          createdBy: userData.name || userData.email
        });
        registeredClients[name] = form;
      }

      // Build lookup of existing clients
      const existingClientMap = {};
      clients.forEach(c => { existingClientMap[c.name] = c; });

      // Import activities, enriching with client data (using mappings for dedup)
      for (const activity of aiResults) {
        const rawName = activity.clientName || 'UNKNOWN';
        const clientName = clientMappings[rawName] || rawName;
        const clientData = registeredClients[clientName] || existingClientMap[clientName] || registeredClients[rawName] || {};
        await addDoc(activitiesRef, {
          clientName,
          clientType: clientData.type || '',
          clientRegion: clientData.region || '',
          salesCoverage: clientData.salesCoverage || '',
          activityType: 'Bloomberg Chat',
          isin: activity.isin || '',
          ticker: activity.ticker || '',
          size: activity.size != null ? parseFloat(activity.size) : null,
          currency: activity.currency || 'USD',
          price: parseFloat(activity.price) || null,
          direction: activity.direction || '',
          status: activity.status || 'ENQUIRY',
          notes: activity.notes || 'Imported from AI analysis',
          createdAt: serverTimestamp(),
          createdBy: `${userData.name || userData.email} (AI Import)`
        });
      }

      setAiResults([]);
      setAiFile(null);
      setNewClientForms({});
      setClientMappings({});
      setSimilarSuggestions({});
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import activities');
    } finally {
      setSubmitLoading(false);
    }
  }

  const getDirectionBadge = (d) => ({ 'BUY': 'badge-success', 'SELL': 'badge-danger', 'TWO-WAY': 'badge-warning' }[d] || 'badge-primary');
  const getStatusBadge = (s) => ({ 'EXECUTED': 'badge-success', 'TRADED AWAY': 'badge-danger', 'PASSED': 'badge-danger', 'QUOTED': 'badge-warning', 'ENQUIRY': 'badge-primary' }[s] || 'badge-primary');

  const CLIENT_TYPES = ['Asset Manager', 'Hedge Fund', 'Insurance', 'Pension Fund', 'Bank', 'Sovereign', 'Family Office', 'Other'];
  const REGIONS = ['APAC', 'EMEA', 'Americas', 'Global'];

  return (
    <div className="app-container">
      <Navigation />
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title"> AI Assistant</h1>
          <p className="page-description">Analyze chat transcripts and automatically extract trading activities</p>
        </div>

        <div className="card">
          <div className="card-header">
            <span>Upload Transcript</span>
          </div>
          <div style={{padding: '24px'}}>
            <div style={{marginBottom: '24px'}}>
              <label className="form-label">Select Transcript File (.txt, .csv, .md)</label>
              <input
                type="file"
                accept=".txt,.csv,.md"
                className="form-input"
                onChange={(e) => setAiFile(e.target.files[0])}
              />
              {aiFile && (
                <p style={{fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px'}}>
                  ✓ Selected: {aiFile.name}
                </p>
              )}
            </div>

            <button onClick={handleAiAnalysis} className="btn btn-primary" disabled={!aiFile || aiAnalyzing}>
              {aiAnalyzing ? (
                <><span className="spinner"></span>Analyzing...</>
              ) : (
                <><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>Analyze Transcript</>
              )}
            </button>

            {aiError && (
              <div style={{marginTop: '20px', padding: '16px', background: 'var(--badge-danger-bg)', color: 'var(--badge-danger-text)', borderRadius: '8px', border: '1px solid var(--badge-danger-text)'}}>
                ⚠️ {aiError}
              </div>
            )}

            <div style={{marginTop: '24px', padding: '16px', background: 'var(--badge-primary-bg)', borderRadius: '8px', border: '1px solid var(--badge-primary-text)'}}>
              <h4 style={{fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--badge-primary-text)'}}>💡 How AI Analysis Works</h4>
              <ul style={{fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, paddingLeft: '20px', margin: 0}}>
                <li>Upload your Bloomberg chat or trading transcript</li>
                <li>AI automatically detects client names, ISINs, tickers, sizes, and directions</li>
                <li>Review the extracted activities before importing</li>
                <li>Import all activities to your Activity Log with one click</li>
              </ul>
            </div>
          </div>
        </div>

        {aiResults.length > 0 && (
          <div className="card" style={{marginTop: '24px'}}>
            <div className="card-header">
              <div>
                <span>Detected Activities ({aiResults.length})</span>
                {analysisTimestamp && (
                  <div style={{fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)', marginTop: '4px'}}>
                    {analysisFileName} · Analyzed {analysisTimestamp.toLocaleDateString()} at {analysisTimestamp.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})}{tokensUsed ? ` · ${tokensUsed.totalTokens.toLocaleString()} tokens` : ''}
                  </div>
                )}
              </div>
              <button onClick={handleImportAiResults} className="btn btn-secondary"
                disabled={submitLoading || importBlocked}
                title={importBlocked ? 'Complete Step 2 — register new clients below — before importing' : 'Import all activities to Activity Log'}
              >
                {submitLoading ? (<><span className="spinner"></span>Importing...</>) :
                 importBlocked ? (
                  <><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  </svg>Complete Step 2 below first</>
                 ) : (
                  <><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                  </svg>Import All to Activity Log</>
                 )}
              </button>
            </div>

            {/* New Client Registration Section */}
            {newClientNames.length > 0 && (
              <div className="step-container" style={{margin: '20px 24px 0 24px'}}>
                <div className="step-label">
                  <span className="step-number">2</span>
                  <span className="step-title">Register New Clients</span>
                </div>
                <div style={{padding: '16px', background: '#7c3a001a', border: '1px solid #d97706', borderRadius: '8px'}}>
                <div style={{fontWeight: 700, fontSize: '14px', color: '#d97706', marginBottom: '12px'}}>
                  ⚠️ New Client Registration Required ({newClientNames.length} new {newClientNames.length === 1 ? 'client' : 'clients'})
                </div>
                <p style={{fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px'}}>
                  The following clients are not in your database. Please fill in their details before importing.
                </p>
                {newClientNames.map(name => (
                  <div key={name} style={{padding: '12px', background: 'var(--card-bg)', borderRadius: '8px', marginBottom: '8px', border: '1px solid var(--border)'}}>
                    {similarSuggestions[name]?.length > 0 && (
                      <div style={{marginBottom: '10px', padding: '8px 12px', background: 'var(--badge-warning-bg)', borderRadius: '6px', border: '1px solid var(--badge-warning-text)'}}>
                        <div style={{fontSize: '12px', fontWeight: 600, color: 'var(--badge-warning-text)', marginBottom: '6px'}}>Similar existing clients found:</div>
                        {similarSuggestions[name].map((m, i) => (
                          <div key={i} style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px'}}>
                            <span style={{fontSize: '12px', color: 'var(--text-primary)'}}>{m.client.name}</span>
                            <span style={{fontSize: '10px', color: 'var(--badge-warning-text)'}}>({Math.round(m.score*100)}% match)</span>
                            <button
                              className="btn"
                              style={{padding: '2px 8px', fontSize: '11px', background: 'var(--accent)', color: '#fff', borderRadius: '4px'}}
                              onClick={() => {
                                setClientMappings(p => ({...p, [name]: m.client.name}));
                              }}
                            >Use this</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{display: 'grid', gridTemplateColumns: '200px 160px 160px 1fr', gap: '12px', alignItems: 'center'}}>
                    <div>
                      <div style={{fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)'}}>{name}</div>
                      <span style={{fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: '#d97706', color: '#fff'}}>NEW CLIENT</span>
                    </div>
                    <div>
                      <label className="form-label" style={{fontSize: '11px', color: '#d97706'}}>Type *</label>
                      <select
                        className="form-select"
                        style={!newClientForms[name].type ? {borderColor: '#d97706'} : undefined}
                        value={newClientForms[name].type}
                        onChange={e => setNewClientForms(p => ({...p, [name]: {...p[name], type: e.target.value}}))}
                      >
                        <option value="">Select type</option>
                        {CLIENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label" style={{fontSize: '11px', color: '#d97706'}}>Region *</label>
                      <select
                        className="form-select"
                        style={!newClientForms[name].region ? {borderColor: '#d97706'} : undefined}
                        value={newClientForms[name].region}
                        onChange={e => setNewClientForms(p => ({...p, [name]: {...p[name], region: e.target.value}}))}
                      >
                        <option value="">Select region</option>
                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label" style={{fontSize: '11px'}}>Sales Coverage</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g., John Smith"
                        value={newClientForms[name].salesCoverage}
                        onChange={e => setNewClientForms(p => ({...p, [name]: {...p[name], salesCoverage: e.target.value}}))}
                      />
                    </div>
                    </div>
                  </div>
                ))}
                <hr style={{border:'none',borderTop:'1px solid #d97706',opacity:0.35,margin:'16px 0'}}/>
                <div style={{fontSize:'12px',color:'#d97706',marginBottom:'12px',fontWeight:600}}>
                  {allFormsValid
                    ? `✓ All ${newClientNames.length} ${newClientNames.length===1?'client':'clients'} complete — ready to import`
                    : `✓ ${completedFormsCount} of ${newClientNames.length} ${newClientNames.length===1?'client':'clients'} complete`}
                </div>
                <button
                  onClick={handleImportAiResults}
                  className={`btn bottom-import-btn ${allFormsValid ? 'bottom-import-btn--ready' : 'bottom-import-btn--blocked'}`}
                  disabled={!allFormsValid || submitLoading}
                >
                  {submitLoading ? (<><span className="spinner"></span>Importing...</>) :
                   allFormsValid ? (
                    <><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                    </svg>All clients registered — Import to Activity Log</>
                   ) : <>Fill in all required fields above to import</>}
                </button>
                </div>
              </div>
            )}

            <div className="table-container" style={{marginTop: newClientNames.length > 0 ? '16px' : '0'}}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Ticker</th>
                    <th>Size</th>
                    <th>Direction</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {aiResults.map((result, idx) => (
                    <tr key={idx}>
                      <td style={{fontWeight: 600}}>
                        {clientMappings[result.clientName] ? (
                          <><span style={{textDecoration:'line-through',opacity:0.5}}>{result.clientName}</span> → {clientMappings[result.clientName]}</>
                        ) : result.clientName}
                        {!clientMappings[result.clientName] && newClientForms[result.clientName] !== undefined && (
                          <span style={{marginLeft: '8px', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px', background: '#d97706', color: '#fff'}}>NEW</span>
                        )}
                        {clientMappings[result.clientName] && (
                          <span style={{marginLeft: '8px', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px', background: 'var(--badge-success-bg)', color: 'var(--badge-success-text)'}}>MAPPED</span>
                        )}
                      </td>
                      <td>{result.ticker || result.isin || '-'}</td>
                      <td>{result.size ? `${result.size}MM` : '-'}</td>
                      <td><span className={`badge ${getDirectionBadge(result.direction)}`}>{result.direction}</span></td>
                      <td>{result.price || '-'}</td>
                      <td><span className={`badge ${getStatusBadge(result.status)}`}>{result.status}</span></td>
                      <td style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis'}}>{result.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Upload History */}
        <div className="card" style={{marginTop: '24px'}}>
          <div className="card-header">
            <span>Upload History</span>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Analyzed By</th>
                  <th>Timestamp</th>
                  <th>Activities Detected</th>
                  <th>Tokens Used</th>
                  {isAdmin && <th>Download</th>}
                </tr>
              </thead>
              <tbody>
                {uploadHistory.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 6 : 5} style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>No uploads yet</td></tr>
                ) : (
                  <>
                    {uploadHistory.map(h => (
                      <tr key={h.id}>
                        <td style={{fontWeight: 600}}>{h.fileName}</td>
                        <td>{h.analyzedBy}</td>
                        <td>{h.analyzedAt ? `${h.analyzedAt.toLocaleDateString()} ${h.analyzedAt.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}` : '-'}</td>
                        <td>{h.activitiesDetected}</td>
                        <td>
                          <span title={`Prompt: ${(h.promptTokens||0).toLocaleString()} · Completion: ${(h.completionTokens||0).toLocaleString()}`} style={{cursor: 'help', borderBottom: '1px dotted var(--text-muted)'}}>
                            {(h.tokensUsed||0).toLocaleString()}
                          </span>
                        </td>
                        {isAdmin && (
                          <td>
                            {h.rawText ? (
                              <button
                                className="btn btn-secondary"
                                style={{padding: '4px 10px', fontSize: '12px'}}
                                onClick={() => {
                                  const blob = new Blob([h.rawText], { type: 'text/plain' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = h.fileName || 'transcript.txt';
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                              >Download</button>
                            ) : (
                              <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>N/A</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr style={{background: 'var(--table-header-bg)', fontWeight: 700}}>
                      <td colSpan="4" style={{textAlign: 'right', color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em'}}>Total Tokens Used</td>
                      <td style={{color: 'var(--accent)'}}>{uploadHistory.reduce((s, h) => s + (h.tokensUsed || 0), 0).toLocaleString()}</td>
                      {isAdmin && <td></td>}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <style jsx>{`
        .app-container{min-height:100vh;background:var(--bg-base);color:var(--text-primary);}
        .main-content{max-width:1400px;margin:0 auto;padding:32px 24px;}
        .page-header{margin-bottom:32px;}
        .page-title{font-size:32px;font-weight:700;color:var(--text-primary);margin-bottom:8px;}
        .page-description{font-size:16px;color:var(--text-secondary);}
        .card{background:var(--card-bg);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);}
        .card-header{font-size:17px;font-weight:700;color:var(--text-primary);padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
        .form-label{display:block;font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:5px;}
        .form-input,.form-select{width:100%;padding:10px 14px;background:var(--bg-input);border:1.5px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:14px;transition:all 0.2s ease;font-family:inherit;}
        .form-input:focus,.form-select:focus{outline:none;border-color:var(--border-focus);background:var(--bg-input-focus);box-shadow:0 0 0 3px var(--accent-glow);}
        .btn{padding:10px 18px;border-radius:8px;font-weight:600;font-size:13.5px;transition:all 0.2s ease;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:7px;font-family:inherit;white-space:nowrap;}
        .btn-primary{background:linear-gradient(135deg,var(--accent),var(--accent-hover));color:#fff;box-shadow:0 2px 8px var(--accent-glow-strong);}
        .btn-primary:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px var(--accent-glow-strong);}
        .btn-primary:disabled{opacity:0.5;cursor:not-allowed;}
        .btn-secondary{background:var(--btn-secondary-bg);color:#fff;}
        .btn-secondary:hover:not(:disabled){background:var(--btn-secondary-hover);}
        .btn-secondary:disabled{opacity:0.5;cursor:not-allowed;}
        .spinner{display:inline-block;width:10px;height:10px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}
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
        .step-container{position:relative;}
        .step-label{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
        .step-number{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#d97706;color:#fff;font-size:11px;font-weight:700;flex-shrink:0;}
        .step-title{font-size:14px;font-weight:700;color:#d97706;letter-spacing:0.02em;}
        .bottom-import-btn{width:100%;justify-content:center;padding:14px 20px;font-size:15px;border-radius:10px;margin-top:4px;}
        .bottom-import-btn--ready{background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;box-shadow:0 2px 12px rgba(22,163,74,0.35);}
        .bottom-import-btn--ready:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 16px rgba(22,163,74,0.45);}
        .bottom-import-btn--blocked{background:var(--btn-muted-bg);color:var(--btn-muted-text);opacity:0.7;cursor:not-allowed;}
      `}</style>
    </div>
  );
}
