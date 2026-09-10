import { randomBytes } from 'node:crypto';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { chromium } from 'playwright';
import { ReferralService } from '../functions/src/referrals/ReferralService.js';
import { WalletService, reconcileWalletProjection } from '../functions/src/wallet/WalletService.js';
import { WithdrawalService } from '../functions/src/withdrawals/WithdrawalService.js';

const projectId = 'demo-mitutora-coins';
if (process.env.LOCAL_COIN_FULL_STACK !== 'true' || process.env.FIREBASE_PROJECT_ID !== projectId || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw new Error('Withdrawal smoke requires the isolated local full-stack environment.');
const db = new Firestore({ projectId });
const authUrl = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const createdUsers = [];
let browser;

async function signUp(context, label, referralCode = '') {
  const page = await context.newPage();
  const suffix = randomBytes(8).toString('hex');
  const email = `withdrawal-${label}-${suffix}@example.test`;
  const password = randomBytes(24).toString('base64url');
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Name').fill(`Withdrawal ${label}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  if (referralCode) await page.getByLabel('Referral code (optional)').fill(referralCode);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Start learning' }).click();
  await page.getByRole('heading', { name: /Welcome back/i }).waitFor({ timeout: 60_000 });
  const users = await db.collection('users').where('email', '==', email).get();
  if (users.size !== 1) throw new Error('Synthetic signup did not resolve exactly one user.');
  const uid = users.docs[0].id;
  createdUsers.push(uid);
  return { page, uid };
}

async function navigate(page, label) {
  const menu = page.getByRole('button', { name: 'Open navigation' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).click();
}

async function refreshWallet(page, expectedStatus) {
  await page.reload();
  await page.getByRole('heading', { name: 'Wallet' }).waitFor();
  if (expectedStatus) await page.getByText(expectedStatus, { exact: true }).first().waitFor();
}

async function waitForReferral(uid) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const snapshot = await db.collection('referrals').where('referredUid', '==', uid).limit(1).get();
    if (!snapshot.empty) return snapshot.docs[0];
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for authoritative referral attribution.');
}

try {
  browser = await chromium.launch({ headless: true });
  const owner = await signUp(await browser.newContext(), 'owner');
  await navigate(owner.page, 'Referrals');
  const code = (await owner.page.locator('.referral-fields strong').first().textContent())?.trim();
  if (!/^MIT[A-Z0-9]{6}$/.test(code ?? '')) throw new Error('Referral identity was unavailable.');
  const referrals = new ReferralService({ db, timestamp: Timestamp, now: () => new Date() });
  const wallet = new WalletService({ db, timestamp: Timestamp, allowSyntheticSettlement: true });
  for (let index = 1; index <= 4; index += 1) {
    const buyer = await signUp(await browser.newContext(), `buyer-${index}`, code);
    const referral = await waitForReferral(buyer.uid);
    const qualified = await referrals.qualifyReferralFromVerifiedPurchase({ trusted: true, evidenceType: 'VERIFIED_PREMIUM_PURCHASE', source: 'PAYMENT', purchaserUid: buyer.uid, purchaseId: `withdrawal-purchase-${index}-${randomBytes(8).toString('hex')}`, planId: 'annual', amountMinor: 149_900, currency: 'INR' });
    if (qualified.calculatedRewardMinor !== 14_990) throw new Error('Authoritative referral calculation was unexpected.');
    if (index === 1 && (await db.doc(`users/${owner.uid}/wallet/account`).get()).exists) throw new Error('Qualification created withdrawable money before settlement.');
    await wallet.settleSyntheticReferralReward({ trusted: true, evidenceType: 'SYNTHETIC_REFERRAL_SETTLEMENT', settlementId: `withdrawal-settlement-${index}-${randomBytes(8).toString('hex')}`, referralId: referral.id });
  }
  const withdrawals = new WithdrawalService({ db, timestamp: Timestamp, allowWithdrawalRequests: true, allowSyntheticTransitions: true });
  const created = await withdrawals.requestWithdrawal({ principal: { uid: owner.uid }, request: { requestId: `withdrawal-request-${randomBytes(8).toString('hex')}`, amountMinor: 50_000 } });
  if (created.availableBalanceMinor !== 9_960 || created.reservedBalanceMinor !== 50_000) throw new Error('Exact-minimum reservation projection was incorrect.');
  await navigate(owner.page, 'Wallet');
  await owner.page.locator('.wallet-withdrawals').getByText('Pending', { exact: true }).waitFor();
  if (!(await owner.page.getByRole('button', { name: 'Request Withdrawal' }).isDisabled())) throw new Error('Production-style withdrawal control was enabled.');
  await owner.page.getByText('Withdrawals are coming soon. No payout provider is connected.').waitFor();
  await refreshWallet(owner.page, 'Pending');
  const account = (await db.doc(`users/${owner.uid}/wallet/account`).get()).data();
  const ledger = (await db.collection(`users/${owner.uid}/walletTransactions`).get()).docs.map((entry) => entry.data());
  const history = (await db.collection(`users/${owner.uid}/withdrawals`).get()).docs.map((entry) => entry.data());
  if (!reconcileWalletProjection(account, ledger, history).reconciled) throw new Error('Authoritative withdrawal state did not reconcile after refresh.');
  process.stdout.write('Local withdrawal browser smoke passed: real signup/referral/qualification, four trusted settlements, exact-minimum reservation, durable refresh, truthful disabled UI, and reconciliation.\n');
} finally {
  await browser?.close();
  for (const uid of createdUsers) await fetch(`${authUrl}/accounts:delete?key=local-emulator-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: uid }) }).catch(() => undefined);
  for (const name of ['users', 'referralCodes', 'referrals', 'referralPurchaseQualifications', 'walletSettlementIdempotency', 'withdrawalIdempotency', 'withdrawalTransitionIdempotency', 'withdrawalLookup']) await db.recursiveDelete(db.collection(name)).catch(() => undefined);
  await db.terminate();
}
