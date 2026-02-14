import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';

export default function Navigation() {
  const { userData, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('bondtracker-theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('bondtracker-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="nav">
      <div className="nav-content">
        <div className="nav-left">
          <div className="logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="6" fill="currentColor"/>
              <text x="16" y="22" textAnchor="middle" fontFamily="sans-serif" fontWeight="700" fontSize="18" fill="white">B</text>
            </svg>
            <span>BondTracker</span>
          </div>
          
          <div className="nav-links">
            <Link 
              to="/activities" 
              className={`nav-link ${isActive('/activities') ? 'active' : ''}`}
            >
              Activity Log
            </Link>
            <Link 
              to="/pipeline" 
              className={`nav-link ${isActive('/pipeline') ? 'active' : ''}`}
            >
              Pipeline
            </Link>
            <Link 
              to="/clients" 
              className={`nav-link ${isActive('/clients') ? 'active' : ''}`}
            >
              Clients
            </Link>
            <Link 
              to="/analytics" 
              className={`nav-link ${isActive('/analytics') ? 'active' : ''}`}
            >
              Analytics
            </Link>
            <Link 
              to="/ai-assistant" 
              className={`nav-link ${isActive('/ai-assistant') ? 'active' : ''}`}
            >
              AI Assistant
            </Link>
            {userData?.isAdmin && (
              <Link 
                to="/team" 
                className={`nav-link ${isActive('/team') ? 'active' : ''}`}
              >
                Team
              </Link>
            )}
          </div>
        </div>

        <div className="nav-right">
          <button onClick={toggleTheme} className="theme-toggle" title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          
          <div className="user-info">
            <div className="user-details">
              <div className="user-name">{userData?.name || 'User'}</div>
              <div className="user-org">{userData?.organizationName || 'Organization'}</div>
            </div>
            {userData?.isAdmin && (
              <span className="badge badge-primary">Admin</span>
            )}
          </div>

          <button onClick={handleLogout} className="btn btn-danger">
            Logout
          </button>
        </div>
      </div>

      <style jsx>{`
        .nav {
          background: var(--nav-bg);
          border-bottom: 1px solid var(--nav-border);
          backdrop-filter: blur(10px);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .nav-left {
          display: flex;
          align-items: center;
          gap: 40px;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 20px;
          font-weight: 700;
          color: var(--logo-color);
        }

        .nav-links {
          display: flex;
          gap: 24px;
        }

        .nav-link {
          color: var(--text-secondary);
          text-decoration: none;
          font-weight: 500;
          font-size: 14px;
          transition: color 0.2s;
          padding: 6px 0;
          border-bottom: 2px solid transparent;
        }

        .nav-link:hover {
          color: var(--accent);
        }

        .nav-link.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .theme-toggle {
          background: var(--toggle-bg);
          border: none;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 18px;
          transition: all 0.2s;
        }

        .theme-toggle:hover {
          background: var(--accent);
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-details {
          text-align: right;
        }

        .user-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .user-org {
          font-size: 11px;
          color: var(--text-muted);
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

        .btn-danger {
          background: #dc2626;
          color: #fff;
        }

        .btn-danger:hover {
          background: #b91c1c;
        }

        @media (max-width: 768px) {
          .nav-links {
            display: none;
          }
        }
      `}</style>
    </nav>
  );
}
