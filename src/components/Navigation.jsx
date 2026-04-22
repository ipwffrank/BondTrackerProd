import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { AxleLogo } from '@bridgelogic/ui';
import { canAccessModule, getModuleGate } from '../config/moduleAccess';

const NAV_LINKS = [
  {
    to: '/activities',
    label: 'Trade Activities',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
    )
  },
  {
    to: '/pipeline',
    label: 'New Issue Pipeline',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
    )
  },
  {
    to: '/clients',
    label: 'Clients Mapping',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>
    )
  },
  {
    to: '/contacts',
    label: 'Client Contacts',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
      </svg>
    )
  },
  {
    to: '/ai-assistant',
    label: 'AI Script Reader',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
      </svg>
    )
  },
  {
    to: '/analytics',
    label: 'Analytics',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
    )
  },
];

const TEAM_LINK = {
  to: '/team',
  label: 'Admin',
  icon: (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
    </svg>
  )
};

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userData, orgPlan } = useAuth();
  const [theme, setTheme] = useState('dark');
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebarCollapsed') === 'true'
  );

  useEffect(() => {
    const savedTheme = localStorage.getItem('axle-theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', collapsed ? '48px' : '220px');
    localStorage.setItem('sidebarCollapsed', String(collapsed));
  }, [collapsed]);

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

  const links = userData?.isAdmin ? [...NAV_LINKS, TEAM_LINK] : NAV_LINKS;

  if (collapsed) {
    return (
      <nav className="sidebar sidebar-collapsed">
        <button
          onClick={() => setCollapsed(false)}
          className="expand-btn"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>

        <style jsx>{`
          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            background: var(--nav-bg);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            z-index: 1000;
            backdrop-filter: blur(10px);
            overflow: hidden;
          }

          .sidebar-collapsed {
            width: 48px;
            align-items: center;
            justify-content: flex-start;
            padding-top: 12px;
          }

          .expand-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 8px;
            border: none;
            background: none;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s;
          }

          .expand-btn:hover {
            background: var(--section-label-bg);
            color: var(--text-primary);
          }
        `}</style>
      </nav>
    );
  }

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <Link to="/" className="brand-link">
          <AxleLogo size="sm" variant="dark" />
        </Link>
        <button
          onClick={() => setCollapsed(true)}
          className="collapse-btn"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
      </div>

      <div className="nav-links">
        {links.map((link) => {
          const locked = !canAccessModule(link.to, orgPlan);
          const gate = getModuleGate(link.to);
          if (locked) {
            return (
              <Link
                key={link.to}
                to={link.to}
                className="nav-link locked"
                title={`Upgrade to ${gate?.tier} to unlock ${link.label}`}
              >
                <span className="nav-icon" style={{ opacity: 0.4 }}>{link.icon}</span>
                <span className="nav-label" style={{ opacity: 0.4 }}>{link.label}</span>
                <svg className="lock-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </Link>
            );
          }
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`nav-link ${isActive(link.to) ? 'active' : ''}`}
            >
              <span className="nav-icon">{link.icon}</span>
              <span className="nav-label">{link.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
              Light Mode
            </>
          ) : (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
              </svg>
              Dark Mode
            </>
          )}
        </button>

        <div className="user-info">
          <span className="user-name">{userData?.name || userData?.email}</span>
          {userData?.isAdmin && (
            <span className="badge badge-primary">Admin</span>
          )}
        </div>

        <button onClick={handleLogout} className="btn-logout">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          Logout
        </button>
      </div>

      <style jsx>{`
        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          width: 220px;
          background: var(--nav-bg);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          z-index: 1000;
          backdrop-filter: blur(10px);
          overflow: hidden;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 14px 12px;
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

        .collapse-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .collapse-btn:hover {
          background: var(--section-label-bg);
          color: var(--text-primary);
          border-color: var(--accent);
        }

        .nav-links {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 8px;
          overflow-y: auto;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          text-decoration: none;
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s ease;
          white-space: nowrap;
          border: 1px solid transparent;
        }

        .nav-link:hover {
          background: var(--section-label-bg);
          color: var(--text-primary);
        }

        .nav-link.active {
          background: rgba(200, 162, 88, 0.12);
          color: #C8A258;
          border-color: rgba(200, 162, 88, 0.2);
        }

        .nav-link.locked {
          color: var(--text-muted);
          cursor: pointer;
          position: relative;
        }

        .nav-link.locked:hover {
          background: rgba(239, 68, 68, 0.06);
          color: var(--text-muted);
        }

        .lock-icon {
          color: var(--text-muted);
          opacity: 0.6;
          flex-shrink: 0;
        }

        .nav-icon {
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }

        .nav-label {
          flex: 1;
        }

        .sidebar-footer {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 12px 8px;
          border-top: 1px solid var(--border);
          flex-shrink: 0;
        }

        .theme-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: none;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          font-family: inherit;
        }

        .theme-toggle:hover {
          background: var(--section-label-bg);
          color: var(--text-primary);
        }

        .user-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 6px 12px;
        }

        .user-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          display: inline-block;
        }

        .badge-primary {
          background: var(--badge-primary-bg);
          color: var(--badge-primary-text);
        }

        .btn-logout {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid #ef4444;
          background: none;
          color: #ef4444;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
          width: 100%;
          font-family: inherit;
        }

        .btn-logout:hover {
          background: #ef4444;
          color: white;
        }
      `}</style>
    </nav>
  );
}
