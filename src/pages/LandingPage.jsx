import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// ─── Styles ────────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes lp-fadeIn { from { opacity:0 } to { opacity:1 } }
  @keyframes lp-fadeUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
  @keyframes lp-float { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-8px) } }

  html { scroll-behavior: smooth; }
  .lp-root { font-family: 'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#0f172a; color:#f8fafc; overflow-x:hidden; }
  .lp-root *, .lp-root *::before, .lp-root *::after { box-sizing:border-box; }
  .lp-root a { color:inherit; }
  .lp-root button { font-family:inherit; }

  .lp-hero-h1 { animation: lp-fadeUp 0.7s ease 0.1s both; }
  .lp-hero-sub { animation: lp-fadeUp 0.7s ease 0.2s both; }
  .lp-hero-cta { animation: lp-fadeUp 0.7s ease 0.3s both; }
  .lp-hero-mock { animation: lp-fadeUp 0.7s ease 0.45s both; }
  .lp-hero-badge { animation: lp-fadeIn 0.6s ease both; }
  .lp-float { animation: lp-float 4s ease-in-out infinite; }

  .lp-btn-primary { background:linear-gradient(135deg,#10b981,#059669); color:white; border:none; cursor:pointer; font-weight:600; font-size:15px; padding:12px 24px; border-radius:10px; text-decoration:none; display:inline-block; transition:transform 0.2s,box-shadow 0.2s,opacity 0.2s; box-shadow:0 4px 20px rgba(16,185,129,0.25); }
  .lp-btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 32px rgba(16,185,129,0.4); }
  .lp-btn-outline { background:transparent; color:#f8fafc; border:1px solid rgba(248,250,252,0.2); cursor:pointer; font-weight:600; font-size:15px; padding:12px 24px; border-radius:10px; text-decoration:none; display:inline-block; transition:border-color 0.2s,background 0.2s; }
  .lp-btn-outline:hover { border-color:rgba(248,250,252,0.4); background:rgba(255,255,255,0.05); }

  .lp-section-badge { display:inline-block; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2); border-radius:100px; padding:6px 16px; margin-bottom:20px; font-size:12px; color:#10b981; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; }
  .lp-section-title { font-size:clamp(28px,4vw,40px); font-weight:800; color:#f8fafc; margin:0 0 16px; letter-spacing:-0.5px; }
  .lp-section-sub { color:#94a3b8; font-size:18px; }

  .lp-card { background:#1e293b; border-radius:16px; border:1px solid #334155; transition:border-color 0.3s,transform 0.3s,box-shadow 0.3s; }
  .lp-card:hover { border-color:rgba(16,185,129,0.35); transform:translateY(-4px); box-shadow:0 16px 48px rgba(0,0,0,0.3); }

  .lp-feature-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
  .lp-steps-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; position:relative; }
  .lp-pricing-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; align-items:start; }
  .lp-testimonials-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
  .lp-footer-grid { display:grid; grid-template-columns:2fr 1fr 1fr 1fr 1fr; gap:40px; }

  .lp-desktop-nav { display:flex !important; }
  .lp-hamburger { display:none !important; }
  .lp-desktop-only { display:block !important; }
  .lp-mobile-menu { display:flex; }

  @media (max-width: 1024px) {
    .lp-footer-grid { grid-template-columns:1fr 1fr 1fr; }
  }
  @media (max-width: 900px) {
    .lp-desktop-nav { display:none !important; }
    .lp-hamburger { display:flex !important; }
    .lp-desktop-only { display:none !important; }
    .lp-feature-grid { grid-template-columns:repeat(2,1fr) !important; }
    .lp-steps-grid { grid-template-columns:1fr !important; }
    .lp-pricing-grid { grid-template-columns:1fr !important; }
    .lp-testimonials-grid { grid-template-columns:1fr !important; }
    .lp-footer-grid { grid-template-columns:1fr 1fr !important; }
  }
  @media (max-width: 600px) {
    .lp-feature-grid { grid-template-columns:1fr !important; }
    .lp-footer-grid { grid-template-columns:1fr !important; }
  }
`;

// ─── Animation Hooks ───────────────────────────────────────────────────────────
function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

function useCountUp(end, started) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!started) return;
    let frame;
    const startTime = performance.now();
    const duration = 1800;
    const tick = (now) => {
      const elapsed = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setVal(Math.round(eased * end));
      if (elapsed < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [end, started]);
  return val;
}

function AnimatedSection({ children, delay = 0, style = {}, className = '' }) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Navbar ────────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const NAV_LINKS = [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'About', href: '#about' },
    { label: 'Contact', href: '#contact' },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 32px', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(15,23,42,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(51,65,85,0.5)' : 'none',
        transition: 'background 0.3s, border-color 0.3s',
      }}
    >
      {/* Logo */}
      <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'linear-gradient(135deg,#10b981,#059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '800', fontSize: '15px', color: 'white',
        }}>B</div>
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#f8fafc', letterSpacing: '-0.3px' }}>BondTracker</span>
      </a>

      {/* Desktop nav links */}
      <div className="lp-desktop-nav" style={{ alignItems: 'center', gap: '32px' }}>
        {NAV_LINKS.map(l => (
          <a key={l.label} href={l.href} style={{ color: '#94a3b8', fontSize: '14px', fontWeight: '500', textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => e.target.style.color = '#f8fafc'}
            onMouseLeave={e => e.target.style.color = '#94a3b8'}
          >{l.label}</a>
        ))}
      </div>

      {/* Desktop CTA */}
      <div className="lp-desktop-nav" style={{ alignItems: 'center', gap: '12px' }}>
        <Link to="/login" style={{ color: '#94a3b8', fontSize: '14px', fontWeight: '500', textDecoration: 'none', padding: '8px 12px', transition: 'color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color = '#f8fafc'}
          onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
        >Login</Link>
        <a href="mailto:sales@bondtracker.com" className="lp-btn-primary" style={{ fontSize: '14px', padding: '9px 20px' }}>
          Request Demo
        </a>
      </div>

      {/* Hamburger */}
      <button
        className="lp-hamburger"
        onClick={() => setMenuOpen(o => !o)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: '#f8fafc', alignItems: 'center' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {menuOpen
            ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
            : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
        </svg>
      </button>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          position: 'absolute', top: '64px', left: 0, right: 0,
          background: '#1e293b', borderBottom: '1px solid #334155',
          padding: '16px 24px', flexDirection: 'column', gap: '4px',
        }} className="lp-mobile-menu" role="menu">
          {NAV_LINKS.map(l => (
            <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)} role="menuitem"
              style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '16px', padding: '10px 0', display: 'block', borderBottom: '1px solid rgba(51,65,85,0.4)' }}>
              {l.label}
            </a>
          ))}
          <div style={{ paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Link to="/login" onClick={() => setMenuOpen(false)} style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '15px', padding: '10px 0' }}>Login</Link>
            <a href="mailto:sales@bondtracker.com" className="lp-btn-primary" style={{ textAlign: 'center', padding: '12px' }}>Request Demo</a>
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
function DashboardPreview() {
  const STATUS_COLORS = { EXECUTED: '#10b981', QUOTED: '#3b82f6', ENQUIRY: '#f59e0b', PASSED: '#ef4444' };
  const STATUS_BG = { EXECUTED: 'rgba(16,185,129,0.1)', QUOTED: 'rgba(59,130,246,0.1)', ENQUIRY: 'rgba(251,191,36,0.1)', PASSED: 'rgba(239,68,68,0.1)' };

  const rows = [
    { client: 'BlackRock', bond: 'AAPL 4.5% 2034', dir: 'BUY', status: 'EXECUTED', val: '$25M' },
    { client: 'Fidelity', bond: 'JPM 5.0% 2031', dir: 'SELL', status: 'QUOTED', val: '$50M' },
    { client: 'Vanguard', bond: 'T 4.25% 2053', dir: 'TWO-WAY', status: 'ENQUIRY', val: '$100M' },
  ];

  return (
    <div style={{
      background: '#1e293b', borderRadius: '16px', border: '1px solid #334155',
      boxShadow: '0 40px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.08)',
      overflow: 'hidden', maxWidth: '860px', margin: '0 auto', textAlign: 'left',
    }}>
      {/* Window chrome */}
      <div style={{ background: '#0f172a', padding: '12px 16px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '7px' }}>
        <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
        <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
        <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
        <div style={{ marginLeft: '12px', height: '20px', background: '#1e293b', borderRadius: '4px', width: '160px' }} />
        <div style={{ marginLeft: 'auto', height: '20px', background: '#1e293b', borderRadius: '4px', width: '80px' }} />
      </div>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', padding: '16px 16px 0' }}>
        {[
          { label: 'Total Activities', value: '1,247', change: '+12.3%', color: '#10b981' },
          { label: 'Volume Tracked', value: '$4.2B', change: '+8.1%', color: '#3b82f6' },
          { label: 'Conversion Rate', value: '34.2%', change: '+2.4%', color: '#a855f7' },
          { label: 'Active Clients', value: '284', change: '+5.7%', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{ background: '#0f172a', borderRadius: '10px', padding: '12px 14px', border: '1px solid #334155' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '5px' }}>{s.label}</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: s.color, marginTop: '3px' }}>{s.change}</div>
          </div>
        ))}
      </div>
      {/* Table */}
      <div style={{ padding: '12px 16px 16px' }}>
        <div style={{ background: '#0f172a', borderRadius: '10px', border: '1px solid #334155', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #334155', fontSize: '11px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recent Activities
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 2fr 80px 100px 80px',
              padding: '10px 14px', borderBottom: i < rows.length - 1 ? '1px solid #1e293b' : 'none',
              fontSize: '12px', alignItems: 'center',
            }}>
              <span style={{ color: '#94a3b8' }}>{r.client}</span>
              <span style={{ color: '#f8fafc' }}>{r.bond}</span>
              <span style={{ color: r.dir === 'BUY' ? '#10b981' : r.dir === 'SELL' ? '#ef4444' : '#f59e0b', fontWeight: '700', fontSize: '11px' }}>{r.dir}</span>
              <span><span style={{ background: STATUS_BG[r.status], color: STATUS_COLORS[r.status], padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>{r.status}</span></span>
              <span style={{ color: '#64748b', textAlign: 'right', fontWeight: '600' }}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '120px 24px 80px', position: 'relative', overflow: 'hidden', textAlign: 'center',
    }}>
      {/* Gradient backdrop */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(16,185,129,0.13) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 85% 85%, rgba(5,150,105,0.07) 0%, transparent 50%)',
      }} />
      {/* Grid pattern */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '880px', margin: '0 auto' }}>
        {/* Badge */}
        <div className="lp-hero-badge" style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: '100px', padding: '6px 18px', marginBottom: '32px',
          fontSize: '13px', color: '#10b981', fontWeight: '500',
        }}>
          <span style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%' }} />
          Built for institutional bond sales desks
        </div>

        {/* H1 */}
        <h1 className="lp-hero-h1" style={{
          fontSize: 'clamp(38px,6vw,58px)', fontWeight: '800',
          letterSpacing: '-1.5px', lineHeight: '1.08', color: '#f8fafc', margin: '0 0 24px',
        }}>
          Bond Sales Intelligence<br />
          <span style={{ background: 'linear-gradient(135deg,#10b981,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            for Modern Desks
          </span>
        </h1>

        {/* Subhead */}
        <p className="lp-hero-sub" style={{
          fontSize: '18px', color: '#94a3b8', lineHeight: '1.75',
          maxWidth: '620px', margin: '0 auto 40px',
        }}>
          Replace spreadsheets and email chains. Track activities, manage pipelines,
          analyze performance — all in one platform built by bond market professionals.
        </p>

        {/* CTAs */}
        <div className="lp-hero-cta" style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="mailto:sales@bondtracker.com" className="lp-btn-primary" style={{ fontSize: '16px', padding: '14px 32px', boxShadow: '0 6px 28px rgba(16,185,129,0.3)' }}>
            Request Demo
          </a>
          <a href="#features" className="lp-btn-outline" style={{ fontSize: '16px', padding: '14px 28px' }}>
            See Features
          </a>
        </div>

        {/* Dashboard preview */}
        <div className="lp-hero-mock" style={{ marginTop: '64px' }}>
          <DashboardPreview />
        </div>

        {/* Trust text */}
        <p style={{ marginTop: '40px', color: '#475569', fontSize: '13px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Trusted by sales desks at leading financial institutions
        </p>
      </div>
    </section>
  );
}

// ─── Stats Bar ─────────────────────────────────────────────────────────────────
function StatItem({ prefix, end, suffix, label, index, inView }) {
  const val = useCountUp(end, inView);
  return (
    <div style={{
      opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(20px)',
      transition: `opacity 0.6s ease ${index * 100}ms, transform 0.6s ease ${index * 100}ms`,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: '42px', fontWeight: '800', letterSpacing: '-1.5px', lineHeight: '1',
        background: 'linear-gradient(135deg,#10b981,#34d399)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        {prefix}{val}{suffix}
      </div>
      <div style={{ color: '#64748b', fontSize: '14px', marginTop: '8px', fontWeight: '500' }}>{label}</div>
    </div>
  );
}

function StatBar() {
  const [ref, inView] = useInView(0.3);
  const stats = [
    { prefix: '', end: 500, suffix: '+', label: 'Activities Tracked Daily' },
    { prefix: '', end: 50, suffix: '+', label: 'Institutions' },
    { prefix: '', end: 3, suffix: '', label: 'Regions Covered' },
    { prefix: '$', end: 10, suffix: 'B+', label: 'Volume Tracked' },
  ];

  return (
    <div ref={ref} style={{
      background: 'linear-gradient(135deg,#1e293b,#0f172a)',
      borderTop: '1px solid #334155', borderBottom: '1px solid #334155',
      padding: '56px 24px',
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '24px' }}>
        {stats.map((s, i) => <StatItem key={s.label} {...s} index={i} inView={inView} />)}
      </div>
    </div>
  );
}

// ─── Features ──────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: '📊', title: 'Activity Tracker', highlight: '5 status types', desc: 'Log every client interaction in seconds. Track enquiries, quotes, executions, and passes with full audit trails. Auto-fill bond details via Bloomberg lookup.' },
  { icon: '🚀', title: 'New Issues Pipeline', highlight: 'Live deal tracking', desc: 'Track live deals from announcement to pricing. Manage bookrunner assignments, target sizes, and currencies. Never miss a mandate again.' },
  { icon: '📋', title: 'Order Book Management', highlight: 'Linked to pipeline', desc: 'Centralized order collection linked to your pipeline. Track client orders, limits, and allocations across your entire book.' },
  { icon: '📈', title: 'Analytics Dashboard', highlight: 'PDF & Excel export', desc: 'Real-time KPIs: conversion rates, volume breakdowns, top clients, currency splits, and regional analysis. Export to PDF and Excel instantly.' },
  { icon: '👥', title: 'Client CRM', highlight: 'Full coverage model', desc: 'Manage your full client universe — funds, banks, insurance, pensions, sovereigns. Track by region, assign sales coverage, and link to all activities.' },
  { icon: '🤖', title: 'AI-Powered Insights', highlight: 'Transcript analysis', desc: 'Upload call transcripts and let AI extract actionable trade interests automatically. Bloomberg auto-fill for ISIN and ticker cross-referencing.' },
];

function Features() {
  return (
    <section id="features" style={{ padding: '100px 24px', background: '#0f172a' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <AnimatedSection style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div className="lp-section-badge">Features</div>
          <h2 className="lp-section-title">Everything Your Desk Needs</h2>
          <p className="lp-section-sub">A complete platform built by the market, for the market</p>
        </AnimatedSection>

        <div className="lp-feature-grid">
          {FEATURES.map((f, i) => (
            <AnimatedSection key={f.title} delay={i * 70}>
              <div className="lp-card" style={{ padding: '28px', height: '100%', cursor: 'default' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: 'rgba(16,185,129,0.1)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', marginBottom: '20px',
                }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#f8fafc', margin: '0 0 10px' }}>{f.title}</h3>
                <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.75', margin: '0 0 18px' }}>{f.desc}</p>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: 'rgba(16,185,129,0.08)', borderRadius: '6px',
                  padding: '4px 10px', fontSize: '12px', color: '#10b981', fontWeight: '600',
                }}>
                  <span style={{ width: '5px', height: '5px', background: '#10b981', borderRadius: '50%' }} />
                  {f.highlight}
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ──────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { num: '01', icon: '🏢', title: 'Create Your Organization', desc: "Sign up and set up your desk in under 2 minutes. Name your org, set your region, and you're live — no IT required." },
    { num: '02', icon: '👥', title: 'Invite Your Team', desc: 'Add team members with role-based access controls. Admins manage settings; users log activities and track deals in real time.' },
    { num: '03', icon: '📊', title: 'Start Tracking', desc: 'Log your first activity and watch insights build automatically. Dashboards, rankings, and analytics populate as data flows in.' },
  ];

  return (
    <section style={{ padding: '100px 24px', background: '#0a1628' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <AnimatedSection style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div className="lp-section-badge">How It Works</div>
          <h2 className="lp-section-title">Get Started in Minutes</h2>
          <p className="lp-section-sub">No complex setup. No lengthy onboarding. Just powerful tools, immediately.</p>
        </AnimatedSection>

        <div className="lp-steps-grid">
          {/* Connecting line (desktop only) */}
          <div className="lp-desktop-only" style={{
            position: 'absolute', top: '72px',
            left: 'calc(33.33% - 8px)', right: 'calc(33.33% - 8px)',
            height: '2px',
            background: 'linear-gradient(90deg, rgba(16,185,129,0.6), rgba(5,150,105,0.6))',
            zIndex: 0,
          }} />

          {steps.map((s, i) => (
            <AnimatedSection key={s.num} delay={i * 120} style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                background: '#1e293b', borderRadius: '16px', padding: '32px 28px',
                border: '1px solid #334155', textAlign: 'center',
              }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: 'linear-gradient(135deg,#10b981,#059669)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: '800', color: 'white',
                  margin: '0 auto 20px', letterSpacing: '-0.3px',
                }}>
                  {s.num}
                </div>
                <div style={{ fontSize: '36px', marginBottom: '16px' }}>{s.icon}</div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#f8fafc', margin: '0 0 12px' }}>{s.title}</h3>
                <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.75', margin: 0 }}>{s.desc}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Demo Section (tabbed dashboard) ──────────────────────────────────────────
function ActivityTab() {
  const STATUS_COLORS = { EXECUTED: '#10b981', QUOTED: '#3b82f6', ENQUIRY: '#f59e0b', PASSED: '#ef4444' };
  const STATUS_BG = { EXECUTED: 'rgba(16,185,129,0.1)', QUOTED: 'rgba(59,130,246,0.1)', ENQUIRY: 'rgba(251,191,36,0.1)', PASSED: 'rgba(239,68,68,0.1)' };
  const rows = [
    { time: '09:14', client: 'BlackRock', bond: 'AAPL 4.5% 2034', dir: 'BUY', status: 'EXECUTED', val: '$25M' },
    { time: '09:42', client: 'Fidelity Intl', bond: 'JPM 5.0% 2031', dir: 'SELL', status: 'QUOTED', val: '$50M' },
    { time: '10:05', client: 'Vanguard', bond: 'T 4.25% 2053', dir: 'TWO-WAY', status: 'ENQUIRY', val: '$100M' },
    { time: '10:31', client: 'PIMCO', bond: 'GS 4.75% 2033', dir: 'BUY', status: 'PASSED', val: '$30M' },
    { time: '11:02', client: 'Abrdn', bond: 'MS 5.25% 2035', dir: 'SELL', status: 'EXECUTED', val: '$15M' },
  ];
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#f8fafc' }}>Activity Log — Today</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ background: '#0f172a', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', color: '#94a3b8', border: '1px solid #334155' }}>Filter</div>
          <div style={{ background: 'linear-gradient(135deg,#10b981,#059669)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', color: 'white', fontWeight: '600' }}>+ New</div>
        </div>
      </div>
      <div style={{ background: '#0f172a', borderRadius: '10px', overflow: 'hidden', border: '1px solid #334155' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 2fr 80px 100px 70px', padding: '10px 14px', borderBottom: '1px solid #334155', fontSize: '11px', color: '#475569', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <span>Time</span><span>Client</span><span>Bond</span><span>Dir</span><span>Status</span><span style={{ textAlign: 'right' }}>Vol</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '64px 1fr 2fr 80px 100px 70px',
            padding: '11px 14px', borderBottom: i < rows.length - 1 ? '1px solid #1e293b' : 'none',
            fontSize: '12px', alignItems: 'center',
          }}>
            <span style={{ color: '#475569' }}>{r.time}</span>
            <span style={{ color: '#94a3b8' }}>{r.client}</span>
            <span style={{ color: '#f8fafc' }}>{r.bond}</span>
            <span style={{ color: r.dir === 'BUY' ? '#10b981' : r.dir === 'SELL' ? '#ef4444' : '#f59e0b', fontWeight: '700', fontSize: '11px' }}>{r.dir}</span>
            <span><span style={{ background: STATUS_BG[r.status], color: STATUS_COLORS[r.status], padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>{r.status}</span></span>
            <span style={{ color: '#94a3b8', textAlign: 'right' }}>{r.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineTab() {
  const deals = [
    { issuer: 'Apple Inc.', tenor: '10yr', size: '$2B', currency: 'USD', status: 'LIVE', books: 'GS, JPM, MS' },
    { issuer: 'Volkswagen AG', tenor: '5yr', size: '€1.5B', currency: 'EUR', status: 'PRICED', books: 'DB, BNP, SG' },
    { issuer: 'Kingdom of Saudi Arabia', tenor: '30yr', size: '$3B', currency: 'USD', status: 'MANDATE', books: 'HSBC, Citi, JPM' },
  ];
  const STATUS = { LIVE: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' }, PRICED: { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa' }, MANDATE: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24' } };
  return (
    <div style={{ padding: '20px' }}>
      <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '600', color: '#f8fafc' }}>New Issues Pipeline</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {deals.map((d, i) => (
          <div key={i} style={{ background: '#0f172a', borderRadius: '10px', padding: '16px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: '600', color: '#f8fafc', marginBottom: '4px' }}>{d.issuer}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>{d.tenor} · {d.size} · {d.currency} · Bookrunners: {d.books}</div>
            </div>
            <span style={{ background: STATUS[d.status].bg, color: STATUS[d.status].color, padding: '4px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>{d.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsTab() {
  const bars = [
    { label: 'Jan', h: 62 }, { label: 'Feb', h: 80 }, { label: 'Mar', h: 54 },
    { label: 'Apr', h: 90 }, { label: 'May', h: 70 }, { label: 'Jun', h: 85 },
  ];
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Conversion Rate', value: '34.2%', sub: '+2.4% vs last month', color: '#10b981' },
          { label: 'Avg Ticket Size', value: '$42M', sub: 'across 1,247 activities', color: '#3b82f6' },
          { label: 'Top Currency', value: 'USD', sub: '67% of total volume', color: '#a855f7' },
        ].map(k => (
          <div key={k.label} style={{ background: '#0f172a', borderRadius: '10px', padding: '16px', border: '1px solid #334155' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '5px' }}>{k.label}</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: k.color, marginBottom: '3px' }}>{k.value}</div>
            <div style={{ fontSize: '11px', color: '#475569' }}>{k.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#0f172a', borderRadius: '10px', padding: '16px', border: '1px solid #334155' }}>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px', fontWeight: '600' }}>Monthly Volume (USD)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '80px' }}>
          {bars.map(b => (
            <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', height: `${b.h}%`, background: 'linear-gradient(180deg,#10b981,#059669)', borderRadius: '4px 4px 0 0' }} />
              <span style={{ fontSize: '10px', color: '#475569' }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DemoSection() {
  const [activeTab, setActiveTab] = useState('activity');
  const tabs = [
    { id: 'activity', label: 'Activity Log' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'analytics', label: 'Analytics' },
  ];
  return (
    <section id="demo" style={{ padding: '100px 24px', background: '#0f172a' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <AnimatedSection style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div className="lp-section-badge">Product</div>
          <h2 className="lp-section-title">See It In Action</h2>
          <p className="lp-section-sub">A single platform for your entire bond sales operation</p>
        </AnimatedSection>

        <AnimatedSection delay={100}>
          <div style={{ display: 'flex', gap: '4px', background: '#1e293b', borderRadius: '12px', padding: '4px', width: 'fit-content', margin: '0 auto 28px', border: '1px solid #334155' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: '8px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: '500',
                background: activeTab === t.id ? 'linear-gradient(135deg,#10b981,#059669)' : 'transparent',
                color: activeTab === t.id ? 'white' : '#64748b',
                transition: 'all 0.2s',
              }}>{t.label}</button>
            ))}
          </div>
        </AnimatedSection>

        <AnimatedSection delay={180}>
          <div style={{ background: '#1e293b', borderRadius: '16px', border: '1px solid #334155', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            <div style={{ background: '#0f172a', padding: '12px 16px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
              <span style={{ marginLeft: '8px', fontSize: '12px', color: '#475569' }}>bondnie.netlify.app</span>
            </div>
            {activeTab === 'activity' && <ActivityTab />}
            {activeTab === 'pipeline' && <PipelineTab />}
            {activeTab === 'analytics' && <AnalyticsTab />}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

// ─── Pricing ───────────────────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: '2px' }}>
      <path d="M3 7.5l3 3 6-6" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PLANS = [
  {
    name: 'Starter', monthly: 49, desc: 'For small desks getting started', popular: false,
    cta: 'Start Free Trial', ctaHref: '/signup',
    features: ['Up to 5 users', 'Activity tracking', 'Client CRM', 'Basic analytics', '50 Bloomberg lookups/month', 'Email support'],
  },
  {
    name: 'Professional', monthly: 99, desc: 'For growing sales operations', popular: true,
    cta: 'Start Free Trial', ctaHref: '/signup',
    features: ['Up to 25 users', 'Everything in Starter', 'New Issues Pipeline', 'Order Book Management', 'AI Transcript Analysis', 'Full analytics + PDF/Excel export', '500 Bloomberg lookups/month', 'Priority support'],
  },
  {
    name: 'Enterprise', monthly: null, desc: 'For large institutions', popular: false,
    cta: 'Contact Sales', ctaHref: 'mailto:sales@bondtracker.com',
    features: ['Unlimited users', 'Everything in Professional', 'SSO / SAML integration', 'Custom API access', 'Dedicated account manager', 'Custom data retention', 'Unlimited Bloomberg lookups', 'SLA guarantee'],
  },
];

function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" style={{ padding: '100px 24px', background: '#0a1628' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <AnimatedSection style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div className="lp-section-badge">Pricing</div>
          <h2 className="lp-section-title">Simple, Transparent Pricing</h2>
          <p className="lp-section-sub" style={{ marginBottom: '32px' }}>Start free, scale as you grow</p>

          {/* Billing toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', color: annual ? '#64748b' : '#f8fafc', fontWeight: '500', transition: 'color 0.2s' }}>Monthly</span>
            <button
              onClick={() => setAnnual(a => !a)}
              aria-label="Toggle annual pricing"
              role="switch"
              aria-checked={annual}
              style={{
                width: '48px', height: '26px', borderRadius: '100px', border: 'none', cursor: 'pointer',
                background: annual ? 'linear-gradient(135deg,#10b981,#059669)' : '#334155',
                position: 'relative', transition: 'background 0.3s',
              }}
            >
              <span style={{
                position: 'absolute', top: '3px', left: annual ? '25px' : '3px',
                width: '20px', height: '20px', borderRadius: '50%', background: 'white',
                transition: 'left 0.3s', display: 'block',
              }} />
            </button>
            <span style={{ fontSize: '14px', color: annual ? '#f8fafc' : '#64748b', fontWeight: '500', transition: 'color 0.2s' }}>
              Annual <span style={{ color: '#10b981', fontSize: '12px', fontWeight: '700' }}>Save 20%</span>
            </span>
          </div>
        </AnimatedSection>

        <div className="lp-pricing-grid">
          {PLANS.map((plan, i) => (
            <AnimatedSection key={plan.name} delay={i * 90}>
              <div style={{
                background: plan.popular ? 'linear-gradient(180deg,#142a22 0%,#1e293b 100%)' : '#1e293b',
                borderRadius: '20px', padding: '32px',
                border: plan.popular ? '2px solid rgba(16,185,129,0.45)' : '1px solid #334155',
                position: 'relative',
                boxShadow: plan.popular ? '0 0 60px rgba(16,185,129,0.08)' : 'none',
              }}>
                {plan.popular && (
                  <div style={{
                    position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg,#10b981,#059669)',
                    color: 'white', fontSize: '12px', fontWeight: '700',
                    padding: '5px 18px', borderRadius: '100px', whiteSpace: 'nowrap',
                  }}>Most Popular</div>
                )}

                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#f8fafc', margin: '0 0 4px' }}>{plan.name}</h3>
                <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px' }}>{plan.desc}</p>

                {plan.monthly ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: '600' }}>$</span>
                    <span style={{ fontSize: '44px', fontWeight: '800', color: '#f8fafc', letterSpacing: '-2px', lineHeight: '1' }}>
                      {annual ? Math.round(plan.monthly * 0.8) : plan.monthly}
                    </span>
                    <span style={{ fontSize: '14px', color: '#64748b' }}>/user/mo</span>
                  </div>
                ) : (
                  <div style={{ fontSize: '36px', fontWeight: '800', color: '#f8fafc', letterSpacing: '-1px', marginBottom: '4px' }}>Custom</div>
                )}
                {annual && plan.monthly && (
                  <div style={{ fontSize: '12px', color: '#10b981', marginBottom: '20px' }}>
                    You save ${Math.round(plan.monthly * plan.monthly * 0.2 * 12 / plan.monthly)}/user/year
                  </div>
                )}

                <div style={{ marginBottom: '24px', marginTop: plan.monthly ? '20px' : '20px' }}>
                  {plan.ctaHref.startsWith('/') ? (
                    <Link to={plan.ctaHref} style={{
                      display: 'block', textAlign: 'center', textDecoration: 'none',
                      padding: '13px 24px', borderRadius: '10px', fontWeight: '600', fontSize: '15px',
                      background: plan.popular ? 'linear-gradient(135deg,#10b981,#059669)' : 'transparent',
                      color: plan.popular ? 'white' : '#10b981',
                      border: plan.popular ? 'none' : '1px solid rgba(16,185,129,0.4)',
                      boxShadow: plan.popular ? '0 4px 18px rgba(16,185,129,0.25)' : 'none',
                      transition: 'opacity 0.2s, transform 0.2s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >{plan.cta}</Link>
                  ) : (
                    <a href={plan.ctaHref} style={{
                      display: 'block', textAlign: 'center', textDecoration: 'none',
                      padding: '13px 24px', borderRadius: '10px', fontWeight: '600', fontSize: '15px',
                      background: 'transparent', color: '#10b981',
                      border: '1px solid rgba(16,185,129,0.4)',
                      transition: 'opacity 0.2s, transform 0.2s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >{plan.cta}</a>
                  )}
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: '#94a3b8' }}>
                      <CheckIcon />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ──────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: "BondTracker has completely transformed how our desk operates. We used to rely on shared spreadsheets — now we have real-time visibility across the entire team. Our execution rate improved 15% within the first quarter.",
    name: "Sarah Chen", role: "Head of Asia Credit Sales", company: "Global Investment Bank", stars: 5,
  },
  {
    quote: "The pipeline tracking alone is worth it. We never miss a new issue anymore. The integration between the order book and pipeline means our whole syndication process is tracked in one place.",
    name: "James Hartley", role: "Director, Fixed Income", company: "European Asset Manager", stars: 5,
  },
  {
    quote: "Setup took less than a day. The Bloomberg auto-fill is a game-changer — half our manual data entry is gone. The analytics dashboards have made our weekly desk meetings 10x more productive.",
    name: "Priya Nair", role: "VP, Bond Sales", company: "Regional Securities Firm", stars: 5,
  },
];

function Testimonials() {
  return (
    <section id="about" style={{ padding: '100px 24px', background: '#0f172a' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <AnimatedSection style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div className="lp-section-badge">Testimonials</div>
          <h2 className="lp-section-title">Built for Bond Professionals</h2>
          <p className="lp-section-sub">Hear from the desks that run on BondTracker</p>
        </AnimatedSection>

        <div className="lp-testimonials-grid">
          {TESTIMONIALS.map((t, i) => (
            <AnimatedSection key={t.name} delay={i * 90}>
              <div style={{
                background: '#1e293b', borderRadius: '16px', padding: '28px',
                border: '1px solid #334155', height: '100%',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ display: 'flex', gap: '3px', marginBottom: '18px' }}>
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <span key={j} style={{ color: '#f59e0b', fontSize: '16px' }}>★</span>
                  ))}
                </div>
                <p style={{ color: '#94a3b8', fontSize: '15px', lineHeight: '1.75', flex: 1, margin: '0 0 24px', fontStyle: 'italic' }}>
                  "{t.quote}"
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: 'linear-gradient(135deg,#10b981,#059669)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', fontWeight: '700', color: 'white', flexShrink: 0,
                  }}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', color: '#f8fafc', fontSize: '14px' }}>{t.name}</div>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>{t.role}, {t.company}</div>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Section ───────────────────────────────────────────────────────────────
function CTASection() {
  return (
    <section id="contact" style={{
      padding: '100px 24px', position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg,#0a2a1e 0%,#0f172a 50%,#0a1628 100%)',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 80% at 50% 50%,rgba(16,185,129,0.07) 0%,transparent 70%)',
      }} />
      <div style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <AnimatedSection>
          <h2 style={{ fontSize: 'clamp(30px,5vw,46px)', fontWeight: '800', color: '#f8fafc', margin: '0 0 20px', letterSpacing: '-1px', lineHeight: '1.1' }}>
            Ready to Transform<br />Your Bond Desk?
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '18px', marginBottom: '40px', lineHeight: '1.7' }}>
            Join the next generation of bond sales intelligence. Start your free trial today.
          </p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
            <Link to="/signup" className="lp-btn-primary" style={{ fontSize: '16px', padding: '16px 36px', boxShadow: '0 8px 32px rgba(16,185,129,0.35)' }}>
              Get Started Free
            </Link>
            <a href="mailto:sales@bondtracker.com" className="lp-btn-outline" style={{ fontSize: '16px', padding: '16px 28px' }}>
              Schedule a Demo
            </a>
          </div>
          <p style={{ color: '#475569', fontSize: '13px' }}>
            No credit card required &nbsp;·&nbsp; Setup in under 2 minutes &nbsp;·&nbsp; Cancel anytime
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────────
const FOOTER_COLS = [
  { title: 'Product', links: ['Features', 'Pricing', 'Integrations', 'API Docs', 'Changelog'] },
  { title: 'Company', links: ['About', 'Team', 'Careers', 'Press', 'Contact'] },
  { title: 'Resources', links: ['Documentation', 'Blog', 'Help Center', 'Status'] },
  { title: 'Legal', links: ['Privacy Policy', 'Terms of Service', 'Security', 'Compliance'] },
];

function Footer() {
  return (
    <footer style={{ background: '#030712', borderTop: '1px solid #1e293b', padding: '64px 24px 32px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div className="lp-footer-grid" style={{ marginBottom: '48px' }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '16px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'linear-gradient(135deg,#10b981,#059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '800', fontSize: '15px', color: 'white',
              }}>B</div>
              <span style={{ fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>BondTracker</span>
            </div>
            <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.7', maxWidth: '220px', margin: '0 0 20px' }}>
              Enterprise bond sales intelligence for modern fixed income desks.
            </p>
            {/* Social icons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              {[
                { label: 'LinkedIn', path: 'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zm2-5a2 2 0 100 4 2 2 0 000-4z' },
                { label: 'X / Twitter', path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
              ].map(s => (
                <a key={s.label} href="#" aria-label={s.label} style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: '#1e293b', border: '1px solid #334155',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#64748b', textDecoration: 'none', transition: 'color 0.2s, border-color 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#f8fafc'; e.currentTarget.style.borderColor = '#475569'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#334155'; }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d={s.path} /></svg>
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map(col => (
            <div key={col.title}>
              <h4 style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 16px' }}>
                {col.title}
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {col.links.map(link => (
                  <li key={link}>
                    <a href="#" style={{ color: '#475569', fontSize: '14px', textDecoration: 'none', transition: 'color 0.2s' }}
                      onMouseEnter={e => e.target.style.color = '#94a3b8'}
                      onMouseLeave={e => e.target.style.color = '#475569'}
                    >{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ color: '#334155', fontSize: '13px', margin: 0 }}>© 2025 BondTracker. All rights reserved.</p>
          <p style={{ color: '#334155', fontSize: '13px', margin: 0 }}>Built for bond market professionals worldwide.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Root Component ────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <>
      <style>{STYLES}</style>
      <div className="lp-root">
        <Navbar />
        <Hero />
        <StatBar />
        <Features />
        <HowItWorks />
        <DemoSection />
        <Pricing />
        <Testimonials />
        <CTASection />
        <Footer />
      </div>
    </>
  );
}
