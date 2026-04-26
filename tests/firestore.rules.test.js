/**
 * Firestore-rules unit tests, run against the local emulator.
 *
 * Run via:  npm run test:rules
 * (which boots `firebase emulators:exec` around `vitest run`)
 *
 * Covered invariants — anything that, if regressed, would unlock
 * cross-org or cross-role data:
 *   1. Cross-org read isolation on activities, clients, users
 *   2. /users/{uid} self-update CANNOT change isAdmin / organizationId
 *   3. /organizations/{orgId} pilot fields can only be written by host admins
 *   4. activity reads enforce the coverageUsers scope for non-admins
 *   5. invitations cannot be enumerated across orgs by non-members
 *
 * Each test seeds data via the privileged context (rules bypassed) and
 * asserts behaviour against a non-privileged authed context.
 */

import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

const PROJECT_ID = 'axle-rules-test';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  if (env) await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

// Helpers — seed via privileged context (rules disabled), then test.
async function seed(fn) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });
}

function authedDb(uid, claims = {}) {
  return env.authenticatedContext(uid, claims).firestore();
}

function unauthedDb() {
  return env.unauthenticatedContext().firestore();
}

// Standard fixture: two orgs, an admin in each, a non-admin in orgA, a host admin.
async function seedTwoOrgs() {
  await seed(async (db) => {
    // Root /users docs (these are what getUserData() in rules reads)
    await setDoc(doc(db, 'users/adminA'), { email: 'a-admin@a.com', name: 'Admin A', organizationId: 'orgA', isAdmin: true, role: 'admin' });
    await setDoc(doc(db, 'users/userA'),  { email: 'a-user@a.com',  name: 'User A',  organizationId: 'orgA', isAdmin: false, role: 'user' });
    await setDoc(doc(db, 'users/adminB'), { email: 'b-admin@b.com', name: 'Admin B', organizationId: 'orgB', isAdmin: true, role: 'admin' });
    await setDoc(doc(db, 'users/userB'),  { email: 'b-user@b.com',  name: 'User B',  organizationId: 'orgB', isAdmin: false, role: 'user' });
    await setDoc(doc(db, 'users/host1'),  { email: 'host@axle.com', name: 'Host',    organizationId: 'orgA', isAdmin: false, role: 'user' });
    await setDoc(doc(db, 'hostAdmins/host1'), { addedAt: Timestamp.now() });

    // Org docs
    await setDoc(doc(db, 'organizations/orgA'), { name: 'Org A', plan: 'essential', maxUsers: 5 });
    await setDoc(doc(db, 'organizations/orgB'), { name: 'Org B', plan: 'essential', maxUsers: 5 });

    // A client in each org
    await setDoc(doc(db, 'organizations/orgA/clients/c1'), { name: 'Client A1', salesCoverage: 'User A' });
    await setDoc(doc(db, 'organizations/orgB/clients/c2'), { name: 'Client B1', salesCoverage: 'User B' });

    // Activities: one in orgA covered by User A, one in orgA covered by no one
    await setDoc(doc(db, 'organizations/orgA/activities/a-covered'), {
      clientName: 'Client A1', size: 10, direction: 'BUY', status: 'EXECUTED',
      coverageUsers: ['User A'], createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'organizations/orgA/activities/a-other'), {
      clientName: 'Other Client', size: 5, direction: 'SELL', status: 'ENQUIRY',
      coverageUsers: ['Someone Else'], createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'organizations/orgB/activities/b1'), {
      clientName: 'Client B1', size: 20, direction: 'BUY', status: 'EXECUTED',
      coverageUsers: ['User B'], createdAt: Timestamp.now(),
    });
  });
}

// ─── 1. Cross-org read isolation ─────────────────────────────────────────
describe('cross-org isolation', () => {
  it('orgA member cannot read an orgB client', async () => {
    await seedTwoOrgs();
    const db = authedDb('adminA');
    await assertFails(getDoc(doc(db, 'organizations/orgB/clients/c2')));
  });

  it('orgA member cannot read an orgB activity', async () => {
    await seedTwoOrgs();
    const db = authedDb('userA');
    await assertFails(getDoc(doc(db, 'organizations/orgB/activities/b1')));
  });

  it('host admin can read any orgs activity', async () => {
    await seedTwoOrgs();
    const db = authedDb('host1');
    await assertSucceeds(getDoc(doc(db, 'organizations/orgB/activities/b1')));
  });

  it('unauthed user cannot read an org doc', async () => {
    await seedTwoOrgs();
    const db = unauthedDb();
    await assertFails(getDoc(doc(db, 'organizations/orgA')));
  });
});

