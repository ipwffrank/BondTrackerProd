import React from 'react';
import { Link } from 'react-router-dom';
import AxleLogo from './AxleLogo';

const STYLES = `
  .mkt-footer-link {
    color: rgba(255,255,255,0.45);
    font-family: 'Manrope', sans-serif;
    font-size: 14px;
    text-decoration: none;
    display: block;
    padding: 4px 0;
    transition: color 0.2s;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
  }
  .mkt-footer-link:hover { color: rgba(255,255,255,0.8); }

  .mkt-footer-heading {
    font-family: 'Manrope', sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: rgba(200,162,88,0.7);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin: 0 0 16px;
  }

  .mkt-footer-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 48px;
  }

  @media (max-width: 860px) {
    .mkt-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
  }
  @media (max-width: 480px) {
    .mkt-footer-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
  }
`;

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

export default function MarketingFooter() {
  return (
    <>
      <style>{STYLES}</style>
      <footer style={{
        background: '#050C16',
        borderTop: '1px solid rgba(200,162,88,0.08)',
        padding: '64px 40px 32px',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="mkt-footer-grid">
            {/* Brand */}
            <div>
              <div style={{ marginBottom: '20px' }}>
                <AxleLogo variant="dark" size="sm" />
              </div>
              <p style={{
                fontFamily: "'Manrope', sans-serif", fontSize: '14px',
                color: 'rgba(255,255,255,0.4)', lineHeight: '1.7',
                maxWidth: '260px', margin: '0 0 20px',
              }}>
                The central intelligence platform for bond sales desks.
              </p>
              <a href="mailto:info@axle-finance.com" style={{
                fontFamily: "'Manrope', sans-serif", fontSize: '14px',
                color: '#C8A258', textDecoration: 'none',
              }}>
                info@axle-finance.com
              </a>
            </div>

            {/* Product */}
            <div>
              <p className="mkt-footer-heading">Product</p>
              <button onClick={() => scrollTo('product')} className="mkt-footer-link">Features</button>
              <button onClick={() => scrollTo('product')} className="mkt-footer-link">Integrations</button>
              <button onClick={() => scrollTo('contact')} className="mkt-footer-link">Request Demo</button>
            </div>

            {/* Company */}
            <div>
              <p className="mkt-footer-heading">Company</p>
              <button onClick={() => scrollTo('about')} className="mkt-footer-link">About</button>
              <button onClick={() => scrollTo('contact')} className="mkt-footer-link">Contact</button>
              <Link to="/login" className="mkt-footer-link">Login</Link>
            </div>

            {/* Legal */}
            <div>
              <p className="mkt-footer-heading">Legal</p>
              <Link to="/legal/privacy" className="mkt-footer-link">Privacy Policy</Link>
              <Link to="/legal/terms" className="mkt-footer-link">Terms of Service</Link>
              <Link to="/legal/disclaimer" className="mkt-footer-link">Disclaimer</Link>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{
            marginTop: '48px', paddingTop: '24px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', flexWrap: 'wrap', gap: '12px',
          }}>
            <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: '13px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
              &copy; 2026 ZHOOZH PTE. LTD. All rights reserved.
            </p>
            <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: '13px', color: 'rgba(255,255,255,0.25)', margin: 0 }}>
              Singapore
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
