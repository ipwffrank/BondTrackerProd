import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AcceptInvite from './pages/AcceptInvite';
import Activities from './pages/Activities';
import AIAssistant from './pages/AIAssistant';
import Clients from './pages/Clients';
import Analytics from './pages/Analytics';
import Pipeline from './pages/Pipeline';
import Team from './pages/Team';
import LandingPage from './pages/LandingPage';
import AuthAction from './pages/AuthAction';

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '28px',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: '800', fontSize: '20px', color: 'white',
            }}>A</div>
            <span style={{ fontSize: '22px', fontWeight: '700', color: '#f8fafc', letterSpacing: '-0.3px' }}>Axle</span>
          </div>
        </div>
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%',
          border: '3px solid #334155', borderTopColor: '#10b981',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 20px',
        }} />
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading your workspace...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { currentUser } = useAuth();

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/auth-action" element={<AuthAction />} />
        
        {/* Main application routes */}
        <Route path="/activities" element={<ProtectedRoute><Activities /></ProtectedRoute>} />
        <Route path="/ai-assistant" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
        <Route path="/pipeline" element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
        
        {/* Redirect old dashboard route to activities */}
        <Route path="/dashboard" element={<Navigate to="/activities" replace />} />
        
        {/* Root: landing page for visitors, app for authenticated users */}
        <Route
          path="/"
          element={currentUser ? <Navigate to="/activities" replace /> : <LandingPage />}
        />
        
        {/* Catch all - redirect to activities if logged in, login if not */}
        <Route 
          path="*" 
          element={currentUser ? <Navigate to="/activities" replace /> : <Navigate to="/login" replace />} 
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
  return <AppRoutes />;
}

export default App;
