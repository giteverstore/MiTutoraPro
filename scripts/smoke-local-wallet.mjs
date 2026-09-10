import { randomBytes } from 'node:crypto';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { chromium } from 'playwright';
import { ReferralService } from '../functions/src/referrals/ReferralService.js';
import { WalletService, reconcileWalletProjection } from '../functions/src/wallet/WalletService.js';

if (process.env.LOCAL_COIN_FULL_STACK !== 'true' || process.env.FIREBASE_PROJECT_ID !== 'demo-mitutora-coins' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw new Error('Wallet smoke requires the isolated local full-stack environment.');
const baseUrl = 'http://127.0.0.1:5173';
const authUrl = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const db = new Firestore({ projectId: process.env.FIREBASE_PROJECT_ID });
const createdUsers = [];
let browser;

async function signUp(context, label, referralCode = '') {
  const page = await context.newPage();
  const suffix = randomBytes(8).toString('hex');
  const email = `wallet-${label}-${suffix}@example.test`;
  const password = randomBytes(24).toString('base64url');
  await page.goto(baseUrl);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Name').fill(`Wallet ${label}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  if (referralCode) await page.getByLabel('Referral code (optional)').fill(referralCode);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Start learning' }).click();
  await page.getByRole('heading', { name: /Welcome back/i }).waitFor({ timeout: 60_000 });
  const users = await db.collection('users').where('email', '==', email).get();
  if (users.size !== 1) throw new Error('Wallet smoke signup failed.');
  const uid = users.docs[0].id;
  createdUsers.push(uid);
  return { page, uid };
}
async function navigate(page, label) {
  const menu = page.getByRole('button', { name: 'Open navigation' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).click();
}
async function waitForDocument(path) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const snapshot = await db.doc(path).get();
    if (snapshot.exists) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for authoritative wallet smoke state.');
}

try {
  browser = await chromium.launch({ headless: true });
  const a = await signUp(await browser.newContext(), 'a');
  await navigate(a.page, 'Referrals');
  const code = (await a.page.locator('.referral-fields strong').first().textContent())?.trim();
  if (!/^MIT[A-Z0-9]{6}$/.test(code ?? '')) throw new Error('Referral code was unavailable.');
  const b = await signUp(await browser.newContext(), 'b', code);
  const attribution = await waitForDocument(`users/${b.uid}/referralAttribution/current`);
  const referralId = attribution.data().referralId ?? (await db.collection('referrals').where('referredUid', '==', b.uid).limit(1).get()).docs[0]?.id;
  if (!referralId) throw new Error('Attribution did not resolve a referral.');

  await navigate(a.page, 'Wallet');
  await a.page.getByText('No wallet transactions yet.').waitFor();
  if ((await a.page.getByText('₹0.00').count()) !== 2) throw new Error('Fresh wallet did not render zero balances.');

  const referrals = new ReferralService({ db, timestamp: Timestamp, now: () => new Date() });
  const qualification = await referrals.qualifyReferralFromVerifiedPurchase({ trusted: true, evidenceType: 'VERIFIED_PREMIUM_PURCHASE', source: 'PAYMENT', purchaserUid: b.uid, purchaseId: `synthetic_${randomBytes(12).toString('hex')}`, planId: 'monthly', amountMinor: 49_900, currency: 'INR' });
  if (!qualification.qualified || qualification.calculatedRewardMinor !== 4_990) throw new Error('M5 qualification failed.');
  if ((await db.doc(`users/${a.uid}/wallet/account`).get()).exists || !(await db.collection(`users/${a.uid}/walletTransactions`).get()).empty) throw new Error('Qualification created wallet money.');
  await a.page.reload();
  await a.page.getByText('No wallet transactions yet.').waitFor();

  const wallet = new WalletService({ db, timestamp: Timestamp, allowSyntheticSettlement: true });
  const settlementId = `settlement_${randomBytes(12).toString('hex')}`;
  const settlement = await wallet.settleSyntheticReferralReward({ trusted: true, evidenceType: 'SYNTHETIC_REFERRAL_SETTLEMENT', settlementId, referralId });
  const replay = await wallet.settleSyntheticReferralReward({ trusted: true, evidenceType: 'SYNTHETIC_REFERRAL_SETTLEMENT', settlementId, referralId });
  if (!replay.duplicate || replay.transactionId !== settlement.transactionId) throw new Error('Settlement replay was not idempotent.');
  await a.page.reload();
  await a.page.getByText('Referral reward', { exact: true }).waitFor();
  await a.page.getByText('₹49.90', { exact: true }).waitFor();
  await a.page.getByText('+₹49.90', { exact: true }).waitFor();
  const account = (await db.doc(`users/${a.uid}/wallet/account`).get()).data();
  const ledger = (await db.collection(`users/${a.uid}/walletTransactions`).get()).docs.map((entry) => entry.data());
  if (ledger.length !== 1 || !reconcileWalletProjection(account, ledger).reconciled) throw new Error('Wallet ledger reconciliation failed.');
  if ((await db.doc(`referrals/${referralId}`).get()).data().walletSettlementStatus !== 'SETTLED') throw new Error('Referral settlement link was not persisted.');
  process.stdout.write('Local wallet browser smoke passed: signup, attribution, qualification-with-zero-wallet, one idempotent settlement, authoritative refresh, ledger rendering, and reconciliation.\n');
} finally {
  await browser?.close();
  for (const uid of createdUsers) await fetch(`${authUrl}/accounts:delete?key=local-emulator-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: uid }) }).catch(() => undefined);
  for (const name of ['users', 'referralCodes', 'referrals', 'referralPurchaseQualifications', 'walletSettlementIdempotency']) await db.recursiveDelete(db.collection(name)).catch(() => undefined);
  await db.terminate();
}
