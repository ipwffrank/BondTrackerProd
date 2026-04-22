import React from 'react';
import MarketingNav from '../components/marketing/MarketingNav';
import MarketingFooter from '../components/marketing/MarketingFooter';

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap');

  .lp2 { font-family: 'Manrope', -apple-system, sans-serif; background: #0F2137; color: #F0EDE8; overflow-x: hidden; }
  .lp2 *, .lp2 *::before, .lp2 *::after { box-sizing: border-box; }
  .lp2 a { color: inherit; }
  .lp2 button { font-family: inherit; }

  .sec-hero {
    padding: 120px 24px 80px;
    text-align: center;
    border-bottom: 1px solid rgba(240,237,232,0.08);
  }

  .sec-hero-tag {
    display: inline-block;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #C8A258;
    background: rgba(200,162,88,0.1);
    border: 1px solid rgba(200,162,88,0.25);
    border-radius: 20px;
    padding: 5px 16px;
    margin-bottom: 24px;
  }

  .sec-hero-h1 {
    font-size: clamp(36px, 5vw, 60px);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.02em;
    margin: 0 0 20px;
    color: #F0EDE8;
  }

  .sec-hero-sub {
    font-size: 18px;
    color: rgba(240,237,232,0.65);
    max-width: 540px;
    margin: 0 auto;
    line-height: 1.6;
  }

  .sec-section {
    max-width: 860px;
    margin: 0 auto;
    padding: 64px 24px;
    border-bottom: 1px solid rgba(240,237,232,0.07);
  }

  .sec-section:last-of-type {
    border-bottom: none;
  }

  .sec-section-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: rgba(200,162,88,0.12);
    border: 1px solid rgba(200,162,88,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
  }

  .sec-section-h2 {
    font-size: 26px;
    font-weight: 700;
    color: #F0EDE8;
    margin: 0 0 12px;
    letter-spacing: -0.01em;
  }

  .sec-section-lead {
    font-size: 16px;
    color: rgba(240,237,232,0.65);
    line-height: 1.7;
    margin: 0 0 28px;
  }

  .sec-card-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .sec-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(240,237,232,0.1);
    border-radius: 10px;
    padding: 20px 22px;
  }

  .sec-card-title {
    font-size: 13px;
    font-weight: 700;
    color: #C8A258;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin: 0 0 8px;
  }

  .sec-card-body {
    font-size: 14px;
    color: rgba(240,237,232,0.7);
    line-height: 1.6;
    margin: 0;
  }

  .sec-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sec-list li {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: 15px;
    color: rgba(240,237,232,0.75);
    line-height: 1.55;
  }

  .sec-list li::before {
    content: '';
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin-top: 2px;
    background: rgba(200,162,88,0.15);
    border: 1.5px solid rgba(200,162,88,0.4);
    border-radius: 50%;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23C8A258' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 13l4 4L19 7'/%3E%3C/svg%3E");
    background-size: 11px;
    background-repeat: no-repeat;
    background-position: center;
  }

  .sec-compliance-row {
    display: flex;
    align-items: flex-start;
    gap: 18px;
    padding: 18px 0;
    border-bottom: 1px solid rgba(240,237,232,0.07);
  }

  .sec-compliance-row:last-child {
    border-bottom: none;
  }

  .sec-compliance-tag {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    background: rgba(200,162,88,0.12);
    border: 1px solid rgba(200,162,88,0.3);
    color: #C8A258;
    border-radius: 6px;
    padding: 4px 10px;
    min-width: 54px;
    text-align: center;
    margin-top: 2px;
  }

  .sec-compliance-text {
    font-size: 14px;
    color: rgba(240,237,232,0.7);
    line-height: 1.6;
    margin: 0;
  }

  .sec-compliance-text strong {
    color: #F0EDE8;
    font-weight: 600;
  }

  .sec-contact-box {
    background: rgba(200,162,88,0.06);
    border: 1px solid rgba(200,162,88,0.2);
    border-radius: 12px;
    padding: 28px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
  }

  .sec-contact-label {
    font-size: 13px;
    font-weight: 600;
    color: rgba(240,237,232,0.5);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 6px;
  }

  .sec-contact-email {
    font-size: 20px;
    font-weight: 700;
    color: #C8A258;
    text-decoration: none;
  }

  .sec-contact-email:hover {
    text-decoration: underline;
  }

  .sec-contact-note {
    font-size: 13px;
    color: rgba(240,237,232,0.5);
    margin: 4px 0 0;
  }

  @media (max-width: 640px) {
    .sec-card-grid { grid-template-columns: 1fr !important; }
    .sec-contact-box { flex-direction: column; align-items: flex-start; }
  }
