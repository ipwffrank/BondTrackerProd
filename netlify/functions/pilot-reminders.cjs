/**
 * Daily scheduled function: emails pilot-org admins at fixed milestones
 * before / on / after the pilot end date.
 *
 * Schedule: daily at 01:00 UTC (= 09:00 Singapore, the primary user TZ).
 *
 * Milestones (one email per milestone per pilot window — dedupe via
 * pilotRemindersSent map on the org doc):
 *   14d before, 7d before, 3d before, day-of, expired (1 day after)
 *
 * Recipients: every user in the org with isAdmin=true. If no admins
 * are found, falls back to logging a warning (the org is in a weird
 * state and someone should look — host admin sees the org and can
 * intervene).
 *
 * Resetting reminders on extend: when a host admin extends a pilot
 * the admin portal clears pilotRemindersSent so the next window
 * earns its own series of emails.
 */

const admin = require('firebase-admin');
const { Resend } = require('resend');
const { getCorsHeaders, handlePreflight } = require('./utils/cors');

if (!admin.apps.length) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT env var missing — pilot reminders cannot run.');
  }
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}

// Earlier-first so we send the LARGEST applicable bucket today (e.g. day 14
// hits the 14d bucket, not the 7d bucket).
const MILESTONES = [
  { key: '14d',     daysFromEnd:  14, headline: 'Your Axle pilot ends in 2 weeks' },
  { key: '7d',      daysFromEnd:   7, headline: 'Your Axle pilot ends in 1 week' },
  { key: '3d',      daysFromEnd:   3, headline: 'Your Axle pilot ends in 3 days' },
  { key: 'day_of',  daysFromEnd:   0, headline: 'Your Axle pilot ends today' },
  { key: 'expired', daysFromEnd:  -1, headline: 'Your Axle pilot has ended' },
];

