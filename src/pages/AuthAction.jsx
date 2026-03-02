import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../services/firebase';
import { AxleLogo } from '@alteri/ui';

// ─── Styles ────────────────────────────────────────────────────────────────────
const STYLES = `
  .auth-action-root {
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
  .auth-action-root *, .auth-action-root *::before, .auth-action-root *::after { box-sizing: border-box; }

  .aa-grid {
    position: absolute; inset: 0; z-index: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 48px 48px;
  }
  .aa-glow {
    position: absolute; inset: 0; z-index: 0;
    background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(200,162,88,0.12) 0%, transparent 60%);
  }

  .aa-card {
    position: relative; z-index: 1;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 20px;
    padding: 40px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 40px 80px rgba(0,0,0,0.5);
  }

  .aa-logo {
    display: flex; align-items: center; gap: 10px;
    justify-content: center; margin-bottom: 28px;
  }

  .aa-title {
    font-size: 24px; font-weight: 800; color: #f8fafc;
    margin: 0 0 6px; text-align: center; letter-spacing: -0.5px;
  }
  .aa-subtitle {
    font-size: 14px; color: #64748b; text-align: center; margin: 0 0 28px; line-height: 1.6;
  }

  .aa-label {
    display: block; font-size: 13px; font-weight: 600;
    color: #94a3b8; margin-bottom: 7px; letter-spacing: 0.02em;
  }
  .aa-input-wrap { position: relative; margin-bottom: 16px; }
  .aa-input {
    width: 100%; padding: 11px 14px;
    background: #0f172a; border: 1px solid #334155;
    border-radius: 10px; color: #f8fafc;
    font-size: 15px; font-family: inherit; outline: none;
    transition: border-color 0.2s;
  }
  .aa-input:focus { border-color: #C8A258; }
  .aa-input::placeholder { color: #475569; }
  .aa-input-pw { padding-right: 44px; }

  .aa-pw-toggle {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; color: #475569;
    display: flex; align-items: center; padding: 4px;
    transition: color 0.2s;
  }
  .aa-pw-toggle:hover { color: #94a3b8; }

  .aa-btn {
    width: 100%; padding: 13px;
    background: #C8A258;
    color: #0F2137; border: none; border-radius: 10px;
    font-size: 15px; font-weight: 600; font-family: inherit;
    cursor: pointer; transition: background 0.2s, transform 0.2s;
    box-shadow: 0 4px 20px rgba(200,162,88,0.25);
    margin-top: 8px;
  }
  .aa-btn:hover:not(:disabled) { background: #D4B06A; transform: translateY(-1px); }
  .aa-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

  .aa-error {
    background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25);
    border-radius: 8px; padding: 11px 14px; margin-bottom: 18px;
    font-size: 13px; color: #fca5a5;
  }

  .aa-strength {
    display: flex; gap: 4px; margin-top: 8px; margin-bottom: 4px;
  }
  .aa-strength-bar {
    flex: 1; height: 3px; border-radius: 2px; background: #334155;
    transition: background 0.3s;
  }
  .aa-strength-label {
    font-size: 12px; color: #64748b; margin-bottom: 12px;
  }

  .aa-link {
    display: block; text-align: center; margin-top: 20px;
    font-size: 13px; color: #64748b; text-decoration: none;
    transition: color 0.2s;
  }
  .aa-link:hover { color: #94a3b8; }

  @keyframes aa-spin {
    to { transform: rotate(360deg); }
  }
  .aa-spinner {
    width: 40px; height: 40px; border-radius: 50%;
    border: 3px solid #334155; border-top-color: #C8A258;
    animation: aa-spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }

  @media (max-width: 480px) {
    .aa-card { padding: 28px 20px; border-radius: 16px; }
  }
`;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 3) return { score, label: 'Fair', color: '#f59e0b' };
  if (score === 4) return { score, label: 'Good', color: '#3b82f6' };
  return { score, label: 'Strong', color: '#C8A258' };
}

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

