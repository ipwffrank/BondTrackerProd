import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AxleLogo from './components/marketing/AxleLogo';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AcceptInvite from './pages/AcceptInvite';
import Activities from './pages/Activities';
import AIAssistant from './pages/AIAssistant';
import Clients from './pages/Clients';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import SecurityPage from './pages/SecurityPage';
import Analytics from './pages/Analytics';
import Pipeline from './pages/Pipeline';
import Team from './pages/Team';
import LandingPage from './pages/LandingPage';
import AuthAction from './pages/AuthAction';
import HostAdmin from './pages/HostAdmin';
import LegalPage from './pages/LegalPage';
import MaintenanceBanner from './components/MaintenanceBanner';
import PilotBanner from './components/PilotBanner';

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', background: '#0F2137',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Manrope', -apple-system, sans-serif",
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'center' }}>
          <AxleLogo variant="dark" size="lg" />
        </div>
        <p style={{ color: 'rgba(240,237,232,0.45)', fontSize: '14px', fontFamily: "'Manrope', sans-serif", margin: 0 }}>Loading your workplace</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { currentUser } = useAuth();

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LandingPage showLogin />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/auth-action" element={<AuthAction />} />
        <Route path="/hostadmin" element={<HostAdmin />} />
        <Route path="/legal/:page" element={<LegalPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/privacy" element={<Navigate to="/legal/privacy" replace />} />
        <Route path="/terms" element={<Navigate to="/legal/terms" replace />} />
        <Route path="/disclaimer" element={<Navigate to="/legal/disclaimer" replace />} />
        
        {/* Main application routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/activities" element={<ProtectedRoute><Activities /></ProtectedRoute>} />
        <Route path="/ai-assistant" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
        <Route path="/pipeline" element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
        <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />

        {/* Root: landing page for visitors, dashboard for authenticated users */}
        <Route
          path="/"
          element={currentUser ? <Navigate to="/dashboard" replace /> : <LandingPage />}
        />

        {/* Catch-all: dashboard if logged in, login otherwise */}
        <Route
          path="*"
          element={currentUser ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthLoadingWrapper />
    </AuthProvider>
  );
}

function AuthLoadingWrapper() {
  const { currentUser } = useAuth();
  const [isInitializing, setIsInitializing] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [currentUser]);

  if (isInitializing) {
    return <LoadingScreen />;
  }
  return (
    <>
      {currentUser && <MaintenanceBanner />}
      {currentUser && <PilotBanner />}
      <AppRoutes />
    </>
  );
}

export default App;
