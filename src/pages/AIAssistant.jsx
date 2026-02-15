import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function AIAssistant() {
  const { userData } = useAuth();
  
  const [aiFile, setAiFile] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState([]);
  const [aiError, setAiError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  async function handleAiAnalysis() {
    if (!aiFile) return;

    setAiAnalyzing(true);
    setAiError('');
    setAiResults([]);

    try {
      const text = await aiFile.text();
      
      const response = await fetch('/.netlify/functions/analyze-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'AI analysis failed');
      }

      setAiResults(result.activities || []);
      if (result.activities?.length === 0) {
        setAiError('No activities detected in the transcript');
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
      
      for (const activity of aiResults) {
        await addDoc(activitiesRef, {
          clientName: activity.clientName || 'UNKNOWN',
          activityType: 'Bloomberg Chat',
          isin: activity.isin || '',
          ticker: activity.ticker || '',
          size: parseFloat(activity.size) || 0,
          currency: activity.currency || 'USD',
          price: parseFloat(activity.price) || null,
          direction: activity.direction || '',
          status: 'ENQUIRY',
          notes: activity.notes || 'Imported from AI analysis',
          createdAt: serverTimestamp(),
          createdBy: `${userData.name || userData.email} (AI Import)`
        });
      }

      alert(`Imported ${aiResults.length} activities successfully!`);
      setAiResults([]);
      setAiFile(null);
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import activities');
    } finally {
      setSubmitLoading(false);
    }
  }

  const getDirectionBadge = (direction) => {
    const badges = {
      'BUY': 'badge-success',
      'SELL': 'badge-danger',
      'TWO-WAY': 'badge-warning'
    };
    return badges[direction] || 'badge-primary';
  };

  return (
    <div className="app-container">
      <Navigation />
      
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">🤖 AI Assistant</h1>
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

            <button
              onClick={handleAiAnalysis}
              className="btn btn-primary"
              disabled={!aiFile || aiAnalyzing}
            >
              {aiAnalyzing ? (
                <>
                  <span className="spinner"></span>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  Analyze Transcript
                </>
              )}
            </button>

            {aiError && (
              <div style={{
                marginTop: '20px',
                padding: '16px',
                background: 'var(--badge-danger-bg)',
                color: 'var(--badge-danger-text)',
                borderRadius: '8px',
                border: '1px solid var(--badge-danger-text)'
              }}>
                ⚠️ {aiError}
              </div>
            )}

            <div style={{
              marginTop: '24px',
              padding: '16px',
              background: 'var(--badge-primary-bg)',
              borderRadius: '8px',
              border: '1px solid var(--badge-primary-text)'
            }}>
              <h4 style={{fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--badge-primary-text)'}}>
                💡 How AI Analysis Works
              </h4>
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
              <span>Detected Activities ({aiResults.length})</span>
              <button
                onClick={handleImportAiResults}
                className="btn btn-secondary"
                disabled={submitLoading}
              >
                {submitLoading ? (
                  <>
                    <span className="spinner"></span>
                    Importing...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Import All to Activity Log
                  </>
                )}
              </button>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>ISIN</th>
                    <th>Ticker</th>
                    <th>Size</th>
                    <th>Currency</th>
                    <th>Direction</th>
                    <th>Price</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {aiResults.map((result, idx) => (
                    <tr key={idx}>
                      <td style={{fontWeight: 600}}>{result.clientName}</td>
                      <td>{result.isin || '-'}</td>
                      <td>{result.ticker || '-'}</td>
                      <td>{result.size}MM</td>
                      <td><span className="badge badge-primary">{result.currency}</span></td>
                      <td><span className={`badge ${getDirectionBadge(result.direction)}`}>{result.direction}</span></td>
                      <td>{result.price || '-'}</td>
                      <td style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis'}}>{result.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 5px;
        }

        .form-input {
          width: 100%;
          padding: 10px 14px;
          background: var(--bg-input);
          border: 1.5px solid var(--border);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 14px;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--border-focus);
          background: var(--bg-input-focus);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }

        .btn {
          padding: 10px 18px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13.5px;
          transition: all 0.2s ease;
          cursor: pointer;
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-family: inherit;
          white-space: nowrap;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--accent), var(--accent-hover));
          color: #fff;
          box-shadow: 0 2px 8px var(--accent-glow-strong);
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px var(--accent-glow-strong);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: var(--btn-secondary-bg);
          color: #fff;
        }

        .btn-secondary:hover:not(:disabled) {
          background: var(--btn-secondary-hover);
        }

        .spinner {
          display: inline-block;
          width: 10px;
          height: 10px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
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

        .badge-success {
          background: var(--badge-success-bg);
          color: var(--badge-success-text);
        }

        .badge-warning {
          background: var(--badge-warning-bg);
          color: var(--badge-warning-text);
        }

        .badge-danger {
          background: var(--badge-danger-bg);
          color: var(--badge-danger-text);
        }
      `}</style>
    </div>
  );
}