// ─── Password Reset Form ───────────────────────────────────────────────────────
function ResetPasswordForm({ oobCode }) {
  const [email, setEmail] = useState('');
  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const strength = getPasswordStrength(newPassword);

  // Verify the oobCode and get the associated email
  useEffect(() => {
    async function verify() {
      try {
        const resolvedEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(resolvedEmail);
        setVerifying(false);
      } catch (err) {
        console.error('Invalid or expired reset code:', err);
        setVerifyError('This password reset link has expired or already been used. Please request a new one.');
        setVerifying(false);
      }
    }
    verify();
  }, [oobCode]);

  async function sendConfirmationEmail(userEmail) {
    try {
      await fetch('/.netlify/functions/password-changed-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
    } catch {
      // Non-critical — password was still reset successfully
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    try {
      setError('');
      setLoading(true);
      await confirmPasswordReset(auth, oobCode, newPassword);
      // Send confirmation notification email
      await sendConfirmationEmail(email);
      setSuccess(true);
    } catch (err) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/expired-action-code') {
        setError('This reset link has expired. Please request a new one.');
      } else if (err.code === 'auth/invalid-action-code') {
        setError('This reset link is invalid or already been used.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.');
      } else {
        setError('Failed to reset password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (verifying) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div className="aa-spinner" />
        <p style={{ color: '#64748b', fontSize: '14px' }}>Verifying your reset link...</p>
      </div>
    );
  }

  if (verifyError) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p style={{ color: '#fca5a5', fontSize: '14px', lineHeight: '1.6', margin: '0 0 20px' }}>{verifyError}</p>
        <Link to="/login" className="aa-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '13px' }}>
          Back to Sign In
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: '#C8A258',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <p style={{ color: '#f8fafc', fontWeight: '700', fontSize: '18px', margin: '0 0 10px' }}>
          Password updated
        </p>
        <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6', margin: '0 0 8px' }}>
          Your password has been successfully changed.
        </p>
        <p style={{ color: '#475569', fontSize: '13px', lineHeight: '1.6', margin: '0 0 24px' }}>
          A confirmation has been sent to <strong style={{ color: '#94a3b8' }}>{email}</strong>.
        </p>
        <Link to="/login" className="aa-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '13px' }}>
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="aa-title">Create new password</h1>
      <p className="aa-subtitle">
        Resetting password for <strong style={{ color: '#94a3b8' }}>{email}</strong>
      </p>

      {error && <div className="aa-error">{error}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label className="aa-label">New Password</label>
          <div className="aa-input-wrap" style={{ marginBottom: '4px' }}>
            <input
              type={showNew ? 'text' : 'password'} value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="aa-input aa-input-pw" placeholder="Min. 8 characters"
              required autoFocus
            />
            <button type="button" className="aa-pw-toggle" onClick={() => setShowNew(p => !p)} aria-label="Toggle password visibility">
              <EyeIcon open={showNew} />
            </button>
          </div>
          {/* Strength meter */}
          {newPassword && (
            <>
              <div className="aa-strength">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="aa-strength-bar" style={{
                    background: i <= strength.score ? strength.color : '#334155',
                  }} />
                ))}
              </div>
              <div className="aa-strength-label" style={{ color: strength.color }}>
                {strength.label} password
              </div>
            </>
          )}
        </div>

        <div>
          <label className="aa-label">Confirm New Password</label>
          <div className="aa-input-wrap">
            <input
              type={showConfirm ? 'text' : 'password'} value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="aa-input aa-input-pw" placeholder="Re-enter your password"
              required
            />
            <button type="button" className="aa-pw-toggle" onClick={() => setShowConfirm(p => !p)} aria-label="Toggle confirm password visibility">
              <EyeIcon open={showConfirm} />
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="aa-btn">
          {loading ? 'Updating password...' : 'Update Password'}
        </button>
      </form>

      <Link to="/login" className="aa-link">Back to Sign In</Link>
    </>
  );
}

// ─── Root Component ────────────────────────────────────────────────────────────
export default function AuthAction() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  return (
    <>
      <style>{STYLES}</style>
      <div className="auth-action-root">
        <div className="aa-grid" />
        <div className="aa-glow" />

        <div className="aa-card">
          {/* Logo */}
          <div className="aa-logo">
            <AxleLogo size="md" variant="dark" />
          </div>

          {mode === 'resetPassword' && oobCode ? (
            <ResetPasswordForm oobCode={oobCode} />
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#fca5a5', fontSize: '14px', margin: '0 0 20px' }}>
                Invalid or missing action. Please use the link from your email.
              </p>
              <Link to="/login" className="aa-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '13px' }}>
                Back to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
