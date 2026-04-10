import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { canAccessModule, getModuleGate } from '../../config/moduleAccess';
import UpgradeGate from '../../pages/UpgradeGate';

function ReConsentModal({ onAccept }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: '#1e293b', border: '1px solid #334155',
        borderRadius: '16px', padding: '32px', maxWidth: '460px', width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <h2 style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 700, margin: '0 0 12px' }}>
          Updated Privacy Policy
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, margin: '0 0 20px' }}>
          Our Privacy Policy has been updated. Please review the changes and confirm your continued consent to use Axle.
        </p>
        <p style={{ margin: '0 0 24px' }}>
          <Link to="/legal/privacy" target="_blank" style={{ color: '#C8A258', fontSize: '14px', textDecoration: 'underline' }}>
            View Privacy Policy
          </Link>
        </p>
        <button onClick={onAccept} style={{
          width: '100%', padding: '12px',
          background: '#C8A258', color: '#0F2137', border: 'none',
          borderRadius: '10px', fontSize: '15px', fontWeight: 600,
          cursor: 'pointer',
        }}>
          I Agree to the Updated Policy
        </button>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children, adminOnly = false }) {
  const { currentUser, userData, orgPlan, needsReConsent, acceptReConsent } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && !userData?.isAdmin) {
    return <Navigate to="/dashboard" />;
  }

  // Check module access based on org subscription tier
  const gate = getModuleGate(location.pathname);
  if (gate && !canAccessModule(location.pathname, orgPlan)) {
    return <UpgradeGate moduleName={gate.label} requiredTier={gate.tier} />;
  }

  return (
    <>
      {needsReConsent && <ReConsentModal onAccept={acceptReConsent} />}
      {children}
    </>
  );
}
