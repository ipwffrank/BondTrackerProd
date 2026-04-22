#!/usr/bin/env node
/**
 * One-off backfill: walk every activity in every org and write
 * `coverageUsers: [primary, secondary]` (+ mirror salesCoverageSecondary)
 * based on the current client's coverage fields.
 *
 * Run ONCE after deploying the "secondary sales coverage" feature, BEFORE
 * tightening Firestore rules to require coverageUsers membership. Rerunning
 * is safe — it upserts.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *     node scripts/backfill-activity-coverage.cjs
 *
 * Or, if you already have a service-account JSON string in
 * FIREBASE_SERVICE_ACCOUNT (same env var the Netlify functions use), you can
 * point at that file instead:
 *   FIREBASE_SERVICE_ACCOUNT_FILE=/path/to/serviceAccount.json \
 *     node scripts/backfill-activity-coverage.cjs
 *
 * Flags:
 *   --dry-run    Print counts but don't write (always run this first)
 *   --org=ORGID  Limit to a single org (default: all orgs)
 */

const fs = require('fs');
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const ORG_ARG = args.find(a => a.startsWith('--org='));
const ONLY_ORG = ORG_ARG ? ORG_ARG.split('=')[1] : null;

function initAdmin() {
  if (admin.apps.length) return;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
    return;
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_FILE) {
    const creds = JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(creds) });
    return;
  }
  // Falls back to GOOGLE_APPLICATION_CREDENTIALS / gcloud ADC
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

async function run() {
  initAdmin();
  const db = admin.firestore();

  const orgsSnap = ONLY_ORG
    ? { docs: [await db.collection('organizations').doc(ONLY_ORG).get()] }
    : await db.collection('organizations').get();

  let totalActivities = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalMissingClient = 0;

  for (const orgDoc of orgsSnap.docs) {
    if (!orgDoc.exists) continue;
    const orgId = orgDoc.id;
    console.log(`\n[org=${orgId}]`);

    // Build name -> {primary, secondary} lookup from clients collection
    const clientsSnap = await db.collection('organizations').doc(orgId).collection('clients').get();
    const coverageByClientLower = new Map();
    for (const c of clientsSnap.docs) {
      const d = c.data();
      const name = (d.name || '').trim().toLowerCase();
      if (!name) continue;
      coverageByClientLower.set(name, {
        primary: (d.salesCoverage || '').trim(),
        secondary: (d.salesCoverageSecondary || '').trim(),
      });
    }
    console.log(`  clients: ${clientsSnap.size}`);

    // Walk activities, update in batches of 400 (Firestore batch limit = 500)
    const actsSnap = await db.collection('organizations').doc(orgId).collection('activities').get();
    console.log(`  activities: ${actsSnap.size}`);
    totalActivities += actsSnap.size;

    let batch = db.batch();
    let opsInBatch = 0;
    let updatedHere = 0;
    let skippedHere = 0;
    let missingClientHere = 0;

    for (const actDoc of actsSnap.docs) {
      const a = actDoc.data();
      const clientKey = (a.clientName || '').trim().toLowerCase();
      const cov = coverageByClientLower.get(clientKey);
      if (!cov) {
        missingClientHere++;
        continue;
      }
      const coverageUsers = [cov.primary, cov.secondary].filter(Boolean);

      // Idempotency: skip if nothing would actually change
      const current = Array.isArray(a.coverageUsers) ? a.coverageUsers : [];
      const sameArr = current.length === coverageUsers.length && current.every((v, i) => v === coverageUsers[i]);
      const sameSecondary = (a.salesCoverageSecondary || '') === (cov.secondary || '');
      const samePrimary = (a.salesCoverage || '') === (cov.primary || '');
      if (sameArr && sameSecondary && samePrimary) {
        skippedHere++;
        continue;
      }

      if (!DRY) {
        batch.update(actDoc.ref, {
          salesCoverage: cov.primary,
          salesCoverageSecondary: cov.secondary,
          coverageUsers,
        });
        opsInBatch++;
        if (opsInBatch >= 400) {
          await batch.commit();
          batch = db.batch();
          opsInBatch = 0;
        }
      }
      updatedHere++;
    }

    if (!DRY && opsInBatch > 0) await batch.commit();

    console.log(`  ${DRY ? '[dry] ' : ''}updated=${updatedHere}  skipped(already ok)=${skippedHere}  missing-client=${missingClientHere}`);
    totalUpdated += updatedHere;
    totalSkipped += skippedHere;
    totalMissingClient += missingClientHere;
  }

  console.log('\n=== summary ===');
  console.log(`activities scanned: ${totalActivities}`);
  console.log(`${DRY ? 'would update' : 'updated'}: ${totalUpdated}`);
  console.log(`already consistent: ${totalSkipped}`);
  console.log(`missing client record: ${totalMissingClient}`);
  if (DRY) console.log('\n(dry-run — no writes performed. Re-run without --dry-run to apply.)');
}

run().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
