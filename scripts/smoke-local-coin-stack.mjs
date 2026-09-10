import { randomBytes } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';

const projectId = 'demo-mitutora-coins';
const expected = {
  FIREBASE_PROJECT_ID: projectId,
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
};
for (const [name, value] of Object.entries(expected)) {
  if (process.env[name] !== value) throw new Error(`Local smoke requires ${name}=${value}.`);
}

const authBase = `http://${expected.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;
const apiBase = 'http://127.0.0.1:5173';
const nonce = randomBytes(16).toString('hex');
const email = `coin-smoke-${nonce}@example.test`;
const password = randomBytes(24).toString('base64url');
let identity;
let db;

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => null);
  return { response, body };
}

try {
  const created = await jsonRequest(`${authBase}/accounts:signUp?key=local-emulator-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!created.response.ok || !created.body?.idToken || !created.body?.localId) throw new Error('Auth emulator user creation failed.');
  identity = created.body;
  const complete = (activity) => jsonRequest(`${apiBase}/api/activity/complete`, {
    method: 'POST', headers: { Authorization: `Bearer ${identity.idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(activity),
  });
  const challenge = { activityType: 'DAILY_CHALLENGE', activityId: 'challenge-balanced-brackets', activityVersion: 'v1' };
  const first = await complete(challenge);
  if (!first.response.ok || first.body?.rewardStatus !== 'credited' || first.body?.rewardAmount !== 20 || first.body?.balance !== 20) {
    throw new Error(`Daily Challenge completion failed (${first.response.status}, ${first.body?.error?.code || first.body?.rewardStatus || 'unknown'}).`);
  }
  const replay = await complete(challenge);
  if (!replay.response.ok || replay.body?.completionStatus !== 'already_completed' || replay.body?.rewardStatus !== 'already_claimed') {
    throw new Error('Daily Challenge replay was not idempotent.');
  }
  const practice = await complete({ activityType: 'PRACTICE', activityId: 'fund-variables-001', activityVersion: 'v2' });
  if (!practice.response.ok || practice.body?.rewardStatus !== 'credited' || practice.body?.rewardAmount !== 5 || practice.body?.balance !== 25) {
    throw new Error('Practice completion did not credit the canonical five-coin reward.');
  }
  db = new Firestore({ projectId });
  const [account, ledger, completions, streak] = await Promise.all([
    db.doc(`users/${identity.localId}/coinAccount/summary`).get(),
    db.collection(`users/${identity.localId}/coinTransactions`).get(),
    db.collection(`users/${identity.localId}/activityCompletions`).get(),
    db.doc(`users/${identity.localId}/streak/summary`).get(),
  ]);
  if (account.data()?.availableBalance !== 25 || ledger.size !== 2 || completions.size !== 2 || !streak.exists) {
    throw new Error('Durable emulator state does not match the completion responses.');
  }
  const explain = () => jsonRequest(`${apiBase}/api/ai/explain`, {
    method: 'POST', headers: { Authorization: `Bearer ${identity.idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestType: 'explain-full-code', language: 'python', code: 'print(1)', compilerStatus: 'ready', activityType: 'lesson' }),
  });
  const freeAI = await explain();
  if (freeAI.response.status !== 403 || freeAI.body?.error?.code !== 'ai/premium-required') {
    throw new Error('FREE AI Tutor access did not fail at the Premium boundary.');
  }
  const grantRequest = { planId: 'monthly', requestId: `request-${nonce}` };
  const grant = () => jsonRequest(`${apiBase}/api/subscriptions/development-grant`, {
    method: 'POST', headers: { Authorization: `Bearer ${identity.idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(grantRequest),
  });
  const firstGrant = await grant();
  const replayGrant = await grant();
  const monthlySubscriptions = await db.collection(`users/${identity.localId}/subscriptions`).get();
  const monthlyEntitlement = await db.doc(`users/${identity.localId}/entitlements/premium`).get();
  if (!firstGrant.response.ok || firstGrant.body?.tier !== 'PREMIUM' || firstGrant.body?.planId !== 'monthly' || firstGrant.body?.duplicate !== false
    || !replayGrant.response.ok || replayGrant.body?.duplicate !== true || monthlySubscriptions.size !== 1 || monthlyEntitlement.data()?.active !== true) {
    throw new Error('Development subscription grant was not authoritative and idempotent.');
  }
  const monthlyRecord = monthlySubscriptions.docs[0].data();
  if (monthlyRecord.priceMinor !== 49_900 || monthlyRecord.currency !== 'INR' || monthlyRecord.source !== 'DEVELOPMENT_GRANT') throw new Error('Monthly grant did not use the canonical server plan.');
  const premiumAI = await explain();
  if (premiumAI.response.status !== 503 || premiumAI.body?.error?.code !== 'ai/disabled') {
    throw new Error('Authoritative Premium did not reach the disabled AI feature gate after entitlement verification.');
  }
  const previousExpiry = monthlyEntitlement.data().expiresAt.toDate();
  const extension = await jsonRequest(`${apiBase}/api/subscriptions/development-grant`, {
    method: 'POST', headers: { Authorization: `Bearer ${identity.idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId: 'half_yearly', requestId: `extension-${nonce}` }),
  });
  const subscriptions = await db.collection(`users/${identity.localId}/subscriptions`).get();
  const entitlement = await db.doc(`users/${identity.localId}/entitlements/premium`).get();
  const expectedExpiry = new Date(previousExpiry); expectedExpiry.setUTCMonth(expectedExpiry.getUTCMonth() + 6);
  const halfYearly = subscriptions.docs.map((item) => item.data()).find(({ planId }) => planId === 'half_yearly');
  if (!extension.response.ok || subscriptions.size !== 2 || entitlement.data()?.planId !== 'half_yearly'
    || entitlement.data()?.expiresAt.toDate().getTime() !== expectedExpiry.getTime()
    || halfYearly?.startsAt.toDate().getTime() !== previousExpiry.getTime() || halfYearly?.priceMinor !== 99_900) {
    throw new Error('Active Premium did not extend from the prior expiry using the canonical Half-Yearly plan.');
  }
  process.stdout.write('Local full-stack smoke passed: M2 rewards; AI Premium boundary; FREE to Monthly Premium; replay; Half-Yearly extension from prior expiry.\n');
} finally {
  if (db) await db.terminate();
  if (identity?.localId) {
    await fetch(`${authBase}/accounts:delete?key=local-emulator-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: identity.localId }),
    }).catch(() => {});
  }
}
