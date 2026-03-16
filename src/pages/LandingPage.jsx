import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import MarketingNav from '../components/marketing/MarketingNav';
import MarketingFooter from '../components/marketing/MarketingFooter';
import { LoginView, ForgotPasswordView, ContactView, LOGIN_STYLES } from './Login';
import { AxleLogo } from '@alteri/ui';

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
    .lp2-ai-steps { grid-template-columns: 1fr !important; gap: 24px !important; }
    .lp2-ai-compare { grid-template-columns: 1fr !important; }
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

// ─── Comparison cell renderer ─────────────────────────────────────────────────────
function renderCell(val, isAxle) {
  if (val === 'yes') {
    return (
      <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'24px', height:'24px', borderRadius:'50%', background: isAxle ? 'rgba(200,162,88,0.12)' : 'rgba(34,197,94,0.1)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isAxle ? '#C8A258' : '#22c55e'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }
  if (val === 'no') {
    return (
      <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'24px', height:'24px', borderRadius:'50%', background:'rgba(0,0,0,0.04)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C0BDB8" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    );
  }
  const LABELS = { custom: 'Custom setup', addon: 'Add-on', limited: 'Limited' };
  const label = LABELS[val] || val;
  const isPartial = val === 'custom' || val === 'addon' || val === 'limited';
  return <span style={{ fontSize:'12px', color: isPartial ? '#B89346' : '#8A8680', fontWeight: isPartial ? 500 : 400 }}>{label}</span>;
}

// ─── Dark badge helper ────────────────────────────────────────────────────────────
function DarkBadge({ text, color, bg }) {
  return (
    <span style={{ padding:'2px 8px', borderRadius:'12px', background:bg, color, fontSize:'10px', fontWeight:600, fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap' }}>
      {text}
    </span>
  );
}

// ─── Product preview sub-components ──────────────────────────────────────────────
function ActivityCRMPreview() {
  const rows = [
    { date:'03 Mar', client:'Temasek Holdings', type:'Phone Call', isin:'US4592001014', dir:'BUY', dirClr:'#22c55e', dirBg:'rgba(34,197,94,0.12)', sts:'EXECUTED', stsClr:'#22c55e', stsBg:'rgba(34,197,94,0.12)', price:'98.75' },
    { date:'03 Mar', client:'Fullerton Fund Mgmt', type:'Bloomberg Chat', isin:'SG2134587890', dir:'SELL', dirClr:'#f87171', dirBg:'rgba(248,113,113,0.12)', sts:'QUOTED', stsClr:'#fbbf24', stsBg:'rgba(251,191,36,0.12)', price:'101.25' },
    { date:'02 Mar', client:'Lion Global Investors', type:'Email', isin:'US5949181045', dir:'TWO-WAY', dirClr:'#fbbf24', dirBg:'rgba(251,191,36,0.12)', sts:'ENQUIRY', stsClr:'#93c5fd', stsBg:'rgba(147,197,253,0.12)', price:'—' },
  ];
  return (
    <div style={{ fontFamily:"'Outfit',sans-serif" }}>
      <div style={{ display:'flex', gap:'12px', marginBottom:'16px', flexWrap:'wrap' }}>
        {[{label:'Total',val:'47',clr:'#C8A258'},{label:'Volume',val:'$234.5MM',clr:'#C8A258'},{label:'Buy',val:'28',clr:'#22c55e'},{label:'Sell',val:'19',clr:'#f87171'}].map(s=>(
          <div key={s.label} style={{ background:'rgba(255,255,255,0.04)', borderRadius:'8px', padding:'10px 14px', border:'1px solid rgba(255,255,255,0.07)', minWidth:'80px' }}>
            <div style={{ fontSize:'18px', fontWeight:700, color:s.clr }}>{s.val}</div>
            <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:'2px' }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
          <thead>
            <tr>{['Date','Client','Type','ISIN','Direction','Status','Price'].map(h=>(
              <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'rgba(255,255,255,0.3)', fontWeight:600, fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.07em', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} style={{ background:i%2===0?'rgba(255,255,255,0.02)':'transparent', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding:'10px 12px', color:'rgba(255,255,255,0.4)', whiteSpace:'nowrap' }}>{r.date}</td>
                <td style={{ padding:'10px 12px', color:'rgba(255,255,255,0.9)', fontWeight:600, whiteSpace:'nowrap' }}>{r.client}</td>
                <td style={{ padding:'10px 12px' }}><DarkBadge text={r.type} color='#C8A258' bg='rgba(200,162,88,0.12)' /></td>
                <td style={{ padding:'10px 12px', color:'rgba(255,255,255,0.5)', fontFamily:'monospace', fontSize:'11px' }}>{r.isin}</td>
                <td style={{ padding:'10px 12px' }}><DarkBadge text={r.dir} color={r.dirClr} bg={r.dirBg} /></td>
                <td style={{ padding:'10px 12px' }}><DarkBadge text={r.sts} color={r.stsClr} bg={r.stsBg} /></td>
                <td style={{ padding:'10px 12px', color:'rgba(255,255,255,0.6)' }}>{r.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PipelinePreview() {
  const issues = [
    { date:'03 Mar', issuer:'Sembcorp Industries', size:'500', ccy:'USD', runners:'JPM, GS, HSBC' },
    { date:'02 Mar', issuer:'CapitaLand Investments', size:'300', ccy:'SGD', runners:'HSBC, SCB' },
    { date:'01 Mar', issuer:'DBS Bank', size:'750', ccy:'USD', runners:'JPM, MS, GS' },
  ];
  return (
    <div style={{ fontFamily:"'Outfit',sans-serif" }}>
      <div style={{ display:'flex', gap:'4px', marginBottom:'16px', borderBottom:'1px solid rgba(255,255,255,0.06)', paddingBottom:'0' }}>
        {['New Issues (3)', 'Order Book'].map((t,i)=>(
          <div key={t} style={{ padding:'8px 16px', fontSize:'12px', fontWeight:600, cursor:'pointer', color:i===0?'#C8A258':'rgba(255,255,255,0.35)', borderBottom:i===0?'2px solid #C8A258':'2px solid transparent', marginBottom:'-1px' }}>{t}</div>
        ))}
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
          <thead>
            <tr>{['Date','Issuer','Target Size','Currency','Bookrunners'].map(h=>(
              <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'rgba(255,255,255,0.3)', fontWeight:600, fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.07em', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {issues.map((r,i)=>(
              <tr key={i} style={{ background:i%2===0?'rgba(255,255,255,0.02)':'transparent', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding:'10px 12px', color:'rgba(255,255,255,0.4)', whiteSpace:'nowrap' }}>{r.date}</td>
                <td style={{ padding:'10px 12px', color:'rgba(255,255,255,0.9)', fontWeight:600 }}>{r.issuer}</td>
                <td style={{ padding:'10px 12px', color:'rgba(255,255,255,0.7)' }}>{r.size}MM</td>
                <td style={{ padding:'10px 12px' }}><DarkBadge text={r.ccy} color='#C8A258' bg='rgba(200,162,88,0.12)' /></td>
                <td style={{ padding:'10px 12px', color:'rgba(255,255,255,0.5)' }}>{r.runners}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnalyticsPreview() {
  const clients = [
    { name:'Temasek Holdings', vol:85, pct:'85%' },
    { name:'Lion Global Investors', vol:68, pct:'68%' },
    { name:'Fullerton Fund Mgmt', vol:54, pct:'54%' },
    { name:'Eastspring Investments', vol:41, pct:'41%' },
    { name:'Aberdeen Asset Mgmt', vol:29, pct:'29%' },
  ];
  return (
    <div style={{ fontFamily:"'Outfit',sans-serif" }}>
      <div style={{ display:'flex', gap:'12px', marginBottom:'20px', flexWrap:'wrap' }}>
        {[{label:'Hit Rate',val:'34.2%',sub:'of enquiries executed'},{label:'Total Volume',val:'$1.2B',sub:'this quarter'},{label:'Avg Ticket Size',val:'$47.3MM',sub:'per trade'}].map(s=>(
          <div key={s.label} style={{ background:'rgba(255,255,255,0.04)', borderRadius:'8px', padding:'12px 16px', border:'1px solid rgba(255,255,255,0.07)', flex:'1', minWidth:'120px' }}>
            <div style={{ fontSize:'20px', fontWeight:700, color:'#C8A258', marginBottom:'4px' }}>{s.val}</div>
            <div style={{ fontSize:'11px', fontWeight:600, color:'rgba(255,255,255,0.7)', marginBottom:'2px' }}>{s.label}</div>
            <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)' }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom:'18px' }}>
        <div style={{ fontSize:'10px', fontWeight:600, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'10px' }}>Top 5 Clients by Volume</div>
        {clients.map(c=>(
          <div key={c.name} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'7px' }}>
            <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.55)', width:'160px', flexShrink:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</span>
            <div style={{ flex:1, background:'rgba(255,255,255,0.06)', borderRadius:'3px', height:'5px' }}>
              <div style={{ width:c.pct, background:'linear-gradient(90deg,#C8A258,#D4B06A)', borderRadius:'3px', height:'100%' }} />
            </div>
            <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)', width:'38px', textAlign:'right' }}>{c.vol}MM</span>
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize:'10px', fontWeight:600, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'8px' }}>Direction Split</div>
        <div style={{ display:'flex', height:'7px', borderRadius:'4px', overflow:'hidden', gap:'2px' }}>
          <div style={{ width:'52%', background:'rgba(34,197,94,0.55)' }} />
          <div style={{ width:'31%', background:'rgba(248,113,113,0.55)' }} />
          <div style={{ width:'17%', background:'rgba(251,191,36,0.55)' }} />
        </div>
        <div style={{ display:'flex', gap:'16px', marginTop:'7px' }}>
          {[{label:'Buy',pct:'52%',clr:'#22c55e'},{label:'Sell',pct:'31%',clr:'#f87171'},{label:'Two-Way',pct:'17%',clr:'#fbbf24'}].map(d=>(
            <div key={d.label} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
              <div style={{ width:'8px', height:'8px', borderRadius:'2px', background:d.clr, opacity:0.6 }} />
              <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)' }}>{d.label}: {d.pct}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AIPreview() {
  const results = [
    { client:'GIC Private Ltd', isin:'HSBC 5.25 2028', dir:'BUY', dirClr:'#22c55e', dirBg:'rgba(34,197,94,0.12)', size:'10', ccy:'USD', price:'100.15', status:'EXECUTED', statusClr:'#22c55e' },
    { client:'Fidelity Intl', isin:'STANCHART 6.17 2027', dir:'SELL', dirClr:'#ef4444', dirBg:'rgba(239,68,68,0.12)', size:'15', ccy:'USD', price:'52', status:'TRADED AWAY', statusClr:'#ef4444' },
    { client:'Ping An Asset Mgmt', isin:'BOC 5.00 2026', dir:'TWO-WAY', dirClr:'#fbbf24', dirBg:'rgba(251,191,36,0.12)', size:'50', ccy:'USD', price:'-', status:'ENQUIRY', statusClr:'#60a5fa' },
  ];
  return (
    <div style={{ fontFamily:"'Outfit',sans-serif" }}>
      {/* Transcript input preview */}
      <div style={{ padding:'10px 14px', background:'rgba(255,255,255,0.02)', borderRadius:'6px', border:'1px solid rgba(255,255,255,0.06)', marginBottom:'12px', fontFamily:"'JetBrains Mono', monospace", fontSize:'10px', color:'rgba(255,255,255,0.3)', lineHeight:'1.7' }}>
        <span style={{ color:'rgba(200,162,88,0.5)' }}>[09:14]</span> GIC: can you show me axe on HSBC 5.25 2028? looking for 10mm usd &nbsp;
        <span style={{ color:'rgba(200,162,88,0.5)' }}>[09:16]</span> done at 100.15, bought 10mm &nbsp;
        <span style={{ color:'rgba(200,162,88,0.5)' }}>[09:32]</span> Fidelity: offer 15mm STANCHART 6.17 at 52...
      </div>
      {/* Status bar */}
      <div style={{ padding:'12px 18px', background:'rgba(255,255,255,0.03)', borderRadius:'8px', border:'1px solid rgba(200,162,88,0.2)', marginBottom:'14px', display:'flex', alignItems:'center', gap:'14px' }}>
        <div style={{ width:'34px', height:'34px', borderRadius:'8px', background:'rgba(200,162,88,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C8A258" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'12px', fontWeight:600, color:'rgba(255,255,255,0.8)' }}>bloomberg_chat_0303.txt</div>
          <div style={{ fontSize:'10px', color:'#22c55e', marginTop:'2px' }}>✓ Analysed — 3 activities detected · 847 tokens</div>
        </div>
        <div style={{ padding:'6px 14px', borderRadius:'6px', background:'linear-gradient(135deg,#C8A258,#D4B06A)', color:'#0F2137', fontSize:'11px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>Import All</div>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
          <thead>
            <tr>{['Client','Bond','Size','Price','Direction','Status'].map(h=>(
              <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'rgba(255,255,255,0.3)', fontWeight:600, fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.07em', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {results.map((r,i)=>(
              <tr key={i} style={{ background:i%2===0?'rgba(255,255,255,0.02)':'transparent', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding:'10px 12px', color:'rgba(255,255,255,0.9)', fontWeight:600 }}>{r.client}</td>
                <td style={{ padding:'10px 12px', color:'rgba(255,255,255,0.5)', fontSize:'11px' }}>{r.isin}</td>
                <td style={{ padding:'10px 12px', color:'rgba(255,255,255,0.7)' }}>{r.size}MM {r.ccy}</td>
                <td style={{ padding:'10px 12px', color:'rgba(255,255,255,0.7)' }}>{r.price}</td>
                <td style={{ padding:'10px 12px' }}><DarkBadge text={r.dir} color={r.dirClr} bg={r.dirBg} /></td>
                <td style={{ padding:'10px 12px' }}><DarkBadge text={r.status} color={r.statusClr} bg={`${r.statusClr}18`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
      await fetch('/.netlify/functions/notify-demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName, lastName: form.lastName,
          jobTitle: form.jobTitle, email: form.email,
          company: form.company, employees: form.employees,
          phone: form.countryCode + ' ' + form.phone,
        }),
      });
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
        <p style={{ fontFamily: "'Outfit', sans-serif", color: '#8A8680', fontSize: '16px', lineHeight: '1.7', margin: '0 auto 24px', maxWidth: '400px' }}>
          Thank you, {form.firstName}. Our team will be in touch within one business day to schedule your demo.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setForm({ firstName: '', lastName: '', jobTitle: '', email: '', company: '', employees: '', countryCode: '+65', phone: '' });
            setErrors({});
          }}
          className="lp2-btn-gold"
          style={{ fontSize: '14px', padding: '10px 24px' }}
        >
          Submit Another Request
        </button>
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
          className="lp2-form-select" style={{ ...errStyle('employees'), color: form.employees ? '#0C1017' : '#C0BDB8' }}>
          <option value="">Select company size</option>
          {EMPLOYEE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {errors.employees && <span style={{ fontSize: '12px', color: '#B54A4A', marginTop: '4px', display: 'block' }}>{errors.employees}</span>}
      </div>

      <div className="lp2-form-group">
        <label className="lp2-form-label">Phone *</label>
        <div className="lp2-phone-row">
          <select name="countryCode" value={form.countryCode} onChange={handleChange} className="lp2-form-select" style={{ color: form.countryCode ? '#0C1017' : '#C0BDB8' }}>
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
function LoginModal() {
  const navigate = useNavigate();
  const [view, setView] = useState('login');

  const handleClose = () => navigate('/');

  return (
    <>
      <style>{LOGIN_STYLES}</style>
      <div
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div className="login-card" style={{ position: 'relative' }}>
          <div className="login-logo">
            <AxleLogo size="md" variant="dark" />
          </div>
          {view === 'login' ? (
            <LoginView
              onForgotPassword={() => setView('forgot')}
              onOpenDemo={handleClose}
              onContact={() => setView('contact')}
            />
          ) : view === 'forgot' ? (
            <ForgotPasswordView onBack={() => setView('login')} />
          ) : (
            <ContactView onBack={() => setView('login')} />
          )}
        </div>
      </div>
    </>
  );
}

export default function LandingPage({ showLogin = false }) {
  const [activePreview, setActivePreview] = useState('crm');
  const location = useLocation();

  useEffect(() => {
    if (location.state?.scrollTo) {
      const id = location.state.scrollTo;
      // Small delay to ensure the page has rendered
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      // Clear the state so it doesn't re-scroll on re-renders
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  return (
    <div className="lp2">
      <style>{STYLES}</style>

      <MarketingNav />
      {showLogin && <LoginModal />}

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
            Axle turns Bloomberg chats into structured deal intelligence — powered by AI. Activity tracking, client CRM, pipeline, and real-time analytics in one platform.
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
                  {
                    icon: <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>,
                    title: 'Hours lost to manual data entry',
                    desc: 'Salespeople re-key deal details from chats and calls into spreadsheets. Information gets lost, delayed, or never captured at all.',
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
                desc: 'Paste a Bloomberg chat or call transcript — Axle\'s AI extracts every client, bond, size, direction, and price into structured activities. What used to take hours of manual entry now takes seconds.',
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

          {/* ── Product Preview ── */}
          <AnimatedSection style={{ marginTop: '64px' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: '26px', fontWeight: 600, color: '#0C1017', margin: '0 0 8px' }}>
                See it in action
              </h3>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', color: '#8A8680', margin: 0 }}>
                A purpose-built workspace designed for the pace of bond sales
              </p>
            </div>

            {/* Preview tabs */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
              {[
                { id: 'crm', label: 'Activity CRM' },
                { id: 'pipeline', label: 'Deal Pipeline' },
                { id: 'analytics', label: 'Analytics' },
                { id: 'ai', label: 'AI Analysis' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActivePreview(tab.id)}
                  style={{
                    padding: '8px 20px', borderRadius: '100px', cursor: 'pointer',
                    border: activePreview === tab.id ? '1px solid #C8A258' : '1px solid #E4E0DA',
                    background: activePreview === tab.id ? 'rgba(200,162,88,0.1)' : 'transparent',
                    color: activePreview === tab.id ? '#C8A258' : '#8A8680',
                    fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600,
                    transition: 'all 0.2s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Dark app frame */}
            <div style={{ background: '#0A1929', borderRadius: '16px', border: '1px solid rgba(200,162,88,0.2)', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
              {/* Mock browser bar */}
              <div style={{ background: '#0F2137', borderBottom: '1px solid rgba(200,162,88,0.1)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {[1,2,3].map(d => <div key={d} style={{ width:'9px', height:'9px', borderRadius:'50%', background:'rgba(255,255,255,0.08)' }} />)}
                <div style={{ flex:1, background:'rgba(255,255,255,0.05)', borderRadius:'4px', height:'22px', marginLeft:'8px', display:'flex', alignItems:'center', paddingLeft:'10px' }}>
                  <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.25)', fontFamily:'monospace' }}>
                    axle-finance.com/{activePreview === 'crm' ? 'activities' : activePreview === 'pipeline' ? 'pipeline' : activePreview === 'analytics' ? 'analytics' : 'ai-assistant'}
                  </span>
                </div>
              </div>
              {/* Preview content */}
              <div style={{ padding: '24px', minHeight: '300px' }}>
                {activePreview === 'crm' && <ActivityCRMPreview />}
                {activePreview === 'pipeline' && <PipelinePreview />}
                {activePreview === 'analytics' && <AnalyticsPreview />}
                {activePreview === 'ai' && <AIPreview />}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── AI DEEP-DIVE SECTION ─────────────────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(160deg, #0A1929 0%, #0F2137 60%, #162B44 100%)',
        padding: '100px 24px',
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <AnimatedSection style={{ textAlign: 'center', marginBottom: '56px' }}>
            <SectionLabel>AI-Powered</SectionLabel>
            <h2 style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 600, color: '#F0EDE8', margin: '0 0 16px', lineHeight: '1.2',
            }}>
              From chat transcript to deal intelligence<br />
              <span style={{ color: '#C8A258' }}>in seconds.</span>
            </h2>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '17px', fontWeight: 300, color: 'rgba(240,237,232,0.6)', maxWidth: '580px', margin: '0 auto', lineHeight: '1.7' }}>
              Stop re-keying trades from Bloomberg chats. Axle's AI reads your transcripts and extracts every activity — client, bond, size, direction, price — ready to import with one click.
            </p>
          </AnimatedSection>

          {/* 3-step flow */}
          <AnimatedSection delay={100}>
            <div className="lp2-ai-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '48px' }}>
              {[
                { num: '01', title: 'Upload transcript', desc: 'Paste or upload any Bloomberg chat, call note, or meeting transcript.' },
                { num: '02', title: 'AI extracts trades', desc: 'GPT identifies clients, ISINs, tickers, sizes, directions, prices, and deal status automatically.' },
                { num: '03', title: 'Import with one click', desc: 'Review extracted activities, register new clients, and import everything to your activity log instantly.' },
              ].map((step, i) => (
                <div key={step.num} style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    background: 'rgba(200,162,88,0.15)', border: '1px solid rgba(200,162,88,0.3)',
                    color: '#C8A258', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 600,
                  }}>
                    {step.num}
                  </div>
                  <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F0EDE8', margin: '0 0 8px' }}>
                    {step.title}
                  </h4>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 300, color: 'rgba(240,237,232,0.5)', lineHeight: '1.6', margin: 0 }}>
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </AnimatedSection>

          {/* Before/After visual */}
          <AnimatedSection delay={200}>
            <div className="lp2-ai-compare" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'stretch' }}>
              {/* Before: Raw transcript */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Raw Bloomberg Chat</span>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.8', flex: 1 }}>
                  <div><span style={{ color: 'rgba(200,162,88,0.7)' }}>[09:14]</span> GIC: can you show me axe on HSBC 5.25 2028?</div>
                  <div><span style={{ color: 'rgba(200,162,88,0.7)' }}>[09:14]</span> looking for 10mm usd</div>
                  <div><span style={{ color: 'rgba(200,162,88,0.7)' }}>[09:15]</span> Dealer: 100.15/100.25</div>
                  <div><span style={{ color: 'rgba(200,162,88,0.7)' }}>[09:16]</span> GIC: done at 100.15, bought 10mm</div>
                  <div style={{ marginTop: '10px' }}><span style={{ color: 'rgba(200,162,88,0.7)' }}>[09:32]</span> Fidelity: any interest in STANCHART 6.17 2027?</div>
                  <div><span style={{ color: 'rgba(200,162,88,0.7)' }}>[09:32]</span> we can offer 15mm at 52</div>
                  <div><span style={{ color: 'rgba(200,162,88,0.7)' }}>[09:33]</span> Dealer: let me check with desk</div>
                  <div><span style={{ color: 'rgba(200,162,88,0.7)' }}>[09:45]</span> Dealer: goldman executed @ 51.75, traded away</div>
                </div>
              </div>

              {/* After: Extracted data */}
              <div style={{ background: 'rgba(200,162,88,0.04)', border: '1px solid rgba(200,162,88,0.2)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 600, color: '#C8A258', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI-Extracted Activities</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {[
                    { client: 'GIC', bond: 'HSBC 5.25 2028', size: '10MM', dir: 'BUY', dirClr: '#22c55e', price: '100.15', status: 'EXECUTED', statusClr: '#22c55e' },
                    { client: 'Fidelity', bond: 'STANCHART 6.17 2027', size: '15MM', dir: 'SELL', dirClr: '#ef4444', price: '52', status: 'TRADED AWAY', statusClr: '#ef4444' },
                  ].map((r, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F0EDE8' }}>{r.client}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, background: `${r.dirClr}18`, color: r.dirClr }}>{r.dir}</span>
                          <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, background: `${r.statusClr}18`, color: r.statusClr }}>{r.status}</span>
                        </div>
                      </div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', color: 'rgba(240,237,232,0.5)' }}>
                        {r.bond} · {r.size} USD · @ {r.price}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AnimatedSection>

          {/* Stats row */}
          <AnimatedSection delay={300}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '48px', marginTop: '48px', flexWrap: 'wrap' }}>
              {[
                { value: '~2 hrs', label: 'saved per desk per day' },
                { value: '< 10s', label: 'per transcript analysis' },
                { value: '1-click', label: 'import to activity log' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Sora', sans-serif", fontSize: '32px', fontWeight: 700, color: '#C8A258' }}>{s.value}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 300, color: 'rgba(240,237,232,0.5)', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </AnimatedSection>
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

      {/* ── 6. COMPARISON TABLE ──────────────────────────────────────────────────── */}
      <section id="compare" style={{ background: '#FFFFFF', padding: '100px 24px' }}>
        <div style={{ maxWidth: '1060px', margin: '0 auto' }}>
          <AnimatedSection style={{ textAlign: 'center', marginBottom: '56px' }}>
            <SectionLabel>Why Axle</SectionLabel>
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 600, color: '#0C1017', margin: '0 auto 16px', maxWidth: '620px', lineHeight: '1.2' }}>
              Built for bond sales. Not adapted for it.
            </h2>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '17px', fontWeight: 300, color: '#8A8680', maxWidth: '520px', margin: '0 auto', lineHeight: '1.7' }}>
              General-purpose CRMs require months of customisation to approximate what Axle delivers out of the box.
            </p>
          </AnimatedSection>

          <AnimatedSection delay={100} style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid #E4E0DA', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Outfit', sans-serif", minWidth: '640px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '16px 24px', textAlign: 'left', background: '#F4F2ED', color: '#8A8680', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #E4E0DA', width: '36%' }}>Feature</th>
                  <th style={{ padding: '16px 20px', textAlign: 'center', background: 'rgba(200,162,88,0.07)', borderBottom: '2px solid #C8A258', borderLeft: '1px solid rgba(200,162,88,0.2)', borderRight: '1px solid rgba(200,162,88,0.2)' }}>
                    <span style={{ fontFamily: "'Sora', sans-serif", fontSize: '15px', fontWeight: 700, color: '#0C1017' }}>Axle</span>
                    <div style={{ fontSize: '11px', color: '#8A8680', fontWeight: 400, marginTop: '2px' }}>by Alteri Group</div>
                  </th>
                  {['Salesforce', 'HubSpot', 'Generic CRM'].map(col => (
                    <th key={col} style={{ padding: '16px 20px', textAlign: 'center', background: '#F4F2ED', color: '#5A5654', fontSize: '13px', fontWeight: 600, borderBottom: '1px solid #E4E0DA', borderLeft: '1px solid #E4E0DA' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Purpose-built for bond sales', axle:'yes', sf:'no', hub:'no', gen:'no' },
                  { label: 'Activity & trade log', axle:'yes', sf:'custom', hub:'limited', gen:'limited' },
                  { label: 'ISIN / Ticker tracking', axle:'yes', sf:'no', hub:'no', gen:'no' },
                  { label: 'Inline status & price editing', axle:'yes', sf:'no', hub:'no', gen:'no' },
                  { label: 'New issues pipeline', axle:'yes', sf:'custom', hub:'no', gen:'no' },
                  { label: 'Order book management', axle:'yes', sf:'custom', hub:'no', gen:'no' },
                  { label: 'AI transcript analysis', axle:'yes', sf:'addon', hub:'no', gen:'no' },
                  { label: 'Real-time analytics', axle:'yes', sf:'limited', hub:'limited', gen:'no' },
                  { label: 'PDF & Excel export', axle:'yes', sf:'addon', hub:'addon', gen:'limited' },
                  { label: 'Bloomberg integration', axle:'yes', sf:'no', hub:'no', gen:'no' },
                  { label: 'Onboarding time', axle:'1 day', sf:'3–6 months', hub:'1–3 months', gen:'2–4 weeks' },
                ].map((row, i) => (
                  <tr key={row.label} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFAF8' }}>
                    <td style={{ padding: '13px 24px', color: '#2C2C2C', fontSize: '14px', fontWeight: 500, borderBottom: '1px solid #F0EDE8' }}>{row.label}</td>
                    <td style={{ padding: '13px 20px', textAlign: 'center', background: 'rgba(200,162,88,0.04)', borderLeft: '1px solid rgba(200,162,88,0.12)', borderRight: '1px solid rgba(200,162,88,0.12)', borderBottom: '1px solid rgba(200,162,88,0.08)' }}>
                      {renderCell(row.axle, true)}
                    </td>
                    {[row.sf, row.hub, row.gen].map((val, j) => (
                      <td key={j} style={{ padding: '13px 20px', textAlign: 'center', borderLeft: '1px solid #F0EDE8', borderBottom: '1px solid #F0EDE8' }}>
                        {renderCell(val, false)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </AnimatedSection>

          <AnimatedSection delay={150} style={{ textAlign: 'center', marginTop: '40px' }}>
            <button onClick={() => scrollTo('contact')} className="lp2-btn-gold" style={{ fontSize: '15px', padding: '14px 32px' }}>
              See Axle in action
            </button>
          </AnimatedSection>
        </div>
      </section>

      {/* ── 7. TESTIMONIALS ──────────────────────────────────────────────────────── */}
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
                  { label: 'Contact', value: 'info@axle-finance.com' },
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
