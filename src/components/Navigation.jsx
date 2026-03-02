import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { AxleLogo } from '@alteri/ui';

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('axle-theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('axle-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to log out?')) {
      try {
        await signOut(auth);
        navigate('/login');
      } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to log out');
      }
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <Link to="/" className="brand-link">
            <AxleLogo size="sm" variant="dark" />
          </Link>
        </div>

        <div className="nav-links">
          <Link 
            to="/activities" 
            className={`nav-link ${isActive('/activities') ? 'active' : ''}`}
          >
            Activities
          </Link>

          <Link 
            to="/clients" 
            className={`nav-link ${isActive('/clients') ? 'active' : ''}`}
          >
            Clients
          </Link>

          <Link 
            to="/pipeline" 
            className={`nav-link ${isActive('/pipeline') ? 'active' : ''}`}
          >
            Pipeline
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

        <div className="nav-actions">
          <button 
            onClick={toggleTheme}
            className="theme-toggle"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>

          <div className="user-menu">
            <div className="user-info">
              <span className="user-name">{userData?.name || userData?.email}</span>
              {userData?.isAdmin && (
                <span className="badge badge-primary">Admin</span>
              )}
            </div>
            <button onClick={handleLogout} className="btn-logout">
              Logout
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .navigation {
          background: var(--nav-bg);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 1000;
          backdrop-filter: blur(10px);
        }

        .nav-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 64px;
        }

        .nav-brand {
          flex-shrink: 0;
        }

        .brand-link {
          display: flex;
          align-items: center;
          text-decoration: none;
          transition: opacity 0.2s;
        }

        .brand-link:hover {
          opacity: 0.85;
        }

        .nav-links {
          display: flex;
          gap: 8px;
          flex: 1;
          justify-content: center;
          padding: 0 24px;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 8px;
          text-decoration: none;
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .nav-link:hover {
          background: var(--nav-hover);
          color: var(--text-primary);
        }

        .nav-link.active {
          background: rgba(200, 162, 88, 0.12);
          color: #C8A258;
          border: 1px solid rgba(200, 162, 88, 0.2);
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-shrink: 0;
        }

        .theme-toggle {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--card-bg);
          color: var(--text-primary);
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .theme-toggle:hover {
          background: var(--nav-hover);
          transform: translateY(-1px);
        }

        .user-menu {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-info {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .user-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
        }

        .badge-primary {
          background: var(--badge-primary-bg);
          color: var(--badge-primary-text);
        }

        .btn-logout {
          padding: 10px 18px;
          border-radius: 8px;
          border: 1px solid #ef4444;
          background: #ef4444;
          color: #ffffff;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .btn-logout:hover {
          background: #dc2626;
          border-color: #dc2626;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
        }

        @media (max-width: 1024px) {
          .nav-links {
            gap: 4px;
            padding: 0 12px;
          }

          .nav-link {
            padding: 8px 12px;
            font-size: 13px;
          }

          .brand-text {
            font-size: 18px;
          }
        }

        @media (max-width: 768px) {
          .nav-container {
            height: auto;
            flex-direction: column;
            padding: 12px 16px;
            gap: 12px;
          }

          .nav-links {
            width: 100%;
            justify-content: flex-start;
            overflow-x: auto;
            padding: 0;
          }

          .nav-actions {
            width: 100%;
            justify-content: space-between;
          }

          .user-name {
            font-size: 12px;
          }
        }
      `}</style>
    </nav>
  );
}