`;

function ShieldIcon() {
  return (
    <svg width="22" height="22" fill="none" stroke="#C8A258" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg width="22" height="22" fill="none" stroke="#C8A258" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="22" height="22" fill="none" stroke="#C8A258" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="22" height="22" fill="none" stroke="#C8A258" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1" ry="1"/>
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="22" height="22" fill="none" stroke="#C8A258" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

export default function SecurityPage() {
  return (
    <div className="lp2">
      <style>{STYLES}</style>
      <MarketingNav />

      {/* Hero */}
      <section className="sec-hero">
        <div className="sec-hero-tag">Security &amp; Compliance</div>
        <h1 className="sec-hero-h1">Built for regulated financial<br />institutions in APAC</h1>
        <p className="sec-hero-sub">Axle is designed from the ground up to meet the data security and compliance requirements of institutional fixed income teams.</p>
      </section>

      {/* Data Residency */}
      <section className="sec-section">
        <div className="sec-section-icon"><DatabaseIcon /></div>
        <h2 className="sec-section-h2">Data Residency &amp; Encryption</h2>
        <p className="sec-section-lead">Your data is stored in Google Cloud Firestore — a globally distributed, enterprise-grade database with strong consistency guarantees and independent security certifications.</p>
        <div className="sec-card-grid">
          <div className="sec-card">
            <p className="sec-card-title">Default Region</p>
            <p className="sec-card-body">Data is hosted on Google Cloud infrastructure. APAC clients may request the <strong style={{color:'#F0EDE8'}}>asia-southeast1 (Singapore)</strong> region to satisfy local data residency requirements.</p>
          </div>
          <div className="sec-card">
            <p className="sec-card-title">Encryption at Rest</p>
            <p className="sec-card-body">All data is encrypted at rest using <strong style={{color:'#F0EDE8'}}>AES-256</strong>, managed by Google Cloud's Key Management Service with automatic key rotation.</p>
          </div>
          <div className="sec-card">
            <p className="sec-card-title">Encryption in Transit</p>
            <p className="sec-card-body">All data in transit is protected with <strong style={{color:'#F0EDE8'}}>TLS 1.2+</strong>. Connections to Axle are enforced over HTTPS with HSTS.</p>
          </div>
          <div className="sec-card">
            <p className="sec-card-title">Infrastructure Provider</p>
            <p className="sec-card-body">Google Cloud Platform holds <strong style={{color:'#F0EDE8'}}>ISO 27001, SOC 2 Type II, and PCI DSS</strong> certifications. Documentation available on request.</p>
          </div>
        </div>
      </section>

      {/* Access Control */}
      <section className="sec-section">
        <div className="sec-section-icon"><KeyIcon /></div>
        <h2 className="sec-section-h2">Access Control &amp; Audit Logging</h2>
        <p className="sec-section-lead">Axle enforces strict role-based access at the organisation level. Every action that modifies or exports data is logged for accountability.</p>
        <ul className="sec-list">
          <li>Role-based access control — Admin and Member roles with separately enforced permission boundaries</li>
          <li>Admins can invite, remove, and reassign roles for team members at any time</li>
          <li>Non-admin users cannot delete clients or access team management functions</li>
          <li>Audit trail captures all data exports with timestamp, user identity, and action type</li>
          <li>Organisation data is strictly isolated — no cross-organisation data access is possible</li>
          <li>Firebase Authentication handles all identity verification; passwords are never stored by Axle</li>
        </ul>
      </section>

      {/* Compliance Posture */}
      <section className="sec-section">
        <div className="sec-section-icon"><ShieldIcon /></div>
        <h2 className="sec-section-h2">Regulatory Compliance Posture</h2>
        <p className="sec-section-lead">Axle is designed to support institutional clients operating under the technology risk frameworks of major APAC regulators. Contact us for a detailed compliance mapping document.</p>
        <div className="sec-compliance-row">
          <span className="sec-compliance-tag">MAS</span>
          <p className="sec-compliance-text">
            <strong>Monetary Authority of Singapore</strong> — Data residency in Singapore (asia-southeast1) available on request. Supports MAS Technology Risk Management Guidelines on data protection and access control. Contact us for the full TRM alignment document.
          </p>
        </div>
        <div className="sec-compliance-row">
          <span className="sec-compliance-tag">SFC</span>
          <p className="sec-compliance-text">
            <strong>Securities and Futures Commission (Hong Kong)</strong> — Enterprise compliance package available including data flow diagrams and security controls documentation. Contact us to request.
          </p>
        </div>
        <div className="sec-compliance-row">
          <span className="sec-compliance-tag">ASIC</span>
          <p className="sec-compliance-text">
            <strong>Australian Securities and Investments Commission</strong> — Compliance documentation for Australian financial services firms available on request. Contact us to start the conversation.
          </p>
        </div>
      </section>

      {/* Vendor Due Diligence */}
      <section className="sec-section">
        <div className="sec-section-icon"><ClipboardIcon /></div>
        <h2 className="sec-section-h2">Vendor Due Diligence</h2>
        <p className="sec-section-lead">We actively support vendor due diligence processes for institutional buyers. Our team will respond to your VDD questionnaire with the information required to satisfy your procurement and risk management teams.</p>
        <ul className="sec-list">
          <li>Email your VDD questionnaire to <a href="mailto:info@axle-finance.com" style={{color:'#C8A258'}}>info@axle-finance.com</a></li>
          <li>Typical response time: <strong style={{color:'#F0EDE8'}}>5 business days</strong></li>
          <li>We can provide sub-processor lists, data flow diagrams, and infrastructure architecture documentation</li>
          <li>NDA and information security agreements can be arranged prior to disclosure</li>
        </ul>
      </section>

      {/* Contact */}
      <section className="sec-section">
        <div className="sec-section-icon"><MailIcon /></div>
        <h2 className="sec-section-h2">Security Contact</h2>
        <p className="sec-section-lead">To report a security concern, request a penetration test report, or raise a vulnerability disclosure, contact our security team directly.</p>
        <div className="sec-contact-box">
          <div>
            <p className="sec-contact-label">Security concerns</p>
            <a href="mailto:security@axle-finance.com" className="sec-contact-email">security@axle-finance.com</a>
            <p className="sec-contact-note">For vulnerability disclosures and security inquiries</p>
          </div>
          <div>
            <p className="sec-contact-label">Vendor due diligence</p>
            <a href="mailto:info@axle-finance.com" className="sec-contact-email">info@axle-finance.com</a>
            <p className="sec-contact-note">Send your VDD questionnaire here</p>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
