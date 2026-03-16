import Navigation from '../components/Navigation';
import { useAuth } from '../contexts/AuthContext';
import { getTierLabel } from '../config/moduleAccess';

export default function UpgradeGate({ moduleName, requiredTier }) {
  const { orgPlan } = useAuth();

  return (
    <div className="app-container">
      <Navigation />
      <main className="main-content">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          padding: '40px 24px',
        }}>
          {/* Lock icon */}
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'rgba(200, 162, 88, 0.1)',
            border: '2px solid rgba(200, 162, 88, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C8A258" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '12px',
          }}>
            {moduleName} is available on {requiredTier}
          </h1>

          {/* Current plan badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: '20px',
            background: 'var(--badge-primary-bg)',
            color: 'var(--badge-primary-text)',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '24px',
          }}>
            Current plan: {getTierLabel(orgPlan)}
          </div>

          {/* Description */}
          <p style={{
            fontSize: '15px',
            color: 'var(--text-secondary)',
            maxWidth: '480px',
            lineHeight: 1.6,
            marginBottom: '32px',
          }}>
            Upgrade your subscription to unlock {moduleName} and get access to advanced features that help your desk work smarter.
          </p>

          {/* Feature preview cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            maxWidth: '640px',
            width: '100%',
            marginBottom: '36px',
          }}>
            {moduleName === 'Pipeline' && [
              ['New Issue Tracking', 'Track new bond issuances from mandate to pricing'],
              ['Order Book', 'Manage investor orders and allocations'],
              ['Bookrunner Management', 'Track syndicate roles and responsibilities'],
            ].map(([title, desc]) => (
              <FeatureCard key={title} title={title} desc={desc} />
            ))}
            {moduleName === 'Analytics' && [
              ['Volume Trends', 'Track trading volume over time by client, currency, region'],
              ['Conversion Rates', 'Measure enquiry-to-execution conversion'],
              ['Top Clients', 'Identify your most active counterparties'],
            ].map(([title, desc]) => (
              <FeatureCard key={title} title={title} desc={desc} />
            ))}
            {moduleName === 'AI Assistant' && [
              ['Transcript Analysis', 'Extract trades from Bloomberg chats automatically'],
              ['Image Recognition', 'Upload chat screenshots for AI vision analysis'],
              ['Adaptive Learning', 'AI learns from your corrections over time'],
            ].map(([title, desc]) => (
              <FeatureCard key={title} title={title} desc={desc} />
            ))}
          </div>

          {/* CTA */}
          <a
            href="mailto:info@axle-finance.com?subject=Upgrade%20Enquiry"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #C8A258, #A07D3A)',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 2px 12px rgba(200, 162, 88, 0.35)',
              transition: 'all 0.2s',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
            Contact Us to Upgrade
          </a>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
            info@axle-finance.com
          </p>
        </div>
      </main>

      <style jsx>{`
        .app-container{min-height:100vh;background:var(--bg-base);color:var(--text-primary);}
        .main-content{max-width:1400px;margin:0 auto;padding:32px 24px;}
      `}</style>
    </div>
  );
}

function FeatureCard({ title, desc }) {
  return (
    <div style={{
      padding: '16px',
      borderRadius: '10px',
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      textAlign: 'left',
    }}>
      <div style={{
        fontSize: '13px',
        fontWeight: 700,
        color: '#C8A258',
        marginBottom: '6px',
      }}>
        {title}
      </div>
      <div style={{
        fontSize: '12px',
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
      }}>
        {desc}
      </div>
    </div>
  );
}
