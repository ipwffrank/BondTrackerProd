import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AxleLogo } from '@bridgelogic/ui';

// ─── Constants ──────────────────────────────────────────────────────────────────
const COUNTRIES = [
  { name: 'Afghanistan', code: '+93' },
  { name: 'Albania', code: '+355' },
  { name: 'Algeria', code: '+213' },
  { name: 'Argentina', code: '+54' },
  { name: 'Australia', code: '+61' },
  { name: 'Austria', code: '+43' },
  { name: 'Bahrain', code: '+973' },
  { name: 'Bangladesh', code: '+880' },
  { name: 'Belgium', code: '+32' },
  { name: 'Brazil', code: '+55' },
  { name: 'Canada', code: '+1' },
  { name: 'Chile', code: '+56' },
  { name: 'China', code: '+86' },
  { name: 'Colombia', code: '+57' },
  { name: 'Croatia', code: '+385' },
  { name: 'Czech Republic', code: '+420' },
  { name: 'Denmark', code: '+45' },
  { name: 'Egypt', code: '+20' },
  { name: 'Finland', code: '+358' },
  { name: 'France', code: '+33' },
  { name: 'Germany', code: '+49' },
  { name: 'Ghana', code: '+233' },
  { name: 'Greece', code: '+30' },
  { name: 'Hong Kong', code: '+852' },
  { name: 'Hungary', code: '+36' },
  { name: 'India', code: '+91' },
  { name: 'Indonesia', code: '+62' },
  { name: 'Iran', code: '+98' },
  { name: 'Iraq', code: '+964' },
  { name: 'Ireland', code: '+353' },
  { name: 'Israel', code: '+972' },
  { name: 'Italy', code: '+39' },
  { name: 'Japan', code: '+81' },
  { name: 'Jordan', code: '+962' },
  { name: 'Kenya', code: '+254' },
  { name: 'Kuwait', code: '+965' },
  { name: 'Lebanon', code: '+961' },
  { name: 'Luxembourg', code: '+352' },
  { name: 'Malaysia', code: '+60' },
  { name: 'Mexico', code: '+52' },
  { name: 'Morocco', code: '+212' },
  { name: 'Netherlands', code: '+31' },
  { name: 'New Zealand', code: '+64' },
  { name: 'Nigeria', code: '+234' },
  { name: 'Norway', code: '+47' },
  { name: 'Oman', code: '+968' },
  { name: 'Pakistan', code: '+92' },
  { name: 'Philippines', code: '+63' },
  { name: 'Poland', code: '+48' },
  { name: 'Portugal', code: '+351' },
  { name: 'Qatar', code: '+974' },
  { name: 'Romania', code: '+40' },
  { name: 'Russia', code: '+7' },
  { name: 'Saudi Arabia', code: '+966' },
  { name: 'Singapore', code: '+65' },
  { name: 'South Africa', code: '+27' },
  { name: 'South Korea', code: '+82' },
  { name: 'Spain', code: '+34' },
  { name: 'Sweden', code: '+46' },
  { name: 'Switzerland', code: '+41' },
  { name: 'Taiwan', code: '+886' },
  { name: 'Thailand', code: '+66' },
  { name: 'Turkey', code: '+90' },
  { name: 'Ukraine', code: '+380' },
  { name: 'United Arab Emirates', code: '+971' },
  { name: 'United Kingdom', code: '+44' },
  { name: 'United States', code: '+1' },
  { name: 'Vietnam', code: '+84' },
];

const EMPLOYEE_OPTIONS = ['1-5', '6-30', '31-200', '201-500', '501-2000', '2000+'];

