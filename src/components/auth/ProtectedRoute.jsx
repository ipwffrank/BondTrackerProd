import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { canAccessModule, getModuleGate } from '../../config/moduleAccess';
import UpgradeGate from '../../pages/UpgradeGate';

export function ProtectedRoute({ children, adminOnly = false }) {
  const { currentUser, userData, orgPlan } = useAuth();
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

  return children;
}