function escapeHtml(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(d) {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Days between two dates, ignoring time-of-day. Negative if endAt is past.
function daysToEnd(endAt, now) {
  const dayMs = 86_400_000;
  const startOfEnd = new Date(endAt); startOfEnd.setUTCHours(0, 0, 0, 0);
  const startOfNow = new Date(now);   startOfNow.setUTCHours(0, 0, 0, 0);
  return Math.round((startOfEnd.getTime() - startOfNow.getTime()) / dayMs);
}

function pickMilestone(days, alreadySent) {
  // Pick the first milestone whose threshold matches today's days-to-end
  // AND hasn't been sent yet. Earlier-first so a long-overdue org doesn't
  // get spammed with every milestone in one run — only "expired" fires
  // once it's past the deadline.
  for (const m of MILESTONES) {
    if (alreadySent && alreadySent[m.key]) continue;
    if (m.key === 'expired') {
      if (days <= -1) return m;
    } else {
      if (days === m.daysFromEnd) return m;
    }
  }
  return null;
}

function emailHtml({ orgName, milestone, endAtStr, daysLeft, contactName }) {
  const isExpired = milestone.key === 'expired';
  const headerBg = isExpired ? '#7f1d1d' : milestone.key === '3d' || milestone.key === 'day_of' ? '#9a3412' : '#0F2137';
  const cta = encodeURIComponent(`Subscribe to Axle — ${orgName}`);
  const ctaBody = encodeURIComponent(
    `Hi Axle team,\n\nWe'd like to subscribe to Axle.\n\nOrganisation: ${orgName}\nPilot ends: ${endAtStr}\n\nThanks.`,
  );
  const subscribeHref = `mailto:info@axle-finance.com?subject=${cta}&body=${ctaBody}`;

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Manrope',Arial,sans-serif;color:#1e293b;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:${headerBg};color:#f8fafc;padding:24px 28px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;opacity:0.85;margin-bottom:6px;">Axle · Pilot Programme</div>
      <div style="font-size:20px;font-weight:700;line-height:1.3;">${escapeHtml(milestone.headline)}</div>
    </div>
    <div style="padding:24px 28px;font-size:14px;line-height:1.6;color:#334155;">
      <p style="margin:0 0 14px;">Hi${contactName ? ' ' + escapeHtml(contactName) : ''},</p>
      ${isExpired ? `
        <p style="margin:0 0 14px;">The pilot programme for <strong>${escapeHtml(orgName)}</strong> ended on <strong>${escapeHtml(endAtStr)}</strong>. To keep your team's access uninterrupted, please reply to this email or contact us at <a href="mailto:info@axle-finance.com" style="color:#C8A258;font-weight:600;">info@axle-finance.com</a> to set up a subscription.</p>
        <p style="margin:0 0 18px;">If you'd like more time on the pilot before deciding, your host admin can extend it for you.</p>
      ` : `
        <p style="margin:0 0 14px;">The pilot programme for <strong>${escapeHtml(orgName)}</strong> is scheduled to end on <strong>${escapeHtml(endAtStr)}</strong> — that's <strong>${daysLeft === 0 ? 'today' : daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ' from now'}</strong>.</p>
        <p style="margin:0 0 18px;">To keep your team on Axle without interruption, please reply to this email or write to <a href="mailto:info@axle-finance.com" style="color:#C8A258;font-weight:600;">info@axle-finance.com</a> to start a subscription. If you need more time, ask your host admin to extend the pilot.</p>
      `}
      <p style="margin:0 0 18px;text-align:center;">
        <a href="${subscribeHref}" style="display:inline-block;background:#C8A258;color:#0F2137;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:700;font-size:14px;">Email us to subscribe</a>
      </p>
      <p style="margin:0;font-size:12px;color:#64748b;">You're receiving this because you're an admin on the <strong>${escapeHtml(orgName)}</strong> Axle workspace.</p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 28px;font-size:11px;color:#94a3b8;text-align:center;">
      Axle &middot; ZHOOZH PTE. LTD. &middot; <a href="https://axle-finance.com" style="color:#94a3b8;">axle-finance.com</a>
    </div>
  </div>
</body></html>`;
}

async function getOrgAdmins(db, orgId) {
  // Read both the root /users collection (filtered by organizationId)
  // and the org sub-collection so we don't miss admins indexed in only
  // one place. De-dupe by email.
  const out = new Map();
  try {
    const rootSnap = await db.collection('users').where('organizationId', '==', orgId).get();
    for (const d of rootSnap.docs) {
      const u = d.data();
      if (u.isAdmin && u.email) out.set(u.email.toLowerCase(), { email: u.email, name: u.name || '' });
    }
  } catch (_) { /* ignore */ }
  try {
    const subSnap = await db.collection('organizations').doc(orgId).collection('users').get();
    for (const d of subSnap.docs) {
      const u = d.data();
      if (u.isAdmin && u.email) out.set(u.email.toLowerCase(), { email: u.email, name: u.name || '' });
    }
  } catch (_) { /* ignore */ }
  return [...out.values()];
}

async function processOrg({ db, resend, orgDoc, now }) {
  const data = orgDoc.data() || {};
  const endAt = data.pilotEndAt?.toDate ? data.pilotEndAt.toDate() : null;
  if (!endAt) return { skipped: 'no-pilot' };

  // Skip org if pilot has been deactivated (no pilotStatus + endAt set
  // shouldn't happen, but defensively keep going on either signal).
  const days = daysToEnd(endAt, now);
  const milestone = pickMilestone(days, data.pilotRemindersSent || {});
  if (!milestone) return { skipped: `no-milestone-today (days=${days})` };

  const admins = await getOrgAdmins(db, orgDoc.id);
  if (admins.length === 0) {
    console.warn(`[pilot-reminders] org ${orgDoc.id} has no admins — skipping`);
    return { skipped: 'no-admins' };
  }

  const orgName = data.name || data.domain || orgDoc.id;
  const html = emailHtml({
    orgName,
    milestone,
    endAtStr: fmtDate(endAt),
    daysLeft: Math.max(0, days),
    contactName: admins.length === 1 ? admins[0].name : '',
  });

  const recipients = admins.map(a => a.email);
  await resend.emails.send({
    from: 'Axle <info@axle-finance.com>',
    to: recipients,
    subject: milestone.headline + ` (${orgName})`,
    html,
  });

  // Mark this milestone as sent so tomorrow's run doesn't re-send.
  await orgDoc.ref.update({
    [`pilotRemindersSent.${milestone.key}`]: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { sent: { milestone: milestone.key, recipients: recipients.length } };
}

async function runReminders() {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY env var missing' };
  }
  const db = admin.firestore();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const now = new Date();

  const snap = await db.collection('organizations').get();
  const results = [];
  for (const orgDoc of snap.docs) {
    if (!orgDoc.data()?.pilotEndAt) continue;
    try {
      const r = await processOrg({ db, resend, orgDoc, now });
      results.push({ orgId: orgDoc.id, ...r });
    } catch (e) {
      console.error(`[pilot-reminders] org ${orgDoc.id} failed:`, e);
      results.push({ orgId: orgDoc.id, error: e.message });
    }
  }

  return { ok: true, processed: results.length, results };
}

exports.handler = async (event) => {
  // Manual trigger via HTTP also works, gated to host admins. Useful for
  // smoke-testing without waiting 24h, and for the "Run reminders now"
  // button on the admin portal Organizations page. Scheduled invocations
  // have no event.httpMethod, so the auth + CORS path is bypassed there.
  const isHttp = !!(event && event.httpMethod);
  const origin = event?.headers?.origin || '';
  const corsHeaders = isHttp ? getCorsHeaders(origin) : {};

  if (isHttp) {
    const preflight = handlePreflight(event, corsHeaders);
    if (preflight) return preflight;

    const authHeader = event.headers?.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Missing auth token' }) };
    }
    try {
      const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
      const hostDoc = await admin.firestore().collection('hostAdmins').doc(decoded.uid).get();
      if (!hostDoc.exists) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Host admin only' }) };
      }
    } catch (err) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
  }

  const result = await runReminders();
  console.log('[pilot-reminders]', JSON.stringify(result));
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };
};

// Netlify daily cron at 01:00 UTC (~09:00 SGT). Adjust if needed.
exports.config = { schedule: '0 1 * * *' };
