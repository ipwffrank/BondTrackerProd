# Axle — Progress Log

Running notes of what shipped, what's pending, and context future-you (or
future-Claude) will need. Newest first.

---

## 2026-04-22 — Security pass, Dashboard, sales scope, font swap

Long session. Prod is meaningfully tighter than it was yesterday — critical
server-side auth bypasses are closed, Firestore rules enforce per-sales
visibility, and the product grew a real dashboard.

### Repo moves (do not undo)

- **Main Axle** moved from `~/Desktop/projects/axle/BondTrackerProd` →
  `~/code/axle/BondTrackerProd`. OneDrive sync had offloaded a 800 KB git
  pack file to the cloud and git operations were timing out.
- **Admin portal** moved `~/Desktop/Projects/Axle/bondtracker-admin` →
  `~/code/axle/bondtracker-admin` for the same reason.
- **Bookingcrm / GlowOS** moved `~/Desktop/Projects/Bookingcrm` →
  `~/code/Bookingcrm` — worktree repaired with `git worktree repair`.
- New clone procedure if you ever nuke local: `git clone` fresh into
  `~/code/`, copy `.env` back from a safe location. GitHub has
  everything.
- Disk was 94% full; cleanup (dev caches + Claude Desktop vm_bundles +
  macOS wallpapers + stale node_modules) freed ~23 GB → 36 GB free.

### Shipped to prod — main Axle (`axle-finance.com`)

Commits in order, all on `main`:

| # | Commit | What |
|---|--------|------|
| 1 | `1bf8bdb` | Security pass: real `verifyIdToken` on `analyze-transcript` (was only checking Bearer prefix — attackers could drain OpenAI key); auth + rate limit on `bloomberg-lookup`; cross-org protection on `delete-user-data`; HTML escaping in `send-invite` / `notify-demo-request` / `contact-us`; rate limit on `password-changed-notify`; CSV formula-injection sanitizer on exports; `serverTimestamp()` instead of `new Date()` in services; file-size caps on AI uploads; Signup redirect `/dashboard` → `/activities`; AcceptInvite SSO now checks invited email matches; password min 6 → 8. Firestore rules: closed self-update privilege escalation, tightened invitation read/update, artifacts ownerId check. |
| 2 | `d799cec` | Sidebar rename + reorder + emoji removal across all routed pages. Labels: Trade Activities, New Issue Pipeline, Clients Mapping, Client Contacts, AI Script Reader, Analytics, Admin. Scrubbed console.log emojis in AuthContext. |
| 3 | `28d7d99` | Dropped Client Contacts from sidebar (Option A minimal); added CSV contacts import with Download Template + dedup by email/name. Entry point remains the per-row "Contacts" button on Clients Mapping. |
| 4 | `6a9a2ca` | Rule gap: host admins couldn't write to `/organizations/{orgId}/users/{uid}` — fixed so admin portal Save Changes works on users in other orgs. |
| 5 | `8fefc62` | Built Dashboard page; replaced the unrouted 2121-line stub. 5 stat cards (Enquiries, Executed Volume, Avg Ticket, Conversion, Active Clients) + Direction Breakdown + Most Active Bonds + Top Clients panels. Time range: Week/Month/3M/YTD. Landing page after login now `/dashboard`. |
| 6 | `4ff367e` | Secondary (backup) sales coverage: `salesCoverageSecondary` on clients; activity writes stamp `coverageUsers: [primary, secondary]`; Dashboard scope unions both; CSV 5th column + all exports. Backfill script `scripts/backfill-activity-coverage.cjs` shipped (not run yet at this point). |
| 7 | `b5832ee` | Ran `scripts/backfill-activity-coverage.cjs` in prod — 86/86 activities updated, 0 orphans. Then tightened Firestore activity-read rule: non-admins must have their name in `coverageUsers`. Admin-aware queries in Activities, Dashboard, Analytics (non-admins add `where('coverageUsers', 'array-contains', myName)`). Composite index deployed. |
| 8 | `5589d45` | Fix: "Enquiries" stat counted only non-executed activities; corrected to all activities (desk convention). Conversion rate numerator unchanged. |
| 9 | `a231f38` | Dashboard card order + rename: Enquiries → Executed Volume → Avg Ticket Size → Conversion Rate → Active Clients. "Total Trades Volume" renamed "Executed Volume" (more accurate). |
| 10 | `e6a0bef` | Analytics "Total Trades Volume" renamed "Total Notional" to disambiguate from Dashboard's Executed Volume. |
| 11 | `e91996e` | Analytics stat cards: fixed overflow (long values like `$1232.50MM` broke out) via length-based font scaling 26→15 px; grid switched to auto-fit wrap so Conversion Rate no longer clips on narrower viewports. |
| 12 | `9f2a77e` | Typography: swapped Outfit + Sora for Manrope across the app (17 files). Kept JetBrains Mono for bond tickers / ISINs. |