// ─── 2. /users/{uid} self-update can't change privilege ──────────────────
describe('user self-update', () => {
  it('user cannot escalate themselves to admin', async () => {
    await seedTwoOrgs();
    const db = authedDb('userA');
    await assertFails(updateDoc(doc(db, 'users/userA'), { isAdmin: true }));
  });

  it('user cannot move themselves to another org', async () => {
    await seedTwoOrgs();
    const db = authedDb('userA');
    await assertFails(updateDoc(doc(db, 'users/userA'), { organizationId: 'orgB' }));
  });

  it('user can update their own non-privileged fields', async () => {
    await seedTwoOrgs();
    const db = authedDb('userA');
    await assertSucceeds(updateDoc(doc(db, 'users/userA'), { name: 'New Name' }));
  });

  it('user cannot update someone else even in same org', async () => {
    await seedTwoOrgs();
    const db = authedDb('userA');
    await assertFails(updateDoc(doc(db, 'users/adminA'), { name: 'hacked' }));
  });

  it('host admin can update isAdmin on any user', async () => {
    await seedTwoOrgs();
    const db = authedDb('host1');
    await assertSucceeds(updateDoc(doc(db, 'users/userA'), { isAdmin: true }));
  });
});

// ─── 3. Pilot fields are host-admin-only ─────────────────────────────────
describe('pilot field gating', () => {
  it('org admin cannot set pilotEndAt', async () => {
    await seedTwoOrgs();
    const db = authedDb('adminA');
    await assertFails(updateDoc(doc(db, 'organizations/orgA'), {
      pilotEndAt: Timestamp.fromDate(new Date(Date.now() + 30 * 86400000)),
    }));
  });

  it('org admin cannot set pilotRemindersSent', async () => {
    await seedTwoOrgs();
    const db = authedDb('adminA');
    await assertFails(updateDoc(doc(db, 'organizations/orgA'), {
      pilotRemindersSent: { '14d': Timestamp.now() },
    }));
  });

  it('org admin can update non-pilot fields like name', async () => {
    await seedTwoOrgs();
    const db = authedDb('adminA');
    await assertSucceeds(updateDoc(doc(db, 'organizations/orgA'), { name: 'Renamed' }));
  });

  it('host admin can set pilotEndAt', async () => {
    await seedTwoOrgs();
    const db = authedDb('host1');
    await assertSucceeds(updateDoc(doc(db, 'organizations/orgA'), {
      pilotEndAt: Timestamp.fromDate(new Date(Date.now() + 30 * 86400000)),
      pilotStartedAt: Timestamp.now(),
      pilotDurationDays: 30,
    }));
  });
});

// ─── 4. Activity reads scope by coverageUsers ────────────────────────────
describe('activity coverage scope', () => {
  it('non-admin cannot read activity where they are not in coverageUsers', async () => {
    await seedTwoOrgs();
    const db = authedDb('userA');
    await assertFails(getDoc(doc(db, 'organizations/orgA/activities/a-other')));
  });

  it('non-admin can read activity where they are in coverageUsers', async () => {
    await seedTwoOrgs();
    const db = authedDb('userA');
    await assertSucceeds(getDoc(doc(db, 'organizations/orgA/activities/a-covered')));
  });

  it('org admin reads any activity in their org regardless of coverage', async () => {
    await seedTwoOrgs();
    const db = authedDb('adminA');
    await assertSucceeds(getDoc(doc(db, 'organizations/orgA/activities/a-other')));
  });

  it('non-admin queries with the array-contains filter succeed', async () => {
    await seedTwoOrgs();
    const db = authedDb('userA');
    const q = query(
      collection(db, 'organizations/orgA/activities'),
      where('coverageUsers', 'array-contains', 'User A'),
    );
    await assertSucceeds(getDocs(q));
  });

  it('non-admin unfiltered queries fail (rule-required filter missing)', async () => {
    await seedTwoOrgs();
    const db = authedDb('userA');
    await assertFails(getDocs(collection(db, 'organizations/orgA/activities')));
  });
});

// ─── 5. Invitations not enumerable across orgs ───────────────────────────
describe('invitations', () => {
  it('orgA member cannot read orgB invitations', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users/adminA'), { email: 'a@a.com', name: 'A', organizationId: 'orgA', isAdmin: true });
      await setDoc(doc(db, 'organizations/orgA'), { name: 'A' });
      await setDoc(doc(db, 'organizations/orgB'), { name: 'B' });
      await setDoc(doc(db, 'organizations/orgB/invitations/inv1'), {
        email: 'someone@b.com', role: 'admin', status: 'pending',
      });
    });
    const db = authedDb('adminA');
    await assertFails(getDoc(doc(db, 'organizations/orgB/invitations/inv1')));
  });

  it('the invited user can read their own invitation by email', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'organizations/orgB'), { name: 'B' });
      await setDoc(doc(db, 'organizations/orgB/invitations/inv1'), {
        email: 'invited@b.com', role: 'user', status: 'pending',
      });
    });
    const db = authedDb('invitee', { email: 'invited@b.com' });
    await assertSucceeds(getDoc(doc(db, 'organizations/orgB/invitations/inv1')));
  });
});
