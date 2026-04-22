import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { teamService } from '../services/team.service';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const STYLES = `
  .invite-root {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    min-height: 100vh;
    background: #0f172a;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    position: relative;
    overflow: hidden;
  }
  .invite-root *, .invite-root *::before, .invite-root *::after { box-sizing: border-box; }

  .invite-grid {
    position: absolute; inset: 0; z-index: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 48px 48px;
  }
  .invite-glow {
    position: absolute; inset: 0; z-index: 0;
    background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(200,162,88,0.12) 0%, transparent 60%);
  }

  .invite-card {
    position: relative; z-index: 1;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 20px;
    padding: 40px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 40px 80px rgba(0,0,0,0.5);
  }

  .invite-title {
    font-size: 24px; font-weight: 800; color: #f8fafc;
    margin: 0 0 6px; text-align: center; letter-spacing: -0.5px;
  }
  .invite-subtitle {
    font-size: 14px; color: #64748b; text-align: center; margin: 0 0 24px;
  }

  .invite-label {
    display: block; font-size: 13px; font-weight: 600;
    color: #94a3b8; margin-bottom: 7px; letter-spacing: 0.02em;
  }
  .invite-input-wrap { position: relative; margin-bottom: 18px; }
  .invite-input {
    width: 100%; padding: 11px 14px;
    background: #0f172a; border: 1px solid #334155;
    border-radius: 10px; color: #f8fafc;
    font-size: 15px; font-family: inherit; outline: none;
    transition: border-color 0.2s;
  }
  .invite-input:focus { border-color: #C8A258; }
  .invite-input::placeholder { color: #475569; }

  .invite-input-pw { padding-right: 44px; }
  .invite-pw-toggle {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; color: #475569;
    display: flex; align-items: center; padding: 4px;
    transition: color 0.2s;
  }
  .invite-pw-toggle:hover { color: #94a3b8; }

  .invite-btn {
    width: 100%; padding: 13px;
    background: #C8A258;
    color: #0F2137; border: none; border-radius: 10px;
    font-size: 15px; font-weight: 600; font-family: inherit;
    cursor: pointer; transition: background 0.2s, transform 0.2s;
    box-shadow: 0 4px 20px rgba(200,162,88,0.25);
  }
  .invite-btn:hover:not(:disabled) { background: #D4B06A; transform: translateY(-1px); }
  .invite-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

  .invite-error {
    background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25);
    border-radius: 8px; padding: 11px 14px; margin-bottom: 18px;
    font-size: 13px; color: #fca5a5;
  }

  .invite-info {
    background: rgba(200,162,88,0.08); border: 1px solid rgba(200,162,88,0.2);
    border-radius: 10px; padding: 14px 16px; margin-bottom: 24px;
  }
  .invite-info-row {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; color: #cbd5e1;
  }
  .invite-info-row + .invite-info-row { margin-top: 8px; }
  .invite-info-label {
    font-weight: 600; color: #94a3b8; min-width: 44px;
  }
  .invite-info-value { color: #f8fafc; }

  .invite-footer {
    text-align: center; font-size: 13px; color: #64748b; margin-top: 20px;
  }
  .invite-footer a {
    color: #C8A258; font-weight: 500; text-decoration: none;
    transition: color 0.2s;
  }
  .invite-footer a:hover { color: #D4B06A; }

  .invite-error-icon {
    width: 56px; height: 56px; border-radius: 50%;
    background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 20px;
  }

  .invite-spinner {
    width: 40px; height: 40px; border-radius: 50%;
    border: 3px solid #334155; border-top-color: #C8A258;
    animation: invite-spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }
  @keyframes invite-spin { to { transform: rotate(360deg); } }

  @media (max-width: 480px) {
    .invite-card { padding: 28px 20px; border-radius: 16px; }
  }
`;

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

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitationLoading, setInvitationLoading] = useState(true);
  const [invitation, setInvitation] = useState(null);
  const [orgSsoEnabled, setOrgSsoEnabled] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);

  const { signupWithInvitation, loginWithSso } = useAuth();
  const navigate = useNavigate();

  const token = searchParams.get('token');
  const orgId = searchParams.get('org');

  useEffect(() => {
    async function loadInvitation() {
      if (!token || !orgId) {
        setError('Invalid invitation link. Please contact your administrator for a new invitation.');
        setInvitationLoading(false);
        return;
      }

      try {
        const invitationData = await teamService.getInvitationByToken(orgId, token);

        if (!invitationData) {
          setError('Invitation not found. It may have been cancelled or already used.');
          setInvitationLoading(false);
          return;
        }

        if (invitationData.status !== 'pending') {
          setError('This invitation has already been used or cancelled.');
          setInvitationLoading(false);
          return;
        }

        const expiresAt = invitationData.expiresAt?.toDate ? invitationData.expiresAt.toDate() : new Date(invitationData.expiresAt);
        if (expiresAt < new Date()) {
          setError('This invitation has expired. Please contact your administrator for a new invitation.');
          setInvitationLoading(false);
          return;
        }

        setInvitation(invitationData);

        // Check if org has SSO enabled
        try {
          const orgSnap = await getDoc(doc(db, `organizations/${orgId}`));
          if (orgSnap.exists() && orgSnap.data().ssoEnabled) {
            setOrgSsoEnabled(true);
          }
        } catch {}

        setInvitationLoading(false);
      } catch (err) {
        console.error('Error loading invitation:', err);
        setError('Failed to load invitation. Please try again or contact support.');
        setInvitationLoading(false);
      }
    }

    loadInvitation();
  }, [token, orgId]);

  async function handleSsoAccept() {
    try {
      setError('');
      setSsoLoading(true);
      const result = await loginWithSso(invitation.email);
      // Enforce that the SSO'd identity matches the invited email — otherwise
      // any user who can complete SSO for the org's IdP could claim an
      // invitation that was meant for someone else (and its role).
      const authedEmail = (result?.user?.email || '').toLowerCase();
      const invitedEmail = (invitation.email || '').toLowerCase();
      if (!authedEmail || authedEmail !== invitedEmail) {
        setError('This invitation was sent to ' + invitation.email + '. Please sign in with that account.');
        setSsoLoading(false);
        return;
      }
      await teamService.acceptInvitation(orgId, token);
      navigate('/activities');
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('SSO sign-in was cancelled.');
      } else {
        setError('SSO sign-in failed: ' + err.message);
      }
    } finally {
      setSsoLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!firstName.trim() || !surname.trim()) {
      return setError('Please enter both your first name and surname');
    }

    if (!consentGiven) {
      return setError('You must agree to the Privacy Policy to create an account');
    }

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    if (password.length < 8) {
      return setError('Password must be at least 8 characters');
    }

    try {
      setError('');
      setLoading(true);

      const fullName = `${firstName.trim()} ${surname.trim()}`;

      await signupWithInvitation(
        invitation.email,
        password,
        fullName,
        invitation.organizationId,
        invitation.organizationName,
        invitation.role,
        token
      );

      await teamService.acceptInvitation(orgId, token);

      navigate('/activities');
    } catch (err) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please login instead.');
      } else {
        setError('Failed to create account: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  // Loading state
  if (invitationLoading) {
    return (
      <>
        <style>{STYLES}</style>
        <div className="invite-root">
          <div className="invite-grid" />
          <div className="invite-glow" />
          <div className="invite-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
            <div className="invite-spinner" />
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Loading invitation...</p>
          </div>
        </div>
      </>
    );
  }

  // Error state (no valid invitation)
  if (error && !invitation) {
    return (
      <>
        <style>{STYLES}</style>
        <div className="invite-root">
          <div className="invite-grid" />
          <div className="invite-glow" />
          <div className="invite-card" style={{ textAlign: 'center' }}>
            <div className="invite-error-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <h1 className="invite-title">Invalid Invitation</h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', margin: '8px 0 28px' }}>{error}</p>
            <Link to="/login" className="invite-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              Go to Login
            </Link>
          </div>
        </div>
      </>
    );
  }

  // Signup form
  return (
    <>
      <style>{STYLES}</style>
      <div className="invite-root">
        <div className="invite-grid" />
        <div className="invite-glow" />

        <div className="invite-card">
          <h1 className="invite-title">Join {invitation?.organizationName}</h1>
          <p className="invite-subtitle">You've been invited by {invitation?.invitedBy}</p>

          {error && <div className="invite-error">{error}</div>}

          <div className="invite-info">
            <div className="invite-info-row">
              <span className="invite-info-label">Email</span>
              <span className="invite-info-value">{invitation?.email}</span>
            </div>
            <div className="invite-info-row">
              <span className="invite-info-label">Role</span>
              <span className="invite-info-value">{invitation?.role === 'admin' ? 'Administrator' : 'Team Member'}</span>
            </div>
          </div>

          {orgSsoEnabled ? (
            <div>
              <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
                Your organization uses Single Sign-On. Click below to sign in with your company identity provider.
              </p>
              <button type="button" disabled={ssoLoading} className="invite-btn" onClick={handleSsoAccept}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  {ssoLoading ? 'Connecting to SSO...' : 'Accept & Sign in with SSO'}
                </span>
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="invite-label">First Name</label>
                <div className="invite-input-wrap">
                  <input
                    type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                    className="invite-input" placeholder="Jane"
                    required autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="invite-label">Surname</label>
                <div className="invite-input-wrap">
                  <input
                    type="text" value={surname} onChange={e => setSurname(e.target.value)}
                    className="invite-input" placeholder="Smith"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="invite-label">Password</label>
              <div className="invite-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="invite-input invite-input-pw" placeholder="Create a password"
                  required minLength={6}
                />
                <button type="button" className="invite-pw-toggle" onClick={() => setShowPassword(p => !p)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <div>
              <label className="invite-label">Confirm Password</label>
              <div className="invite-input-wrap">
                <input
                  type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="invite-input invite-input-pw" placeholder="Confirm your password"
                  required minLength={6}
                />
                <button type="button" className="invite-pw-toggle" onClick={() => setShowConfirm(p => !p)} aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px' }}>
              <input
                type="checkbox"
                id="consent"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                style={{ marginTop: '3px', accentColor: '#C8A258' }}
              />
              <label htmlFor="consent" style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                I agree to the{' '}
                <Link to="/legal" target="_blank" style={{ color: '#C8A258', textDecoration: 'none' }}>
                  Privacy Policy
                </Link>{' '}
                and consent to the collection and use of my personal data as described therein.
              </label>
            </div>

            <button type="submit" disabled={loading || !consentGiven} className="invite-btn" style={{ marginTop: '4px' }}>
              {loading ? 'Creating account...' : 'Accept Invitation & Create Account'}
            </button>
          </form>
          )}

          <div className="invite-footer">
            Already have an account?{' '}
            <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </>
  );
}
