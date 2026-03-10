import { useState } from 'react';
import { AxleLogo } from '@alteri/ui';

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
`;

export default function HostAdmin() {
  const [hostKey, setHostKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text }

  const handleAuth = (e) => {
    e.preventDefault();
    if (hostKey.trim()) setAuthenticated(true);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setMessage({ type: 'error', text: 'Please enter an email.' }); return; }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/.netlify/functions/host-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), hostKey: hostKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setMessage({ type: 'success', text: data.message });
      setEmail('');
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="ha-root">
        <div className="ha-card">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <AxleLogo size="md" variant="dark" />
          </div>
          <h1 className="ha-title">Host Admin</h1>
          <p className="ha-subtitle">Password reset tool</p>

          {!authenticated ? (
            <form onSubmit={handleAuth}>
              <label className="ha-label">Admin Key</label>
              <input
                type="password" value={hostKey} onChange={e => setHostKey(e.target.value)}
                className="ha-input" placeholder="Enter host admin key" autoFocus
              />
              <button type="submit" className="ha-btn">Authenticate</button>
            </form>
          ) : (
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
        </div>
      </div>
    </>
  );
}