// ─── Styles ────────────────────────────────────────────────────────────────────
const STYLES = `
  .login-root {
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    min-height: 100vh;
    background: #0f172a;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    position: relative;
    overflow: hidden;
  }
  .login-root *, .login-root *::before, .login-root *::after { box-sizing: border-box; }

  .login-grid {
    position: absolute; inset: 0; z-index: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 48px 48px;
  }
  .login-glow {
    position: absolute; inset: 0; z-index: 0;
    background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(200,162,88,0.12) 0%, transparent 60%);
  }

  .login-card {
    position: relative; z-index: 1;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 20px;
    padding: 40px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 40px 80px rgba(0,0,0,0.5);
  }

  .login-logo {
    display: flex; align-items: center; gap: 10px;
    justify-content: center; margin-bottom: 28px;
  }

  .login-title {
    font-size: 24px; font-weight: 800; color: #f8fafc;
    margin: 0 0 6px; text-align: center; letter-spacing: -0.5px;
  }
  .login-subtitle {
    font-size: 14px; color: #64748b; text-align: center; margin: 0 0 28px;
  }

  .login-label {
    display: block; font-size: 13px; font-weight: 600;
    color: #94a3b8; margin-bottom: 7px; letter-spacing: 0.02em;
  }
  .login-input-wrap { position: relative; margin-bottom: 18px; }
  .login-input {
    width: 100%; padding: 11px 14px;
    background: #0f172a; border: 1px solid #334155;
    border-radius: 10px; color: #f8fafc;
    font-size: 15px; font-family: inherit; outline: none;
    transition: border-color 0.2s;
  }
  .login-input:focus { border-color: #C8A258; }
  .login-input::placeholder { color: #475569; }

  .login-input-pw { padding-right: 44px; }
  .login-pw-toggle {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; color: #475569;
    display: flex; align-items: center; padding: 4px;
    transition: color 0.2s;
  }
  .login-pw-toggle:hover { color: #94a3b8; }

  .login-btn {
    width: 100%; padding: 13px;
    background: #C8A258;
    color: #0F2137; border: none; border-radius: 10px;
    font-size: 15px; font-weight: 600; font-family: inherit;
    cursor: pointer; transition: background 0.2s, transform 0.2s;
    box-shadow: 0 4px 20px rgba(200,162,88,0.25);
  }
  .login-btn:hover:not(:disabled) { background: #D4B06A; transform: translateY(-1px); }
  .login-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

  .login-error {
    background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25);
    border-radius: 8px; padding: 11px 14px; margin-bottom: 18px;
    font-size: 13px; color: #fca5a5;
  }
  .login-success {
    background: rgba(200,162,88,0.1); border: 1px solid rgba(200,162,88,0.25);
    border-radius: 8px; padding: 11px 14px; margin-bottom: 18px;
    font-size: 13px; color: #C8A258;
  }

  .login-footer-link {
    text-align: center; font-size: 13px; color: #64748b; margin-top: 20px;
  }
  .login-contact-btn {
    background: none; border: none; cursor: pointer;
    color: #C8A258; font-size: 13px; font-weight: 500;
    font-family: inherit; padding: 0; transition: color 0.2s;
  }
  .login-contact-btn:hover { color: #D4B06A; }

  .login-sso-divider {
    display: flex; align-items: center; gap: 12px;
    margin: 18px 0; color: #475569; font-size: 12px;
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .login-sso-divider::before, .login-sso-divider::after {
    content: ''; flex: 1; height: 1px; background: #334155;
  }
  .login-sso-btn {
    width: 100%; padding: 13px;
    background: transparent;
    color: #f8fafc; border: 1px solid #334155; border-radius: 10px;
    font-size: 15px; font-weight: 600; font-family: inherit;
    cursor: pointer; transition: background 0.2s, border-color 0.2s;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .login-sso-btn:hover:not(:disabled) { background: rgba(200,162,88,0.06); border-color: #C8A258; }
  .login-sso-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .login-forgot-btn {
    background: none; border: none; cursor: pointer;
    color: #C8A258; font-size: 13px; font-weight: 500;
    font-family: inherit; padding: 0; transition: color 0.2s;
    display: block; margin-left: auto;
  }
  .login-forgot-btn:hover { color: #D4B06A; }

  .login-back-btn {
    background: none; border: none; cursor: pointer;
    color: #64748b; font-size: 13px; font-family: inherit;
    padding: 0; display: flex; align-items: center; gap: 6px;
    transition: color 0.2s; margin-bottom: 20px;
  }
  .login-back-btn:hover { color: #94a3b8; }

  /* ── Demo Modal ──────────────────────────────────────────────────────────── */
  .demo-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .demo-overlay *, .demo-overlay *::before, .demo-overlay *::after { box-sizing: border-box; }
  .demo-modal {
    background: #1e293b; border: 1px solid #334155;
    border-radius: 20px; padding: 36px; width: 100%;
    max-width: 520px; max-height: 90vh; overflow-y: auto;
    box-shadow: 0 40px 80px rgba(0,0,0,0.6);
  }
  .demo-modal-header {
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 16px; margin-bottom: 24px;
  }
  .demo-modal-title {
    font-size: 22px; font-weight: 800; color: #f8fafc;
    letter-spacing: -0.5px; margin: 0 0 4px;
  }
  .demo-modal-subtitle { font-size: 14px; color: #64748b; margin: 0; }
  .demo-close-btn {
    background: none; border: none; cursor: pointer;
    color: #475569; padding: 4px; display: flex;
    align-items: center; transition: color 0.2s; flex-shrink: 0;
  }
  .demo-close-btn:hover { color: #94a3b8; }
  .demo-row {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 12px; margin-bottom: 14px;
  }
  .demo-field { display: flex; flex-direction: column; margin-bottom: 14px; }
  .demo-field:last-child { margin-bottom: 0; }
  .demo-success { text-align: center; padding: 20px 0; }
  .demo-success-icon {
    width: 64px; height: 64px; border-radius: 50%;
    background: rgba(200,162,88,0.1); border: 1px solid rgba(200,162,88,0.25);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 20px;
  }
  .login-textarea {
    width: 100%; padding: 11px 14px;
    background: #0f172a; border: 1px solid #334155;
    border-radius: 10px; color: #f8fafc;
    font-size: 15px; font-family: inherit; outline: none;
    transition: border-color 0.2s; resize: vertical;
    min-height: 100px;
  }
  .login-textarea:focus { border-color: #C8A258; }
  .login-textarea::placeholder { color: #475569; }
  .login-phone-row { display: flex; gap: 8px; }
  .login-phone-select {
    width: 160px; flex-shrink: 0; padding: 11px 14px;
    background: #0f172a; border: 1px solid #334155;
    border-radius: 10px; color: #f8fafc;
    font-size: 14px; font-family: inherit; outline: none;
    cursor: pointer; transition: border-color 0.2s;
  }
  .login-phone-select:focus { border-color: #C8A258; }
  @media (max-width: 480px) {
    .login-card { padding: 28px 20px; border-radius: 16px; }
    .demo-modal { padding: 24px 20px; }
    .demo-row { grid-template-columns: 1fr; }
    .login-phone-row { flex-direction: column; }
    .login-phone-select { width: 100%; }
  }
`;

