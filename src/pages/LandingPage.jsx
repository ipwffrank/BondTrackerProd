import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import MarketingNav from '../components/marketing/MarketingNav';
import MarketingFooter from '../components/marketing/MarketingFooter';

// ─── Styles ─────────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes lp-fadeUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
  @keyframes lp-orbPulse { 0%,100% { opacity:0.12; transform:scale(1); } 50% { opacity:0.2; transform:scale(1.08); } }

  html { scroll-behavior: smooth; }
  .lp2 { font-family: 'Outfit', -apple-system, sans-serif; background: #0F2137; color: #F0EDE8; overflow-x: hidden; }
  .lp2 *, .lp2 *::before, .lp2 *::after { box-sizing: border-box; }
  .lp2 a { color: inherit; }
  .lp2 button { font-family: inherit; }

  .lp2-hero-h1 { animation: lp-fadeUp 0.7s ease 0.1s both; }
  .lp2-hero-sub { animation: lp-fadeUp 0.7s ease 0.25s both; }
  .lp2-hero-cta { animation: lp-fadeUp 0.7s ease 0.4s both; }

  /* Gold primary button */
  .lp2-btn-gold {
    background: #C8A258; color: #0F2137; border: none; cursor: pointer;
    font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 15px;
    padding: 13px 28px; border-radius: 6px; text-decoration: none;
    display: inline-block; transition: background 0.2s, transform 0.15s;
    letter-spacing: 0.01em;
  }
  .lp2-btn-gold:hover { background: #D4B06A; transform: translateY(-1px); }

  /* Ghost / outline button */
  .lp2-btn-ghost {
    background: transparent; color: rgba(240,237,232,0.8); border: 1px solid rgba(240,237,232,0.2);
    cursor: pointer; font-family: 'Outfit', sans-serif; font-weight: 500; font-size: 15px;
    padding: 13px 28px; border-radius: 6px; text-decoration: none;
    display: inline-block; transition: border-color 0.2s, color 0.2s, background 0.2s;
  }
  .lp2-btn-ghost:hover { border-color: rgba(200,162,88,0.4); color: #C8A258; background: rgba(200,162,88,0.06); }

  /* Feature card */
  .lp2-feat-card {
    background: #FFFFFF; border-radius: 12px; padding: 32px 28px;
    border: 1px solid #E4E0DA;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    transition: transform 0.25s, box-shadow 0.25s;
  }
  .lp2-feat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.08); }

  /* Grids */
  .lp2-feat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
  .lp2-steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 48px; position: relative; }
  .lp2-badge-grid { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
  .lp2-problem-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: start; }
  .lp2-testimonial-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .lp2-contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: start; }

  /* Contact form */
  .lp2-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .lp2-form-group { margin-bottom: 16px; }
  .lp2-form-label { display: block; font-size: 13px; font-weight: 600; color: #8A8680; margin-bottom: 6px; letter-spacing: 0.02em; }
  .lp2-form-input {
    width: 100%; padding: 10px 14px; background: #F4F2ED; border: 1px solid #E4E0DA;
    border-radius: 6px; color: #0C1017; font-size: 14px; font-family: 'Outfit', sans-serif;
    transition: border-color 0.2s; outline: none;
  }
  .lp2-form-input:focus { border-color: #C8A258; background: #FFFFFF; }
  .lp2-form-input::placeholder { color: #C0BDB8; }
  .lp2-form-select {
    width: 100%; padding: 10px 14px; background: #F4F2ED; border: 1px solid #E4E0DA;
    border-radius: 6px; color: #0C1017; font-size: 14px; font-family: 'Outfit', sans-serif;
    transition: border-color 0.2s; outline: none; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8680' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px;
  }
  .lp2-form-select:focus { border-color: #C8A258; background-color: #FFFFFF; }
  .lp2-phone-row { display: grid; grid-template-columns: 180px 1fr; gap: 12px; }

  @media (max-width: 900px) {
    .lp2-feat-grid { grid-template-columns: 1fr 1fr !important; }
    .lp2-steps-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
    .lp2-steps-line { display: none !important; }
    .lp2-problem-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
    .lp2-testimonial-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
    .lp2-contact-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
  }
  @media (max-width: 600px) {
    .lp2-feat-grid { grid-template-columns: 1fr !important; }
    .lp2-form-row { grid-template-columns: 1fr !important; }
    .lp2-phone-row { grid-template-columns: 1fr !important; }
  }
`;

// ─── Data ────────────────────────────────────────────────────────────────────────
const COUNTRIES = [
  { name: 'Singapore', code: '+65' }, { name: 'Hong Kong', code: '+852' },
  { name: 'Australia', code: '+61' }, { name: 'Japan', code: '+81' },
  { name: 'South Korea', code: '+82' }, { name: 'China', code: '+86' },
  { name: 'India', code: '+91' }, { name: 'Indonesia', code: '+62' },
  { name: 'Malaysia', code: '+60' }, { name: 'Philippines', code: '+63' },
  { name: 'Thailand', code: '+66' }, { name: 'Vietnam', code: '+84' },
  { name: 'Taiwan', code: '+886' }, { name: 'United Kingdom', code: '+44' },
  { name: 'United States', code: '+1' }, { name: 'Canada', code: '+1' },
  { name: 'Germany', code: '+49' }, { name: 'France', code: '+33' },
  { name: 'UAE', code: '+971' }, { name: 'Saudi Arabia', code: '+966' },
  { name: 'Afghanistan', code: '+93' }, { name: 'Albania', code: '+355' },
  { name: 'Algeria', code: '+213' }, { name: 'Argentina', code: '+54' },
  { name: 'Armenia', code: '+374' }, { name: 'Austria', code: '+43' },
  { name: 'Azerbaijan', code: '+994' }, { name: 'Bahrain', code: '+973' },
  { name: 'Bangladesh', code: '+880' }, { name: 'Belgium', code: '+32' },
  { name: 'Brazil', code: '+55' }, { name: 'Bulgaria', code: '+359' },
  { name: 'Cambodia', code: '+855' }, { name: 'Chile', code: '+56' },
  { name: 'Colombia', code: '+57' }, { name: 'Croatia', code: '+385' },
  { name: 'Czech Republic', code: '+420' }, { name: 'Denmark', code: '+45' },
  { name: 'Egypt', code: '+20' }, { name: 'Estonia', code: '+372' },
  { name: 'Finland', code: '+358' }, { name: 'Georgia', code: '+995' },
  { name: 'Ghana', code: '+233' }, { name: 'Greece', code: '+30' },
  { name: 'Hungary', code: '+36' }, { name: 'Iran', code: '+98' },
  { name: 'Iraq', code: '+964' }, { name: 'Ireland', code: '+353' },
  { name: 'Israel', code: '+972' }, { name: 'Italy', code: '+39' },
  { name: 'Jordan', code: '+962' }, { name: 'Kazakhstan', code: '+7' },
  { name: 'Kenya', code: '+254' }, { name: 'Kuwait', code: '+965' },
  { name: 'Latvia', code: '+371' }, { name: 'Lebanon', code: '+961' },
  { name: 'Lithuania', code: '+370' }, { name: 'Luxembourg', code: '+352' },
  { name: 'Mexico', code: '+52' }, { name: 'Morocco', code: '+212' },
  { name: 'Netherlands', code: '+31' }, { name: 'New Zealand', code: '+64' },
  { name: 'Nigeria', code: '+234' }, { name: 'Norway', code: '+47' },
  { name: 'Oman', code: '+968' }, { name: 'Pakistan', code: '+92' },
  { name: 'Poland', code: '+48' }, { name: 'Portugal', code: '+351' },
  { name: 'Qatar', code: '+974' }, { name: 'Romania', code: '+40' },
  { name: 'Russia', code: '+7' }, { name: 'Slovakia', code: '+421' },
  { name: 'South Africa', code: '+27' }, { name: 'Spain', code: '+34' },
  { name: 'Sri Lanka', code: '+94' }, { name: 'Sweden', code: '+46' },
  { name: 'Switzerland', code: '+41' }, { name: 'Turkey', code: '+90' },
  { name: 'Ukraine', code: '+380' },
];

const EMPLOYEE_OPTIONS = ['1-5', '6-30', '31-200', '201-500', '501-2000', '2000+'];

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

// ─── Animation helpers ───────────────────────────────────────────────────────────
function useInView(threshold = 0.1) {
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

function AnimatedSection({ children, delay = 0, style = {}, className = '' }) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Icon helpers ────────────────────────────────────────────────────────────────
function GoldIcon({ path }) {
  return (
    <div style={{
      width: '44px', height: '44px', borderRadius: '10px',
      background: 'rgba(200,162,88,0.12)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: '20px', flexShrink: 0,
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C8A258" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {path}
      </svg>
    </div>
  );
}

// ─── Section label ───────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <span style={{
      display: 'inline-block',
      background: 'rgba(200,162,88,0.1)',
      border: '1px solid rgba(200,162,88,0.25)',
      borderRadius: '100px', padding: '5px 16px', marginBottom: '20px',
      fontFamily: "'Outfit', sans-serif",
      fontSize: '12px', fontWeight: '600', color: '#C8A258',
      letterSpacing: '0.07em', textTransform: 'uppercase',
    }}>
      {children}
    </span>
  );
}

// ─── Contact Form Section ────────────────────────────────────────────────────────
function ContactSection() {
  const [form, setForm] = useState({
    firstName: '', lastName: '', jobTitle: '', email: '',
    company: '', employees: '', countryCode: '+65', phone: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.jobTitle.trim()) e.jobTitle = 'Required';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid business email required';
    if (!form.company.trim()) e.company = 'Required';
    if (!form.employees) e.employees = 'Required';
    if (!form.phone.trim()) e.phone = 'Required';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const body = new URLSearchParams({
        'form-name': 'demo-request',
        firstName: form.firstName, lastName: form.lastName,
        jobTitle: form.jobTitle, email: form.email,
        company: form.company, employees: form.employees,
        phone: form.countryCode + ' ' + form.phone,
      });
      await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
    } catch { /* non-blocking */ }
    try {
      await addDoc(collection(db, 'demoRequests'), {
        firstName: form.firstName, lastName: form.lastName,
        jobTitle: form.jobTitle, email: form.email,
        company: form.company, employees: form.employees,
        phone: form.countryCode + (form.phone ? ' ' + form.phone : ''),
        status: 'NEW', notes: '',
        submittedAt: serverTimestamp(),
      });
    } catch { /* non-blocking */ }
    setSubmitted(true);
    setSubmitting(false);
  };

  const errStyle = (field) => errors[field] ? { borderColor: '#B54A4A' } : {};

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: 'rgba(200,162,88,0.12)',
          border: '2px solid #C8A258',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C8A258" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: '26px', fontWeight: 600, color: '#0C1017', margin: '0 0 12px' }}>
          Request Received
        </h3>
        <p style={{ fontFamily: "'Outfit', sans-serif", color: '#8A8680', fontSize: '16px', lineHeight: '1.7', margin: 0, maxWidth: '400px' }}>
          Thank you, {form.firstName}. Our team will be in touch within one business day to schedule your demo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="lp2-form-row">
        <div>
          <label className="lp2-form-label">First Name *</label>
          <input name="firstName" type="text" value={form.firstName} onChange={handleChange}
            className="lp2-form-input" placeholder="Jane" style={errStyle('firstName')} />
          {errors.firstName && <span style={{ fontSize: '12px', color: '#B54A4A', marginTop: '4px', display: 'block' }}>{errors.firstName}</span>}
        </div>
        <div>
          <label className="lp2-form-label">Last Name *</label>
          <input name="lastName" type="text" value={form.lastName} onChange={handleChange}
            className="lp2-form-input" placeholder="Smith" style={errStyle('lastName')} />
          {errors.lastName && <span style={{ fontSize: '12px', color: '#B54A4A', marginTop: '4px', display: 'block' }}>{errors.lastName}</span>}
        </div>
      </div>

      <div className="lp2-form-group">
        <label className="lp2-form-label">Job Title *</label>
        <input name="jobTitle" type="text" value={form.jobTitle} onChange={handleChange}
          className="lp2-form-input" placeholder="VP, Bond Sales" style={errStyle('jobTitle')} />
        {errors.jobTitle && <span style={{ fontSize: '12px', color: '#B54A4A', marginTop: '4px', display: 'block' }}>{errors.jobTitle}</span>}
      </div>

      <div className="lp2-form-group">
        <label className="lp2-form-label">Company Email *</label>
        <input name="email" type="email" value={form.email} onChange={handleChange}
          className="lp2-form-input" placeholder="jane.smith@firm.com" style={errStyle('email')} />
        {errors.email && <span style={{ fontSize: '12px', color: '#B54A4A', marginTop: '4px', display: 'block' }}>{errors.email}</span>}
      </div>

      <div className="lp2-form-group">
        <label className="lp2-form-label">Company *</label>
        <input name="company" type="text" value={form.company} onChange={handleChange}
          className="lp2-form-input" placeholder="Investment Bank or Securities Firm" style={errStyle('company')} />
        {errors.company && <span style={{ fontSize: '12px', color: '#B54A4A', marginTop: '4px', display: 'block' }}>{errors.company}</span>}
      </div>

      <div className="lp2-form-group">
        <label className="lp2-form-label">Number of Employees *</label>
        <select name="employees" value={form.employees} onChange={handleChange}
          className="lp2-form-select" style={errStyle('employees')}>
          <option value="">Select company size</option>
          {EMPLOYEE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {errors.employees && <span style={{ fontSize: '12px', color: '#B54A4A', marginTop: '4px', display: 'block' }}>{errors.employees}</span>}
      </div>

      <div className="lp2-form-group">
        <label className="lp2-form-label">Phone *</label>
        <div className="lp2-phone-row">
          <select name="countryCode" value={form.countryCode} onChange={handleChange} className="lp2-form-select">
            {COUNTRIES.map(c => (
              <option key={`${c.name}-${c.code}`} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
          <input name="phone" type="tel" value={form.phone} onChange={handleChange}
            className="lp2-form-input" placeholder="Phone number" style={errStyle('phone')} />
        </div>
        {errors.phone && <span style={{ fontSize: '12px', color: '#B54A4A', marginTop: '4px', display: 'block' }}>{errors.phone}</span>}
      </div>

      <button type="submit" disabled={submitting} className="lp2-btn-gold"
        style={{ width: '100%', padding: '14px', fontSize: '15px', marginTop: '8px', opacity: submitting ? 0.7 : 1 }}>
        {submitting ? 'Submitting...' : 'Request Demo'}
      </button>

      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', color: '#C0BDB8', textAlign: 'center', marginTop: '14px', marginBottom: 0 }}>
        By submitting, you agree to be contacted by our team via email or phone.
      </p>
    </form>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="lp2">
      <style>{STYLES}</style>

      <MarketingNav />

      {/* ── 1. HERO ──────────────────────────────────────────────────────────────── */}
      <section id="home" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center',
        background: 'linear-gradient(160deg, #0A1929 0%, #0F2137 40%, #1C3A5E 100%)',
        padding: '120px 24px 80px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Gold orb top-right */}
        <div style={{
          position: 'absolute', top: '-10%', right: '-5%',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,162,88,0.18) 0%, transparent 70%)',
          animation: 'lp-orbPulse 8s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        {/* Subtle bottom orb */}
        <div style={{
          position: 'absolute', bottom: '-15%', left: '-10%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,162,88,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: '800px', position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: '24px' }} className="lp2-hero-h1">
            <span style={{
              display: 'inline-block',
              background: 'rgba(200,162,88,0.1)',
              border: '1px solid rgba(200,162,88,0.2)',
              borderRadius: '100px', padding: '6px 18px',
              fontFamily: "'Outfit', sans-serif",
              fontSize: '12px', fontWeight: '600', color: '#C8A258',
              letterSpacing: '0.07em', textTransform: 'uppercase',
            }}>
              Built for bond sales desks
            </span>
          </div>

          <h1 className="lp2-hero-h1" style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 'clamp(36px, 6vw, 68px)',
            fontWeight: 600,
            color: '#F0EDE8',
            lineHeight: '1.15',
            margin: '0 0 24px',
            letterSpacing: '-0.01em',
          }}>
            Every enquiry.<br />
            Every quote.<br />
            Every execution.<br />
            <span style={{ color: '#C8A258' }}>One platform.</span>
          </h1>

          <p className="lp2-hero-sub" style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 'clamp(16px, 2vw, 20px)',
            fontWeight: 300,
            color: 'rgba(240,237,232,0.65)',
            margin: '0 auto 40px',
            maxWidth: '560px',
            lineHeight: '1.7',
          }}>
            Axle gives bond sales desks a single source of truth — activity tracking, client intelligence, deal pipeline, and AI-powered analytics.
          </p>

          <div className="lp2-hero-cta" style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => scrollTo('contact')} className="lp2-btn-gold" style={{ fontSize: '15px', padding: '14px 32px' }}>
              Request a Demo
            </button>
            <button onClick={() => scrollTo('product')} className="lp2-btn-ghost" style={{ fontSize: '15px', padding: '14px 32px' }}>
              See how it works &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* ── 3. PROBLEM STATEMENT ─────────────────────────────────────────────────── */}
      <section style={{ background: '#FFFFFF', padding: '100px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div className="lp2-problem-grid">
            <AnimatedSection>
              <SectionLabel>The Problem</SectionLabel>
              <h2 style={{
                fontFamily: "'Sora', sans-serif",
                fontSize: 'clamp(28px, 4vw, 42px)',
                fontWeight: 600, color: '#0C1017', margin: '0 0 24px', lineHeight: '1.2',
              }}>
                Your desk still runs on spreadsheets.
              </h2>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '16px', fontWeight: 300, color: '#8A8680', lineHeight: '1.8' }}>
                Bond sales is relationship-driven, high-velocity, and data-dense. But most desks track their most valuable asset — client interactions — in a patchwork of Excel files, chat logs, and email threads. That's revenue walking out the door.
              </p>
            </AnimatedSection>

            <AnimatedSection delay={150}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {[
                  {
                    icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>,
                    title: 'No institutional memory',
                    desc: 'When a salesperson leaves, client history and deal context disappears with them.',
                  },
                  {
                    icon: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
                    title: 'Invisible pipeline',
                    desc: "No real-time view of what's being worked, what's stalled, and where the revenue is.",
                  },
                  {
                    icon: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></>,
                    title: 'Analytics gaps',
                    desc: 'Hit rates, volume by client, conversion trends — calculated manually, hours after the fact.',
                  },
                  {
                    icon: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,
                    title: 'Compliance risk',
                    desc: "Undocumented activities mean audit trails that are incomplete or don't exist at all.",
                  },
                ].map(item => (
                  <div key={item.title} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '8px', flexShrink: 0,
                      background: 'rgba(200,162,88,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C8A258" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        {item.icon}
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: '600', color: '#0C1017', margin: '0 0 4px' }}>
                        {item.title}
                      </p>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: '300', color: '#8A8680', margin: 0, lineHeight: '1.6' }}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── 4. FEATURES GRID ─────────────────────────────────────────────────────── */}
      <section id="product" style={{ background: '#F4F2ED', padding: '100px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <AnimatedSection style={{ textAlign: 'center', marginBottom: '56px' }}>
            <SectionLabel>Platform</SectionLabel>
            <h2 style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 600, color: '#0C1017', margin: '0 auto 16px', maxWidth: '600px',
            }}>
              Everything your desk needs, in one place
            </h2>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '17px', fontWeight: 300, color: '#8A8680', maxWidth: '520px', margin: '0 auto', lineHeight: '1.7' }}>
              Designed for how bond sales actually works — fast, relationship-driven, and data-rich.
            </p>
          </AnimatedSection>

          <div className="lp2-feat-grid">
            {[
              {
                icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
                title: 'Activity CRM',
                desc: 'Log every enquiry, quote, and execution in seconds. Full audit trail, inline status updates, and client history at your fingertips.',
              },
              {
                icon: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
                title: 'AI Transcript Analysis',
                desc: 'Drop in call or chat transcripts and let Axle extract actionable deal intelligence — client sentiment, securities mentioned, and follow-ups.',
              },
              {
                icon: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
                title: 'Analytics Dashboard',
                desc: 'Hit rates, volume by client, direction split, and conversion trends — updated in real time, exportable to PDF and Excel.',
              },
              {
                icon: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></>,
                title: 'Deal Pipeline',
                desc: "New issues and order books tracked in a structured pipeline. Know what's live, what's upcoming, and where to focus your next call.",
              },
            ].map((feat, i) => (
              <AnimatedSection key={feat.title} delay={i * 80} className="lp2-feat-card">
                <GoldIcon path={feat.icon} />
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '17px', fontWeight: '600', color: '#0C1017', margin: '0 0 10px' }}>
                  {feat.title}
                </h3>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: '300', color: '#8A8680', margin: 0, lineHeight: '1.7' }}>
                  {feat.desc}
                </p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. HOW IT WORKS ──────────────────────────────────────────────────────── */}
      <section style={{ background: '#F0EDE8', padding: '100px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <AnimatedSection style={{ textAlign: 'center', marginBottom: '64px' }}>
            <SectionLabel>How It Works</SectionLabel>
            <h2 style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 600, color: '#0C1017', margin: 0,
            }}>
              Up and running in one day
            </h2>
          </AnimatedSection>

          <div className="lp2-steps-grid" style={{ position: 'relative' }}>
            {/* Connecting line — desktop only */}
            <div className="lp2-steps-line" style={{
              position: 'absolute', top: '30px', left: 'calc(16.6% + 20px)', right: 'calc(16.6% + 20px)',
              height: '1px', background: 'linear-gradient(90deg, transparent, rgba(200,162,88,0.3), transparent)',
              zIndex: 0,
            }} />

            {[
              { num: '01', title: 'Invite your team', desc: 'An admin sets up your organisation and invites desk members via email link. No IT involvement required.' },
              { num: '02', title: 'Log your first activity', desc: 'Start capturing enquiries, quotes, and executions. Fields are designed for bond sales — not generic CRM.' },
              { num: '03', title: 'Unlock intelligence', desc: 'Analytics update in real time. AI transcript analysis surfaces deal signals. Your pipeline becomes visible.' },
            ].map((step, i) => (
              <AnimatedSection key={step.num} delay={i * 120} style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  background: '#C8A258', color: '#0F2137',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '14px', fontWeight: '500',
                }}>
                  {step.num}
                </div>
                <h3 style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '22px', fontWeight: 600, color: '#0C1017', margin: '0 0 12px',
                }}>
                  {step.title}
                </h3>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 300, color: '#8A8680', lineHeight: '1.7', margin: 0 }}>
                  {step.desc}
                </p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. TESTIMONIALS ──────────────────────────────────────────────────────── */}
      <section id="about" style={{
        background: 'linear-gradient(160deg, #0A1929 0%, #0F2137 60%, #162B44 100%)',
        padding: '100px 24px',
      }}>
        <div style={{ maxWidth: '1060px', margin: '0 auto' }}>
          <AnimatedSection style={{ textAlign: 'center', marginBottom: '56px' }}>
            <SectionLabel>Testimonials</SectionLabel>
            <h2 style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 600, color: '#F0EDE8', margin: 0,
            }}>
              Trusted by bond sales professionals
            </h2>
          </AnimatedSection>

          <div className="lp2-testimonial-grid">
            {[
              {
                quote: "We replaced three separate spreadsheets with Axle in a week. Our hit rate visibility went from a monthly manual exercise to something we check every morning.",
                name: 'Sarah T.',
                role: 'Head of Bond Sales',
                institution: 'Regional Securities Firm, Singapore',
                initials: 'ST',
              },
              {
                quote: "The AI transcript feature alone saved my team hours each week. We paste in call notes and Axle surfaces the deal signals we'd have otherwise buried in a chat log.",
                name: 'Marcus L.',
                role: 'Director, Fixed Income',
                institution: 'Investment Bank, Hong Kong',
                initials: 'ML',
              },
              {
                quote: "Finally a CRM that speaks bond sales. The pipeline view has completely changed how our desk runs morning meetings — everyone knows exactly where every deal stands.",
                name: 'Priya N.',
                role: 'VP, Credit Sales',
                institution: 'Private Bank, Singapore',
                initials: 'PN',
              },
            ].map((t, i) => (
              <AnimatedSection key={t.name} delay={i * 100} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(200,162,88,0.15)',
                borderRadius: '14px', padding: '32px 28px',
                display: 'flex', flexDirection: 'column', gap: '24px',
              }}>
                {/* Quote mark */}
                <svg width="28" height="20" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <path d="M0 20V12.364C0 5.455 3.636 1.455 10.909 0L12.364 2.182C9.455 2.909 7.636 4.727 7.273 8H12.727V20H0ZM15.273 20V12.364C15.273 5.455 18.909 1.455 26.182 0L27.636 2.182C24.727 2.909 22.909 4.727 22.545 8H28V20H15.273Z" fill="#C8A258" fillOpacity="0.35"/>
                </svg>

                <p style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 300,
                  color: 'rgba(240,237,232,0.8)', lineHeight: '1.75', margin: 0, flexGrow: 1,
                }}>
                  {t.quote}
                </p>

                {/* Attribution */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(200,162,88,0.15)',
                    border: '1px solid rgba(200,162,88,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: '600',
                    color: '#C8A258', letterSpacing: '0.04em',
                  }}>
                    {t.initials}
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: '600', color: '#F0EDE8', margin: '0 0 2px' }}>
                      {t.name}
                    </p>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: '300', color: 'rgba(240,237,232,0.4)', margin: 0, lineHeight: '1.4' }}>
                      {t.role}<br />{t.institution}
                    </p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. CONTACT / DEMO REQUEST ────────────────────────────────────────────── */}
      <section id="contact" style={{ background: '#FFFFFF', padding: '100px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div className="lp2-contact-grid">
            {/* Left: copy */}
            <AnimatedSection>
              <SectionLabel>Request a Demo</SectionLabel>
              <h2 style={{
                fontFamily: "'Sora', sans-serif",
                fontSize: 'clamp(28px, 4vw, 42px)',
                fontWeight: 600, color: '#0C1017',
                margin: '0 0 20px', lineHeight: '1.2',
              }}>
                See Axle in action.
              </h2>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '16px', fontWeight: 300, color: '#8A8680', lineHeight: '1.8', margin: '0 0 32px' }}>
                Book a 30-minute session with our team. We'll walk through your desk's workflow and show you how Axle fits in.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { label: 'Typical response time', value: 'Within 1 business day' },
                  { label: 'Demo format', value: '30-min screen share' },
                  { label: 'Contact', value: 'hello@axle.finance' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: '600', color: '#C8A258', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {item.label}
                    </span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', color: '#2C2C2C' }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </AnimatedSection>

            {/* Right: form */}
            <AnimatedSection delay={150}>
              <ContactSection />
            </AnimatedSection>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
