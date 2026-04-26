import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Banner shown to every user in an org with an active or expired pilot.
// Shows days-left countdown with green/amber/red urgency, and a CTA to
// email info@axle-finance.com to subscribe (or — implicitly — for the
// host admin to extend, which they do from admin.axle-finance.com).
export default function PilotBanner() {
  const { pilot, userData } = useAuth();
  const [now, setNow] = useState(() => new Date());

  // Tick once a minute so the days-left ticker updates on long sessions
  // and can flip from "active" to "expired" without a refresh.
  useEffect(() => {
    if (!pilot) return;
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, [pilot]);

  if (!pilot || !pilot.endAt) return null;

  const ms = pilot.endAt.getTime() - now.getTime();
  const expired = ms <= 0;
  const daysLeft = Math.max(0, Math.ceil(ms / 86_400_000));
  const fmtDate = pilot.endAt.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  // Tone scaling: more red as we approach expiry. Past expiry is dark red.
  let bg, fg, border, label;
  if (expired) {
    bg = '#7f1d1d'; fg = '#fee2e2'; border = '#991b1b';
    label = `Pilot ended ${fmtDate}`;
  } else if (daysLeft <= 7) {
    bg = '#7c2d12'; fg = '#ffedd5'; border = '#9a3412';
    label = `Pilot ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'} · ${fmtDate}`;
  } else if (daysLeft <= 14) {
    bg = '#78350f'; fg = '#fef3c7'; border = '#92400e';
    label = `Pilot ends in ${daysLeft} days · ${fmtDate}`;
  } else {
    bg = 'rgba(200,162,88,0.14)'; fg = '#C8A258'; border = 'rgba(200,162,88,0.4)';
    label = `Pilot ends in ${daysLeft} days · ${fmtDate}`;
  }

  const subject = encodeURIComponent(
    expired
      ? `Subscribe to Axle (pilot expired) — ${userData?.organizationName || userData?.organizationId || ''}`
      : `Subscribe to Axle — ${userData?.organizationName || userData?.organizationId || ''}`,
  );
  const body = encodeURIComponent(
    `Hi Axle team,\n\nWe'd like to subscribe to Axle.\n\nOrganisation: ${userData?.organizationName || userData?.organizationId || ''}\nContact: ${userData?.name || ''} <${userData?.email || ''}>\n\nThanks.`,
  );

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: bg,
        color: fg,
        borderBottom: `1px solid ${border}`,
        padding: '10px 20px',
        fontSize: '13px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        textAlign: 'center',
      }}
    >
      <span style={{
        textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '10px',
        background: 'rgba(255,255,255,0.18)', padding: '2px 8px', borderRadius: '999px',
      }}>Pilot Programme</span>
      <span>{label}</span>
      <span style={{ opacity: 0.85, fontWeight: 500, fontSize: '12px' }}>
        {expired
          ? 'Email info@axle-finance.com to subscribe, or contact your host admin to extend.'
          : 'Subscribe before the pilot ends to keep access without interruption.'}
      </span>
      <a
        href={`mailto:info@axle-finance.com?subject=${subject}&body=${body}`}
        style={{
          color: fg,
          textDecoration: 'underline',
          fontWeight: 700,
          padding: '4px 10px',
          border: `1px solid ${fg}`,
          borderRadius: '6px',
          background: 'rgba(255,255,255,0.08)',
        }}
      >
        Subscribe
      </a>
    </div>
  );
}