### Shipped to prod — admin portal (`admin.axle-finance.com`)

| # | Commit | What |
|---|--------|------|
| 1 | `18e5c88` | Host-admin deactivate/reactivate user feature: `set-user-active.cjs` netlify function (verifies host-admin, flips Firebase Auth `disabled`, revokes refresh tokens, mirrors `deactivated` + `deactivatedAt` + `deactivatedBy` on both root and org user docs, writes audit log). UI: deactivated badge on list rows, red callout in drawer, Deactivate/Reactivate button, Status filter. |
| 2 | `4ed6491` | Manrope font swap matching main app (16 files). |

### Deployed manually outside CI

- `firebase deploy --only firestore:rules` — three times:
  1. Initial security hardening (self-update + invitation scoping + artifacts)
  2. Added host-admin branches on org user sub-collection
  3. V2: activity read requires `coverageUsers.hasAny([name])` for non-admins
- `firebase deploy --only firestore:indexes` — added composite index for
  `activities: coverageUsers (array-contains) + createdAt (desc)`

### One-time data operations run today

- Backfill `scripts/backfill-activity-coverage.cjs` — dry-run first, then
  for real. Result: **86 activities updated across 4 orgs, 0 missing
  clients**.

### Credentials / keys

- Downloaded service-account JSON to run the backfill; now at
  `~/axle-sa.json` (mode 600, not in OneDrive, not in git).
- Delete with `rm ~/axle-sa.json` when you're not using it for admin
  scripts. Regenerate via Firebase Console → Project Settings → Service
  Accounts if needed.

### Pending / deferred (not done today)

- **UI smoke test of the V2 scope:** log in as a non-admin sales user
  with coverage assigned to a subset of clients, verify Dashboard +
  Activities + Analytics only show their coverage. Log in as one with
  no coverage, verify empty-state prompt fires.
- **Full master-detail rewrite of Clients Mapping** with
  Overview / Contacts / Activity tabs in a right panel. This session
  shipped only the minimal Option A (sidebar consolidation + per-client
  CSV). Multi-day rewrite.
- **Cross-client contacts CSV** (one file covering many clients, resolve
  by clientName) + column-mapping wizard for arbitrary CRM exports.
- **Dead code cleanup:** `src/pages/backup/*` (stale copies not routed).
  Emojis still live there — not shipped, but worth deleting for
  hygiene.
- **`eslint.config.js` is still broken** (`@eslint/js` flat-config import
  errors). `npm run lint` fails. Build is unaffected.
- **Bundle size warning:** main chunk is ~1.93 MB. Chunk-splitting via
  `build.rollupOptions.output.manualChunks` would help.
- **Bondtracker-admin netlify functions** (`host-reset-password.cjs`,
  `lookup-user.cjs`, `send-maintenance-email.cjs`) still don't verify
  tokens — same bug class I fixed in main. They're behind an auth'd UI
  but the URLs are reachable directly.
- **`twilio_2FA_recovery_code.txt`** at the top of Bookingcrm repo —
  move to a password manager, delete from disk. Recovery codes
  shouldn't live in a git-tracked directory.
- **V2-of-V2 refinements** if we ever want them: signed "I'm out of
  office" coverage handoff; coverage change triggers an activity
  backfill; rule-level denormalization on other collections (pipeline,
  clientFeedback) if sales should only see their scope there too.

### Gotchas future-me will forget

- Dashboard client-side scope filter is now redundant with the
  Firestore rule, but kept as defense-in-depth. If you ever remove it,
  remember that activity `coverageUsers` is frozen at write time — a
  client's coverage changing does NOT retroactively update existing
  activities until someone reruns the backfill script.
- User NAMES are the scope key, not UIDs. If a sales user renames
  themselves, they lose visibility on their historical coverage until
  re-backfill. Known limitation of denormalization — same in Dashboard
  client filter.
- The scope rule allows read for admins OR host admins OR
  coverageUsers-membership. If an org has NO admins for some reason and
  activities have empty coverageUsers, only host admins can read them.
- Non-admin queries MUST include
  `where('coverageUsers', 'array-contains', name)` or Firestore rejects
  with "missing or insufficient permissions". Three query sites were
  updated today (Activities, Dashboard, Analytics); any future sites
  querying activities need the same pattern.
- `tmutil thinlocalsnapshots` showed no snapshots to thin after the
  disk cleanup, so the 2-3 GB that was "reserved" by APFS wasn't Time
  Machine snapshots — it's something else (maybe purgeable space), and
  the 2 GB delta between `du` and `df` is the usual APFS noise.

---

<!-- Older sessions go below this line when they happen. -->