// ─── Eye Icon ──────────────────────────────────────────────────────────────────
function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

// ─── Demo Modal ────────────────────────────────────────────────────────────────
function DemoModal({ onClose }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', jobTitle: '',
    email: '', company: '', employees: '', countryCode: '+1', phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.company) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const body = new URLSearchParams({
        'form-name': 'demo-request',
        firstName: form.firstName,
        lastName: form.lastName,
        jobTitle: form.jobTitle,
        email: form.email,
        company: form.company,
        employees: form.employees,
        phone: form.phone ? `${form.countryCode} ${form.phone}` : '',
      });
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      await addDoc(collection(db, 'demoRequests'), {
        firstName: form.firstName,
        lastName: form.lastName,
        jobTitle: form.jobTitle,
        email: form.email,
        company: form.company,
        employees: form.employees,
        phone: form.phone ? `${form.countryCode} ${form.phone}` : '',
        status: 'NEW',
        notes: '',
        submittedAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px',
    background: '#0f172a', border: '1px solid #334155',
    borderRadius: '10px', color: '#f8fafc',
    fontSize: '14px', fontFamily: 'inherit', outline: 'none',
  };
  const labelStyle = {
    display: 'block', fontSize: '13px', fontWeight: 600,
    color: '#94a3b8', marginBottom: '7px',
  };

  return (
    <div className="demo-overlay" onClick={handleOverlayClick}>
      <div className="demo-modal">
        <div className="demo-modal-header">
          <div>
            <h2 className="demo-modal-title">Request a Demo</h2>
            <p className="demo-modal-subtitle">Our team will be in touch within one business day.</p>
          </div>
          <button className="demo-close-btn" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {submitted ? (
          <div className="demo-success">
            <div className="demo-success-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C8A258" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h3 style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>Request Received</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
              Thank you! A member of our team will reach out to <strong style={{ color: '#cbd5e1' }}>{form.email}</strong> within one business day.
            </p>
            <button className="login-btn" style={{ marginTop: '24px' }} onClick={onClose}>Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {error && <div className="login-error">{error}</div>}

            <div className="demo-row">
              <div className="demo-field">
                <label style={labelStyle}>First Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input name="firstName" value={form.firstName} onChange={handleChange} style={inputStyle} placeholder="Jane" required />
              </div>
              <div className="demo-field">
                <label style={labelStyle}>Last Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input name="lastName" value={form.lastName} onChange={handleChange} style={inputStyle} placeholder="Smith" required />
              </div>
            </div>

            <div className="demo-field">
              <label style={labelStyle}>Job Title</label>
              <input name="jobTitle" value={form.jobTitle} onChange={handleChange} style={inputStyle} placeholder="Director, Bond Sales" />
            </div>

            <div className="demo-field">
              <label style={labelStyle}>Company Email <span style={{ color: '#ef4444' }}>*</span></label>
              <input name="email" type="email" value={form.email} onChange={handleChange} style={inputStyle} placeholder="jane@firm.com" required />
            </div>

            <div className="demo-row">
              <div className="demo-field">
                <label style={labelStyle}>Company <span style={{ color: '#ef4444' }}>*</span></label>
                <input name="company" value={form.company} onChange={handleChange} style={inputStyle} placeholder="Goldman Sachs" required />
              </div>
              <div className="demo-field">
                <label style={labelStyle}>Employees</label>
                <select name="employees" value={form.employees} onChange={handleChange} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Select range</option>
                  {EMPLOYEE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <div className="demo-field">
              <label style={labelStyle}>Phone Number</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select name="countryCode" value={form.countryCode} onChange={handleChange} style={{ ...inputStyle, width: '170px', flexShrink: 0, cursor: 'pointer' }}>
                  {COUNTRIES.map(c => (
                    <option key={c.name} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </select>
                <input name="phone" type="tel" value={form.phone} onChange={handleChange} style={inputStyle} placeholder="Phone number" />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="login-btn" style={{ marginTop: '8px' }}>
              {submitting ? 'Submitting...' : 'Request Demo'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Login View ────────────────────────────────────────────────────────────────
function LoginView({ onForgotPassword, onOpenDemo, onContact }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoAvailable, setSsoAvailable] = useState(false);
  const [ssoCheckedDomain, setSsoCheckedDomain] = useState('');

  const { login, loginWithSso, getSsoProviderForEmail } = useAuth();
  const navigate = useNavigate();

  // Check if the email domain has SSO enabled (runs on blur)
  async function checkSsoForEmail() {
    const domain = email.trim().split('@')[1];
    if (!domain || domain === ssoCheckedDomain) return;
    setSsoCheckedDomain(domain);
    try {
      const info = await getSsoProviderForEmail(email.trim());
      setSsoAvailable(!!info);
    } catch {
      setSsoAvailable(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/activities');
    } catch (err) {
      const code = err.code;
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later or reset your password.');
      } else {
        setError('Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSsoLogin() {
    try {
      setError('');
      setSsoLoading(true);
      await loginWithSso(email.trim());
      navigate('/activities');
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('SSO sign-in was cancelled.');
      } else {
        setError('SSO sign-in failed. Please try again or use password login.');
      }
    } finally {
      setSsoLoading(false);
    }
  }

  return (
    <>
      <h1 className="login-title">Welcome back</h1>
      <p className="login-subtitle">Sign in to your Axle workspace</p>

      {error && <div className="login-error">{error}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label className="login-label">Email</label>
          <div className="login-input-wrap" style={{ marginBottom: '6px' }}>
            <input
              type="email" value={email}
              onChange={e => { setEmail(e.target.value); setSsoAvailable(false); setSsoCheckedDomain(''); }}
              onBlur={checkSsoForEmail}
              className="login-input" placeholder="you@firm.com" required autoComplete="email"
            />
          </div>
        </div>

        <div style={{ marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
            <label className="login-label" style={{ margin: 0 }}>Password</label>
            <button type="button" className="login-forgot-btn" onClick={onForgotPassword}>
              Forgot password?
            </button>
          </div>
          <div className="login-input-wrap">
            <input
              type={showPassword ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)}
              className="login-input login-input-pw" placeholder="••••••••"
              required autoComplete="current-password"
            />
            <button type="button" className="login-pw-toggle" onClick={() => setShowPassword(p => !p)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading || ssoLoading} className="login-btn" style={{ marginTop: '8px' }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      {ssoAvailable && (
        <>
          <div className="login-sso-divider">or</div>

          <button type="button" disabled={ssoLoading || loading} className="login-sso-btn" onClick={handleSsoLogin}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            {ssoLoading ? 'Connecting to SSO...' : 'Sign in with Company SSO'}
          </button>
        </>
      )}

      <div className="login-footer-link">
        New to Axle?{' '}
        <button type="button" className="login-contact-btn" onClick={onContact || onOpenDemo}>
          Contact us
        </button>
        {' '}for access.
      </div>
    </>
  );
}

// ─── Forgot Password View ──────────────────────────────────────────────────────
function ForgotPasswordView({ onBack }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const { sendPasswordReset } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    try {
      setError('');
      setLoading(true);
      await sendPasswordReset(email.trim());
      setSuccess(true);
    } catch (err) {
      const code = err.code;
      if (code === 'auth/user-not-found') {
        // Don't reveal whether the email exists — show success anyway for security
        setSuccess(true);
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="login-back-btn" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back to sign in
      </button>

      <h1 className="login-title">Reset your password</h1>
      <p className="login-subtitle">
        Enter your registered email and we will send you a secure link to reset your password.
      </p>

      {error && <div className="login-error">{error}</div>}

      {success ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'rgba(200,162,88,0.1)', border: '1px solid rgba(200,162,88,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C8A258" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <p style={{ color: '#f8fafc', fontWeight: '600', fontSize: '16px', margin: '0 0 8px' }}>
            Check your inbox
          </p>
          <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px' }}>
            If an account exists for <strong style={{ color: '#94a3b8' }}>{email}</strong>, you will receive a password reset link shortly.
          </p>
          <button type="button" className="login-btn" style={{ opacity: 1 }} onClick={onBack}>
            Back to Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div>
            <label className="login-label">Email address</label>
            <div className="login-input-wrap">
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="login-input" placeholder="you@firm.com"
                required autoFocus autoComplete="email"
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
      )}
    </>
  );
}

// ─── Root Component ────────────────────────────────────────────────────────────
// ─── Contact View ───────────────────────────────────────────────────────────
function ContactView({ onBack }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', countryCode: '+65', phone: '', message: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.message.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/.netlify/functions/contact-us', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone ? `${form.countryCode} ${form.phone}` : '',
          message: form.message,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'rgba(200,162,88,0.1)', border: '1px solid rgba(200,162,88,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C8A258" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 className="login-title">Message Sent</h1>
          <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, margin: '0 0 24px' }}>
            Thank you, {form.firstName}. We'll get back to you shortly.
          </p>
          <button type="button" className="login-btn" onClick={onBack}>
            Back to Sign In
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <button type="button" className="login-back-btn" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back to sign in
      </button>

      <h1 className="login-title">Contact Us</h1>
      <p className="login-subtitle">We'd love to hear from you. Fill in the form below.</p>

      {error && <div className="login-error">{error}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label className="login-label">First Name *</label>
            <div className="login-input-wrap" style={{ marginBottom: 0 }}>
              <input name="firstName" value={form.firstName} onChange={handleChange}
                className="login-input" placeholder="Jane" required />
            </div>
          </div>
          <div>
            <label className="login-label">Last Name *</label>
            <div className="login-input-wrap" style={{ marginBottom: 0 }}>
              <input name="lastName" value={form.lastName} onChange={handleChange}
                className="login-input" placeholder="Smith" required />
            </div>
          </div>
        </div>

        <div>
          <label className="login-label">Company Email *</label>
          <div className="login-input-wrap">
            <input name="email" type="email" value={form.email} onChange={handleChange}
              className="login-input" placeholder="jane@firm.com" required />
          </div>
        </div>

        <div>
          <label className="login-label">Phone</label>
          <div className="login-input-wrap">
            <div className="login-phone-row">
              <select name="countryCode" value={form.countryCode} onChange={handleChange} className="login-phone-select">
                {COUNTRIES.map(c => (
                  <option key={`${c.name}-${c.code}`} value={c.code}>{c.name} ({c.code})</option>
                ))}
              </select>
              <input name="phone" type="tel" value={form.phone} onChange={handleChange}
                className="login-input" placeholder="Phone number" />
            </div>
          </div>
        </div>

        <div>
          <label className="login-label">Message *</label>
          <div className="login-input-wrap">
            <textarea name="message" value={form.message} onChange={handleChange}
              className="login-textarea" placeholder="How can we help?" required />
          </div>
        </div>

        <button type="submit" disabled={submitting} className="login-btn" style={{ marginTop: '4px' }}>
          {submitting ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </>
  );
}

export { LoginView, ForgotPasswordView, ContactView, EyeIcon, STYLES as LOGIN_STYLES };

export default function Login() {
  const [view, setView] = useState('login'); // 'login' | 'forgot' | 'contact'
  const [showDemoModal, setShowDemoModal] = useState(false);

  return (
    <>
      <style>{STYLES}</style>
      <div className="login-root">
        <div className="login-grid" />
        <div className="login-glow" />

        <div className="login-card">
          {/* Logo */}
          <div className="login-logo">
            <AxleLogo size="md" variant="dark" />
          </div>

          {view === 'login' ? (
            <LoginView
              onForgotPassword={() => setView('forgot')}
              onOpenDemo={() => setShowDemoModal(true)}
              onContact={() => setView('contact')}
            />
          ) : view === 'forgot' ? (
            <ForgotPasswordView onBack={() => setView('login')} />
          ) : (
            <ContactView onBack={() => setView('login')} />
          )}
        </div>
      </div>

      {showDemoModal && <DemoModal onClose={() => setShowDemoModal(false)} />}
    </>
  );
}
