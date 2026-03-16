import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AxleLogo from './AxleLogo';

const NAV_LINKS = [
  { label: 'Product', id: 'product' },
  { label: 'Compare', id: 'compare' },
  { label: 'About',   id: 'about'   },
  { label: 'Contact', id: 'contact' },
];

const STYLES = `
  .mkt-nav-link {
    color: rgba(255,255,255,0.65);
    font-family: 'Outfit', sans-serif;
    font-size: 14px;
    font-weight: 500;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px 2px;
    transition: color 0.2s;
    letter-spacing: 0.01em;
  }
  .mkt-nav-link:hover { color: #FFFFFF; }

  .mkt-btn-demo {
    background: #C8A258;
    color: #0F2137;
    border: none;
    cursor: pointer;
    font-family: 'Outfit', sans-serif;
    font-size: 14px;
    font-weight: 600;
    padding: 9px 20px;
    border-radius: 6px;
    text-decoration: none;
    display: inline-block;
    transition: background 0.2s, transform 0.15s;
    letter-spacing: 0.01em;
  }
  .mkt-btn-demo:hover { background: #D4B06A; transform: translateY(-1px); }

  .mkt-btn-login {
    color: rgba(255,255,255,0.65);
    font-family: 'Outfit', sans-serif;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    padding: 9px 14px;
    transition: color 0.2s;
  }
  .mkt-btn-login:hover { color: #FFFFFF; }

  .mkt-hamburger {
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    color: rgba(255,255,255,0.8);
    display: none;
  }

  @media (max-width: 860px) {
    .mkt-desktop-links { display: none !important; }
    .mkt-desktop-cta   { display: none !important; }
    .mkt-hamburger     { display: flex !important; align-items: center; }
  }

  .mkt-drawer-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 998;
    backdrop-filter: blur(2px);
  }
  .mkt-drawer {
    position: fixed; top: 0; right: 0; bottom: 0;
    width: min(300px, 85vw);
    background: #162B44;
    z-index: 999;
    display: flex; flex-direction: column;
    padding: 24px;
    border-left: 1px solid rgba(200,162,88,0.15);
    animation: drawerIn 0.25s ease;
  }
  @keyframes drawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

  .mkt-drawer-btn {
    color: rgba(255,255,255,0.75);
    font-family: 'Outfit', sans-serif;
    font-size: 17px;
    font-weight: 500;
    background: none;
    border: none;
    cursor: pointer;
    padding: 14px 0;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    display: block;
    width: 100%;
    text-align: left;
    transition: color 0.2s;
  }
  .mkt-drawer-btn:hover { color: #C8A258; }
`;

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

export default function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isOnLandingPage = location.pathname === '/' || location.pathname === '/login';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavClick = (id) => {
    setMenuOpen(false);
    if (isOnLandingPage) {
      scrollTo(id);
    } else {
      navigate('/', { state: { scrollTo: id } });
    }
  };

  const handleLogoClick = () => {
    if (isOnLandingPage) {
      scrollTo('home');
    } else {
      navigate('/');
    }
  };

  return (
    <>
      <style>{STYLES}</style>

      <nav
        role="navigation"
        aria-label="Main navigation"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
          height: '64px', padding: '0 40px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: scrolled ? 'rgba(15,33,55,0.97)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(200,162,88,0.12)' : 'none',
          boxShadow: scrolled ? '0 2px 24px rgba(0,0,0,0.15)' : 'none',
          transition: 'background 0.3s, box-shadow 0.3s, border-color 0.3s',
        }}
      >
        {/* Logo — scroll to top */}
        <button
          onClick={handleLogoClick}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          aria-label="Go to top"
        >
          <AxleLogo variant="dark" size="sm" />
        </button>

        {/* Desktop nav links */}
        <div className="mkt-desktop-links" style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          {NAV_LINKS.map(l => (
            <button key={l.id} onClick={() => handleNavClick(l.id)} className="mkt-nav-link">
              {l.label}
            </button>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="mkt-desktop-cta" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Link to="/login" className="mkt-btn-login">Login</Link>
          <button onClick={() => handleNavClick('contact')} className="mkt-btn-demo">
            Request Demo
          </button>
        </div>

        {/* Hamburger */}
        <button
          className="mkt-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </nav>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div className="mkt-drawer-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="mkt-drawer" role="dialog" aria-label="Navigation menu">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <AxleLogo variant="dark" size="sm" />
              <button
                onClick={() => setMenuOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: '4px' }}
                aria-label="Close menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {NAV_LINKS.map(l => (
              <button key={l.id} onClick={() => handleNavClick(l.id)} className="mkt-drawer-btn">
                {l.label}
              </button>
            ))}

            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Link to="/login" onClick={() => setMenuOpen(false)} style={{
                color: 'rgba(255,255,255,0.65)', fontFamily: "'Outfit', sans-serif",
                fontSize: '15px', textDecoration: 'none', padding: '10px 0',
              }}>
                Login
              </Link>
              <button onClick={() => handleNavClick('contact')} className="mkt-btn-demo" style={{ textAlign: 'center', padding: '13px' }}>
                Request Demo
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
