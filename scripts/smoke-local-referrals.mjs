import { randomBytes } from 'node:crypto';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { chromium } from 'playwright';
import { ReferralService } from '../functions/src/referrals/ReferralService.js';

if (process.env.LOCAL_COIN_FULL_STACK !== 'true' || process.env.FIREBASE_PROJECT_ID !== 'demo-mitutora-coins') throw new Error('Referral smoke requires the isolated local full-stack environment.');
const baseUrl = 'http://127.0.0.1:5173';
const authUrl = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const db = new Firestore({ projectId: process.env.FIREBASE_PROJECT_ID });
const createdUsers = [];
let browser;

async function signUp(context, label, referralCode = '') {
  const page = await context.newPage();
  const suffix = randomBytes(8).toString('hex');
  const email = `${label}-${suffix}@example.test`;
  const password = randomBytes(24).toString('base64url');
  await page.goto(baseUrl);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Name').fill(`Learner ${label}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  if (referralCode) await page.getByLabel('Referral code (optional)').fill(referralCode);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Start learning' }).click();
  await page.getByRole('heading', { name: /Welcome back/i }).waitFor({ timeout: 60_000 });
  const users = await db.collection('users').where('email', '==', email).get();
  if (users.size !== 1) throw new Error(`${label} signup did not create exactly one user profile.`);
  const uid = users.docs[0].id;
  createdUsers.push(uid);
  return { page, uid };
}

async function openPage(page, label) {
  const menu = page.getByRole('button', { name: 'Open navigation' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: new RegExp(label, 'i') }).first().click();
}
async function waitForDocument(path, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const snapshot = await db.doc(path).get();
    if (snapshot.exists) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for expected local referral state.`);
}

try {
  browser = await chromium.launch({ headless: true });
  const a = await signUp(await browser.newContext(), 'a');
  await openPage(a.page, 'Referrals');
  await a.page.getByRole('heading', { name: 'Learning is better together.' }).waitFor();
  const code = (await a.page.locator('.referral-fields strong').first().textContent())?.trim();
  if (!/^MIT[A-Z0-9]{6}$/.test(code ?? '')) throw new Error('Canonical referral code was not rendered.');
  await a.page.reload();
  await a.page.getByText(code, { exact: true }).first().waitFor();

  const b = await signUp(await browser.newContext(), 'b', ` ${code.toLowerCase()} `);
  const attribution = await waitForDocument(`users/${b.uid}/referralAttribution/current`);
  if (!attribution.exists || attribution.data().referrerUid !== a.uid || attribution.data().status !== 'ATTRIBUTED') throw new Error('Browser signup attribution failed.');
  await a.page.reload();
  await a.page.getByText('Referred', { exact: true }).waitFor();
  const overview = await a.page.locator('.referral-overview').innerText();
  if (!overview.includes('1') || !overview.includes('₹0.00')) throw new Error('Initial referral aggregates are incorrect.');

  const c = await signUp(await browser.newContext(), 'c');
  if ((await db.doc(`users/${c.uid}/referralAttribution/current`).get()).exists) throw new Error('Optional signup created attribution unexpectedly.');

  const d = await signUp(await browser.newContext(), 'd', 'MITZZZ999');
  const invalidNotice = d.page.locator('.settings-toast');
  await invalidNotice.waitFor({ timeout: 30_000 });
  if (!/referral code|does not exist/i.test(await invalidNotice.innerText())) throw new Error('Invalid referral code did not produce finite feedback.');
  if ((await db.doc(`users/${d.uid}/referralAttribution/current`).get()).exists) throw new Error('Invalid code created attribution unexpectedly.');

  await openPage(b.page, 'Settings');
  await b.page.getByRole('button', { name: 'Subscription' }).click();
  await b.page.getByRole('button', { name: 'Get Premium' }).first().click();
  await b.page.getByText('Premium', { exact: true }).waitFor({ timeout: 30_000 });
  const before = (await db.collection('referrals').get()).docs[0].data();
  if (before.status !== 'ATTRIBUTED' || before.calculatedRewardMinor != null) throw new Error('DEVELOPMENT_GRANT qualified a referral.');

  const qualification = new ReferralService({ db, timestamp: Timestamp, now: () => new Date() });
  const result = await qualification.qualifyReferralFromVerifiedPurchase({ trusted: true, evidenceType: 'VERIFIED_PREMIUM_PURCHASE', source: 'PAYMENT', purchaserUid: b.uid, purchaseId: `synthetic_${randomBytes(12).toString('hex')}`, planId: 'monthly', amountMinor: 49_900, currency: 'INR' });
  if (!result.qualified || result.calculatedRewardMinor !== 4_990 || result.rewardRateBps !== 1_000) throw new Error('Synthetic first-purchase qualification was incorrect.');
  process.stdout.write('Local referral browser smoke passed: actual A/B/C signup, stable code, optional normalized attribution, zero initial reward, DEVELOPMENT_GRANT exclusion, and synthetic first qualification.\n');
} finally {
  await browser?.close();
  for (const uid of createdUsers) {
    await fetch(`${authUrl}/accounts:delete?key=local-emulator-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: uid }) }).catch(() => undefined);
  }
  for (const collection of ['users', 'referralCodes', 'referrals', 'referralPurchaseQualifications']) await db.recursiveDelete(db.collection(collection)).catch(() => undefined);
  await db.terminate();
}
