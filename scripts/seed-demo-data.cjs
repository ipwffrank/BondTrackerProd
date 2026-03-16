/**
 * Seed script for demo org (info@axle-finance.com / org_axle-finance_com)
 * Creates phantom users, clients, activities, pipeline deals, and order books.
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   node scripts/seed-demo-data.cjs
 *
 * OR (if firebase CLI is logged in):
 *   node scripts/seed-demo-data.cjs
 */

const admin = require('firebase-admin');

// Initialize with project ID (uses ADC or FIREBASE_SERVICE_ACCOUNT)
if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else {
    admin.initializeApp({ projectId: 'bond-sales-tracker' });
  }
}

const db = admin.firestore();
const ORG_ID = 'org_axle-finance_com';
const ORG_PATH = `organizations/${ORG_ID}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max, decimals = 2) { return parseFloat((Math.random() * (max - min) + min).toFixed(decimals)); }
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randBetween(8, 18), randBetween(0, 59), 0, 0);
  return admin.firestore.Timestamp.fromDate(d);
}

// ─── Phantom Team Members ─────────────────────────────────────────────────────

const TEAM = [
  { name: 'Marcus Chen',     email: 'marcus.chen@axle-finance.com',     role: 'admin',  title: 'Managing Director, Head of Sales' },
  { name: 'Sarah Tan',       email: 'sarah.tan@axle-finance.com',       role: 'user',   title: 'Director, IG Sales' },
  { name: 'James Hartley',   email: 'james.hartley@axle-finance.com',   role: 'user',   title: 'VP, Credit Sales' },
  { name: 'Wei Lin Koh',     email: 'weilin.koh@axle-finance.com',      role: 'user',   title: 'VP, HY Sales' },
  { name: 'Rachel Nguyen',   email: 'rachel.nguyen@axle-finance.com',   role: 'user',   title: 'Associate, Sales' },
  { name: 'David Park',      email: 'david.park@axle-finance.com',      role: 'user',   title: 'Analyst, Sales Support' },
  { name: 'Priya Sharma',    email: 'priya.sharma@axle-finance.com',    role: 'user',   title: 'Director, EMEA Coverage' },
];

// ─── Clients ──────────────────────────────────────────────────────────────────

const CLIENTS = [
  { name: 'GIC Private Limited',         type: 'SOVEREIGN',  region: 'APAC',     salesCoverage: 'Marcus Chen' },
  { name: 'Temasek Holdings',            type: 'SOVEREIGN',  region: 'APAC',     salesCoverage: 'Marcus Chen' },
  { name: 'AIA Group',                   type: 'INSURANCE',  region: 'APAC',     salesCoverage: 'Sarah Tan' },
  { name: 'Manulife Investment Mgmt',    type: 'INSURANCE',  region: 'APAC',     salesCoverage: 'Sarah Tan' },
  { name: 'PIMCO Asia',                  type: 'FUND',       region: 'APAC',     salesCoverage: 'James Hartley' },
  { name: 'BlackRock Asia',              type: 'FUND',       region: 'APAC',     salesCoverage: 'James Hartley' },
  { name: 'Fullerton Fund Mgmt',         type: 'FUND',       region: 'APAC',     salesCoverage: 'Wei Lin Koh' },
  { name: 'Eastspring Investments',      type: 'FUND',       region: 'APAC',     salesCoverage: 'Wei Lin Koh' },
  { name: 'OCBC Bank Treasury',          type: 'BANK',       region: 'APAC',     salesCoverage: 'Rachel Nguyen' },
  { name: 'DBS Asset Management',        type: 'BANK',       region: 'APAC',     salesCoverage: 'Rachel Nguyen' },
  { name: 'Korea Investment Corp',       type: 'SOVEREIGN',  region: 'APAC',     salesCoverage: 'David Park' },
  { name: 'Ping An Asset Management',    type: 'INSURANCE',  region: 'APAC',     salesCoverage: 'Sarah Tan' },
  { name: 'HSBC GAM',                    type: 'FUND',       region: 'EMEA',     salesCoverage: 'Priya Sharma' },
  { name: 'Allianz Global Investors',    type: 'INSURANCE',  region: 'EMEA',     salesCoverage: 'Priya Sharma' },
  { name: 'Abu Dhabi Investment Auth',   type: 'SOVEREIGN',  region: 'EMEA',     salesCoverage: 'Priya Sharma' },
  { name: 'CalPERS',                     type: 'PENSION',    region: 'AMERICAS', salesCoverage: 'James Hartley' },
  { name: 'CPP Investments',             type: 'PENSION',    region: 'AMERICAS', salesCoverage: 'Marcus Chen' },
  { name: 'Fidelity International',      type: 'FUND',       region: 'EMEA',     salesCoverage: 'Priya Sharma' },
];

// ─── Bond universe for activities ─────────────────────────────────────────────

const BONDS = [
  { issuer: 'Republic of Indonesia',  isin: 'USY20721BQ17', ticker: 'INDON',   currency: 'USD' },
  { issuer: 'CNOOC Ltd',              isin: 'USY1662VAN38', ticker: 'CNOOC',   currency: 'USD' },
  { issuer: 'SK Hynix',               isin: 'USY8085FAT60', ticker: 'SKHYNX',  currency: 'USD' },
  { issuer: 'Tencent Holdings',       isin: 'USG8756MAL83', ticker: 'TENCNT',  currency: 'USD' },
  { issuer: 'Alibaba Group',          isin: 'USG0171WAS43', ticker: 'BABA',    currency: 'USD' },
  { issuer: 'DBS Group',              isin: 'SG7Q74970293', ticker: 'DBSSP',   currency: 'SGD' },
  { issuer: 'Temasek Financial I',    isin: 'USY85306AH65', ticker: 'TEMASE',  currency: 'USD' },
  { issuer: 'Korea Development Bank', isin: 'USY4907LAL44', ticker: 'KDB',     currency: 'USD' },
  { issuer: 'CK Hutchison',           isin: 'USG2177BAH26', ticker: 'CKHUTC',  currency: 'USD' },
  { issuer: 'Petronas Capital',       isin: 'USY6883TAC48', ticker: 'PETMK',   currency: 'USD' },
  { issuer: 'Land Transport Auth',    isin: 'SG3260988281', ticker: 'LTASP',   currency: 'SGD' },
  { issuer: 'HDB (Singapore)',        isin: 'SG7R12000002', ticker: 'HDBSP',   currency: 'SGD' },
  { issuer: 'MTR Corporation',        isin: 'HK0066001957', ticker: 'MTRCOR',  currency: 'HKD' },
  { issuer: 'Vedanta Resources',      isin: 'USG9328DAP38', ticker: 'VEDLN',   currency: 'USD' },
  { issuer: 'ICBC Asia',              isin: 'XS2435671294', ticker: 'ICBCAS',  currency: 'CNH' },
];

const ACTIVITY_TYPES = ['Phone Call', 'Email', 'Meeting', 'Bloomberg Chat'];
const DIRECTIONS = ['BUY', 'SELL', 'TWO-WAY'];
const STATUSES = ['ENQUIRY', 'QUOTED', 'EXECUTED', 'PASSED', 'TRADED AWAY'];
const STATUS_WEIGHTS = [0.25, 0.30, 0.20, 0.15, 0.10]; // weighted distribution

function weightedStatus() {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < STATUSES.length; i++) {
    cum += STATUS_WEIGHTS[i];
    if (r <= cum) return STATUSES[i];
  }
  return STATUSES[0];
}

// ─── Pipeline issuers ─────────────────────────────────────────────────────────

const PIPELINE_DEALS = [
  { issuer: 'Republic of Philippines', bookrunners: ['JPM', 'HSBC', 'SCB'], tranches: [
    { tenor: '5Y', currency: 'USD', targetSize: 1500, internalTargetSize: 25 },
    { tenor: '10Y', currency: 'USD', targetSize: 2000, internalTargetSize: 35 },
  ]},
  { issuer: 'Lenovo Group', bookrunners: ['GS', 'HSBC'], tranches: [
    { tenor: '3Y', currency: 'USD', targetSize: 500, internalTargetSize: 15 },
    { tenor: '5Y', currency: 'USD', targetSize: 750, internalTargetSize: 20 },
  ]},
  { issuer: 'China Vanke Co', bookrunners: ['HSBC', 'SCB', 'BOCHK'], tranches: [
    { tenor: '3Y', currency: 'USD', targetSize: 400, internalTargetSize: 10 },
  ]},
  { issuer: 'Malaysia Sovereign Sukuk', bookrunners: ['HSBC', 'SCB'], tranches: [
    { tenor: '5Y', currency: 'USD', targetSize: 1000, internalTargetSize: 20 },
    { tenor: '10Y', currency: 'USD', targetSize: 1500, internalTargetSize: 30 },
  ]},
  { issuer: 'KEPCO (Korea Electric)', bookrunners: ['JPM', 'MS', 'GS'], tranches: [
    { tenor: '3Y', currency: 'USD', targetSize: 600, internalTargetSize: 15 },
    { tenor: '7Y', currency: 'USD', targetSize: 800, internalTargetSize: 20 },
  ]},
  { issuer: 'Swire Properties', bookrunners: ['HSBC', 'GS'], tranches: [
    { tenor: '5Y', currency: 'USD', targetSize: 500, internalTargetSize: 12 },
  ]},
  { issuer: 'Bank of China (HK)', bookrunners: ['BOCHK', 'HSBC', 'JPM'], tranches: [
    { tenor: '3Y', currency: 'USD', targetSize: 800, internalTargetSize: 18 },
    { tenor: '5Y', currency: 'USD', targetSize: 1000, internalTargetSize: 25 },
    { tenor: '10Y', currency: 'USD', targetSize: 500, internalTargetSize: 10 },
  ]},
  { issuer: 'Singtel Group Treasury', bookrunners: ['SCB', 'HSBC'], tranches: [
    { tenor: '5Y', currency: 'SGD', targetSize: 500, internalTargetSize: 15 },
    { tenor: '10Y', currency: 'SGD', targetSize: 300, internalTargetSize: 8 },
  ]},
];

// ─── Seed Functions ───────────────────────────────────────────────────────────

async function seedOrg() {
  console.log('Ensuring demo organization exists...');
  const orgRef = db.doc(ORG_PATH);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    await orgRef.set({
      name: 'Axle Finance (Demo)',
      domain: 'axle-finance.com',
      plan: 'professional',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      userCount: TEAM.length + 1,
      adminCount: 2,
    });
    console.log('  Created organization');
  } else {
    // Update plan to professional for demo
    await orgRef.update({ plan: 'professional' });
    console.log('  Organization exists, ensured professional plan');
  }
}

async function seedTeam() {
  console.log('Seeding phantom team members...');
  const batch = db.batch();
  for (const member of TEAM) {
    const fakeUid = `demo_${member.email.split('@')[0].replace(/\./g, '_')}`;
    // Org sub-collection user doc
    const userRef = db.doc(`${ORG_PATH}/users/${fakeUid}`);
    batch.set(userRef, {
      email: member.email,
      name: member.name,
      organizationId: ORG_ID,
      organizationName: 'axle-finance.com',
      isAdmin: member.role === 'admin',
      role: member.role,
      createdAt: daysAgo(randBetween(60, 120)),
      lastLogin: daysAgo(randBetween(0, 3)),
      phantom: true, // flag so we can clean up later
    }, { merge: true });
    // Root-level user mapping
    const mappingRef = db.doc(`users/${fakeUid}`);
    batch.set(mappingRef, {
      organizationId: ORG_ID,
      email: member.email,
      name: member.name,
      isAdmin: member.role === 'admin',
      role: member.role,
      createdAt: daysAgo(90),
      phantom: true,
    }, { merge: true });
  }
  await batch.commit();
  console.log(`  Created ${TEAM.length} team members`);
}

async function seedClients() {
  console.log('Seeding clients...');
  // Check existing clients to avoid duplicates
  const existingSnap = await db.collection(`${ORG_PATH}/clients`).get();
  const existingNames = new Set(existingSnap.docs.map(d => d.data().name?.toLowerCase()));

  const batch = db.batch();
  let count = 0;
  for (const client of CLIENTS) {
    if (existingNames.has(client.name.toLowerCase())) {
      console.log(`  Skipping existing client: ${client.name}`);
      continue;
    }
    const ref = db.collection(`${ORG_PATH}/clients`).doc();
    batch.set(ref, {
      name: client.name,
      type: client.type,
      region: client.region,
      salesCoverage: client.salesCoverage,
      createdAt: daysAgo(randBetween(30, 90)),
      createdBy: pick(TEAM.slice(0, 3)).name,
    });
    count++;
  }
  await batch.commit();
  console.log(`  Created ${count} clients`);
}

async function seedActivities() {
  console.log('Seeding activities...');
  const TOTAL = 75;
  // Write in batches of 25
  for (let batchStart = 0; batchStart < TOTAL; batchStart += 25) {
    const batch = db.batch();
    const batchEnd = Math.min(batchStart + 25, TOTAL);
    for (let i = batchStart; i < batchEnd; i++) {
      const client = pick(CLIENTS);
      const bond = pick(BONDS);
      const member = pick(TEAM);
      const direction = pick(DIRECTIONS);
      const status = weightedStatus();
      const size = pick([1, 2, 3, 5, 5, 10, 10, 15, 20, 25, 50]);
      const hasPrice = status === 'EXECUTED' || status === 'QUOTED' || Math.random() > 0.4;
      const price = hasPrice ? randFloat(95.5, 105.0, 3) : null;

      const notes = pick([
        '', '', '',
        'Client looking to add duration',
        'Relative value trade vs sovereign',
        'Needs approval from IC',
        'Comp vs secondary levels',
        'Block trade enquiry',
        'Client has axe to work',
        'Follow up from morning call',
        'Pricing update sent via BBG',
        'Will circle back after IC meeting',
        'Client interested post new issue',
        'Working order, will confirm EOD',
      ]);

      const ref = db.collection(`${ORG_PATH}/activities`).doc();
      batch.set(ref, {
        clientName: client.name,
        clientType: client.type,
        clientRegion: client.region,
        salesCoverage: client.salesCoverage,
        activityType: pick(ACTIVITY_TYPES),
        isin: Math.random() > 0.3 ? bond.isin : '',
        ticker: Math.random() > 0.3 ? bond.ticker : '',
        size: size,
        currency: bond.currency,
        price: price,
        direction: direction,
        status: status,
        notes: notes,
        createdAt: daysAgo(randBetween(0, 30)),
        createdBy: member.name,
      });
    }
    await batch.commit();
  }
  console.log(`  Created ${TOTAL} activities`);
}

async function seedPipeline() {
  console.log('Seeding pipeline deals...');
  // Check existing to avoid duplicates
  const existingSnap = await db.collection(`${ORG_PATH}/newIssues`).get();
  const existingIssuers = new Set(existingSnap.docs.map(d => d.data().issuerName?.toLowerCase()));

  const issueIds = [];
  const batch = db.batch();
  let count = 0;

  for (const deal of PIPELINE_DEALS) {
    if (existingIssuers.has(deal.issuer.toLowerCase())) {
      console.log(`  Skipping existing issue: ${deal.issuer}`);
      // Still need the ID for order books
      const existing = existingSnap.docs.find(d => d.data().issuerName?.toLowerCase() === deal.issuer.toLowerCase());
      if (existing) issueIds.push({ id: existing.id, ...deal });
      continue;
    }
    const ref = db.collection(`${ORG_PATH}/newIssues`).doc();
    const tranches = deal.tranches.map((t, idx) => ({
      id: `t-${idx}`,
      ...t,
    }));
    batch.set(ref, {
      issuerName: deal.issuer,
      bookrunners: deal.bookrunners,
      tranches: tranches,
      createdAt: daysAgo(randBetween(1, 14)),
      createdBy: pick(TEAM.slice(0, 4)).name,
    });
    issueIds.push({ id: ref.id, ...deal });
    count++;
  }
  await batch.commit();
  console.log(`  Created ${count} pipeline deals`);
  return issueIds;
}

async function seedOrderBooks(issueIds) {
  console.log('Seeding order books...');
  // Check existing
  const existingSnap = await db.collection(`${ORG_PATH}/orderBooks`).get();
  if (existingSnap.size > 10) {
    console.log(`  Already ${existingSnap.size} orders, skipping`);
    return;
  }

  const batch = db.batch();
  let count = 0;

  // Create 3-6 orders per deal (first 5 deals only, to keep it realistic)
  const dealsToOrder = issueIds.slice(0, 5);
  for (const deal of dealsToOrder) {
    const tranche = deal.tranches[0]; // order into first tranche
    const numOrders = randBetween(3, 6);
    const orderedClients = [...CLIENTS].sort(() => Math.random() - 0.5).slice(0, numOrders);

    for (const client of orderedClients) {
      const ref = db.collection(`${ORG_PATH}/orderBooks`).doc();
      const orderSize = pick([2, 3, 5, 5, 10, 10, 15, 20]);
      batch.set(ref, {
        issueId: deal.id,
        issuerName: deal.issuer,
        trancheId: 't-0',
        trancheTenor: tranche.tenor,
        trancheCurrency: tranche.currency,
        clientName: client.name,
        orderSize: orderSize,
        orderLimit: Math.random() > 0.5 ? `T+${pick([80, 90, 100, 110, 120])}` : '',
        notes: pick(['', '', 'Subject to IC approval', 'Firm order', 'Soft interest', '']),
        createdAt: daysAgo(randBetween(0, 7)),
        createdBy: pick(TEAM).name,
      });
      count++;
    }
  }
  await batch.commit();
  console.log(`  Created ${count} order book entries`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Axle Demo Data Seeder                   ║');
  console.log('║  Org: org_axle-finance_com                ║');
  console.log('╚══════════════════════════════════════════╝\n');

  try {
    await seedOrg();
    await seedTeam();
    await seedClients();
    await seedActivities();
    const issueIds = await seedPipeline();
    await seedOrderBooks(issueIds);

    console.log('\n✅ Demo data seeded successfully!');
    console.log('   Log in with info@axle-finance.com to see the data.');
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    console.error(err);
  }

  process.exit(0);
}

main();
