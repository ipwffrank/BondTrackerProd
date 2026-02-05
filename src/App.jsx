import Pipeline from './pages/Pipeline';
<Route path="/pipeline" element={
  <ProtectedRoute>
    <Pipeline />
  </ProtectedRoute>
} />
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Activities from './pages/Activities';
import Clients from './pages/Clients';
import Analytics from './pages/Analytics';
import Pipeline from './pages/Pipeline';

// Loading Screen Component
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-8">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Bond Tracker</h2>
        <p className="text-gray-600">Loading your workspace...</p>
        <div className="mt-4 flex gap-1 justify-center">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
        </div>
      </div>
    </div>
  );
}

// App Routes Component
function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/activities" element={
          <ProtectedRoute>
            <Activities />
          </ProtectedRoute>
        } />
        
        <Route path="/clients" element={
          <ProtectedRoute>
            <Clients />
          </ProtectedRoute>
        } />
        
        <Route path="/analytics" element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        } />
        
        <Route path="/pipeline" element={
          <ProtectedRoute>
            <Pipeline />
          </ProtectedRoute>
        } />
        
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
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

// Wrapper that shows loading screen until auth is ready
function AuthLoadingWrapper() {
  const { currentUser } = useAuth();
  const [isInitializing, setIsInitializing] = React.useState(true);

  React.useEffect(() => {
    // Give Firebase a moment to initialize
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
