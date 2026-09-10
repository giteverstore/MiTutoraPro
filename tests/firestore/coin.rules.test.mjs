import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const environment = await initializeTestEnvironment({
  projectId: 'demo-local-coin-rules',
  firestore: { rules: await readFile(process.env.COIN_RULES_PATH || 'firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});

try {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/owner/coinAccount/summary'), {
      availableBalance: 10, lifetimeEarned: 10, lifetimeSpent: 0, revision: 1,
    });
    await setDoc(doc(db, 'users/owner/coinTransactions/transaction-1'), {
      amount: 10, direction: 'CREDIT', status: 'POSTED', balanceAfter: 10,
    });
    await setDoc(doc(db, 'users/owner/rewardClaims/claim-1'), {
      activityType: 'PRACTICE', activityId: 'question-1', completionStatus: 'COMPLETED', rewardStatus: 'GRANTED',
    });
    await setDoc(doc(db, 'users/owner/activityCompletions/completion-1'), { ownerUid: 'owner', completionStatus: 'COMPLETED' });
    await setDoc(doc(db, 'users/owner/streak/summary'), { currentStreak: 2, longestStreak: 3 });
    await setDoc(doc(db, 'users/owner/activityUsage/2026-08-01'), { completionAttempts: 1 });
    await setDoc(doc(db, 'users/owner/streakEvents/event-1'), { ownerUid: 'owner' });
    await setDoc(doc(db, 'users/owner/subscriptions/subscription-1'), { ownerUid: 'owner', status: 'ACTIVE' });
    await setDoc(doc(db, 'users/owner/entitlements/premium'), { ownerUid: 'owner', tier: 'PREMIUM', active: true });
    await setDoc(doc(db, 'coinIdempotency/private-key'), { ownerUid: 'owner', fingerprint: 'private' });
    await setDoc(doc(db, 'users/owner/referralIdentity/current'), { code: 'MITABC234', ownerUid: 'owner' });
    await setDoc(doc(db, 'users/owner/referralAttribution/current'), { referrerUid: 'referrer', status: 'ATTRIBUTED' });
    await setDoc(doc(db, 'users/owner/referralReadModel/referral-1'), { status: 'ATTRIBUTED' });
    await setDoc(doc(db, 'referralCodes/MITABC234'), { ownerUid: 'owner' });
    await setDoc(doc(db, 'referrals/referral-1'), { referrerUid: 'owner' });
    await setDoc(doc(db, 'referralPurchaseQualifications/purchase-1'), { status: 'QUALIFIED' });
    await setDoc(doc(db, 'users/owner/wallet/account'), { currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: 4990, lifetimeCreditedMinor: 4990 });
    await setDoc(doc(db, 'users/owner/walletTransactions/wallet-1'), { type: 'REFERRAL_REWARD', amountMinor: 4990, currency: 'INR' });
    await setDoc(doc(db, 'walletSettlementIdempotency/private-key'), { referralId: 'referral-1' });
    await setDoc(doc(db, 'users/owner/withdrawals/withdrawal-1'), { ownerUid: 'owner', amountMinor: 50000, status: 'PENDING' });
    await setDoc(doc(db, 'withdrawalIdempotency/private-key'), { ownerUid: 'owner' });
    await setDoc(doc(db, 'withdrawalTransitionIdempotency/private-key'), { withdrawalId: 'withdrawal-1' });
    await setDoc(doc(db, 'withdrawalLookup/withdrawal-1'), { ownerUid: 'owner' });
  });

  const owner = environment.authenticatedContext('owner').firestore();
  const stranger = environment.authenticatedContext('stranger').firestore();
  const anonymous = environment.unauthenticatedContext().firestore();

  await assertSucceeds(getDoc(doc(owner, 'users/owner/coinAccount/summary')));
  await assertSucceeds(getDoc(doc(owner, 'users/owner/coinTransactions/transaction-1')));
  await assertSucceeds(getDoc(doc(owner, 'users/owner/rewardClaims/claim-1')));
  await assertSucceeds(getDoc(doc(owner, 'users/owner/activityCompletions/completion-1')));
  await assertSucceeds(getDoc(doc(owner, 'users/owner/streak/summary')));
  await assertFails(getDoc(doc(owner, 'users/owner/activityUsage/2026-08-01')));
  await assertFails(getDoc(doc(owner, 'users/owner/streakEvents/event-1')));
  await assertSucceeds(getDoc(doc(owner, 'users/owner/subscriptions/subscription-1')));
  await assertSucceeds(getDoc(doc(owner, 'users/owner/entitlements/premium')));
  await assertSucceeds(getDoc(doc(owner, 'users/owner/referralIdentity/current')));
  await assertSucceeds(getDoc(doc(owner, 'users/owner/referralAttribution/current')));
  await assertSucceeds(getDoc(doc(owner, 'users/owner/referralReadModel/referral-1')));
  await assertSucceeds(getDoc(doc(owner, 'users/owner/wallet/account')));
  await assertSucceeds(getDoc(doc(owner, 'users/owner/walletTransactions/wallet-1')));
  await assertFails(setDoc(doc(owner, 'users/owner/wallet/account'), { availableBalanceMinor: 999999 }));
  await assertFails(updateDoc(doc(owner, 'users/owner/wallet/account'), { availableBalanceMinor: 999999 }));
  await assertFails(deleteDoc(doc(owner, 'users/owner/wallet/account')));
  await assertFails(setDoc(doc(owner, 'users/owner/walletTransactions/forged'), { amountMinor: 999999 }));
  await assertFails(updateDoc(doc(owner, 'users/owner/walletTransactions/wallet-1'), { amountMinor: 1 }));
  await assertFails(deleteDoc(doc(owner, 'users/owner/walletTransactions/wallet-1')));

  await assertFails(setDoc(doc(owner, 'users/owner/coinAccount/summary'), { availableBalance: 9999 }));
  await assertFails(updateDoc(doc(owner, 'users/owner/coinAccount/summary'), { availableBalance: 9999 }));
  await assertFails(deleteDoc(doc(owner, 'users/owner/coinAccount/summary')));

  await assertFails(setDoc(doc(owner, 'users/owner/coinTransactions/forged-credit'), { amount: 9999, direction: 'CREDIT' }));
  await assertFails(setDoc(doc(owner, 'users/owner/coinTransactions/forged-debit'), { amount: 1, direction: 'DEBIT' }));
  await assertFails(updateDoc(doc(owner, 'users/owner/coinTransactions/transaction-1'), { amount: 9999 }));
  await assertFails(deleteDoc(doc(owner, 'users/owner/coinTransactions/transaction-1')));

  await assertFails(setDoc(doc(owner, 'users/owner/rewardClaims/forged'), { activityType: 'DAILY_CHALLENGE', rewardStatus: 'GRANTED' }));
  await assertFails(updateDoc(doc(owner, 'users/owner/rewardClaims/claim-1'), { rewardStatus: 'GRANTED', rewardTransactionId: 'fake' }));
  await assertFails(deleteDoc(doc(owner, 'users/owner/rewardClaims/claim-1')));
  await assertFails(setDoc(doc(owner, 'users/owner/activityCompletions/forged'), { ownerUid: 'owner' }));
  await assertFails(setDoc(doc(owner, 'users/owner/streak/summary'), { currentStreak: 99 }));
  await assertFails(setDoc(doc(owner, 'users/owner/activityUsage/forged'), { completionAttempts: 0 }));
  await assertFails(setDoc(doc(owner, 'users/owner/streakEvents/forged'), { ownerUid: 'owner' }));
  await assertFails(setDoc(doc(owner, 'users/owner/subscriptions/forged'), { ownerUid: 'owner', status: 'ACTIVE' }));
  await assertFails(updateDoc(doc(owner, 'users/owner/subscriptions/subscription-1'), { status: 'CANCELLED' }));
  await assertFails(deleteDoc(doc(owner, 'users/owner/subscriptions/subscription-1')));
  await assertFails(setDoc(doc(owner, 'users/owner/entitlements/premium'), { active: true }));
  await assertFails(updateDoc(doc(owner, 'users/owner/entitlements/premium'), { active: false }));
  await assertFails(deleteDoc(doc(owner, 'users/owner/entitlements/premium')));
  await assertFails(setDoc(doc(owner, 'users/owner/referralIdentity/current'), { code: 'MITFORGED' }));
  await assertFails(setDoc(doc(owner, 'users/owner/referralAttribution/current'), { referrerUid: 'chosen' }));
  await assertFails(setDoc(doc(owner, 'users/owner/referralReadModel/forged'), { status: 'QUALIFIED' }));

  await assertFails(getDoc(doc(stranger, 'users/owner/coinAccount/summary')));
  await assertFails(getDoc(doc(stranger, 'users/owner/coinTransactions/transaction-1')));
  await assertFails(getDoc(doc(stranger, 'users/owner/rewardClaims/claim-1')));
  await assertFails(getDoc(doc(stranger, 'users/owner/activityCompletions/completion-1')));
  await assertFails(getDoc(doc(stranger, 'users/owner/streak/summary')));
  await assertFails(getDoc(doc(stranger, 'users/owner/subscriptions/subscription-1')));
  await assertFails(getDoc(doc(stranger, 'users/owner/entitlements/premium')));
  await assertFails(getDoc(doc(stranger, 'users/owner/referralIdentity/current')));
  await assertFails(getDoc(doc(stranger, 'users/owner/referralAttribution/current')));
  await assertFails(getDoc(doc(stranger, 'users/owner/referralReadModel/referral-1')));
  await assertFails(getDoc(doc(anonymous, 'users/owner/coinAccount/summary')));
  await assertFails(getDoc(doc(stranger, 'users/owner/wallet/account')));
  await assertFails(getDoc(doc(stranger, 'users/owner/walletTransactions/wallet-1')));
  await assertFails(getDoc(doc(anonymous, 'users/owner/wallet/account')));
  await assertFails(getDoc(doc(anonymous, 'users/owner/walletTransactions/wallet-1')));
  await assertFails(getDoc(doc(owner, 'coinIdempotency/private-key')));
  await assertFails(setDoc(doc(owner, 'coinIdempotency/forged'), { ownerUid: 'owner' }));
  await assertFails(getDoc(doc(owner, 'referralCodes/MITABC234')));
  await assertFails(setDoc(doc(owner, 'referralCodes/MITFORGED'), { ownerUid: 'owner' }));
  await assertFails(getDoc(doc(owner, 'referrals/referral-1')));
  await assertFails(setDoc(doc(owner, 'referrals/forged'), { referrerUid: 'owner' }));
  await assertFails(getDoc(doc(owner, 'referralPurchaseQualifications/purchase-1')));
  await assertFails(getDoc(doc(owner, 'walletSettlementIdempotency/private-key')));
  await assertFails(setDoc(doc(owner, 'walletSettlementIdempotency/forged'), { referralId: 'referral-1' }));
  await assertSucceeds(getDoc(doc(owner, 'users/owner/withdrawals/withdrawal-1')));
  await assertFails(setDoc(doc(owner, 'users/owner/withdrawals/forged'), { status: 'PAID', amountMinor: 1 }));
  await assertFails(updateDoc(doc(owner, 'users/owner/withdrawals/withdrawal-1'), { status: 'PAID' }));
  await assertFails(deleteDoc(doc(owner, 'users/owner/withdrawals/withdrawal-1')));
  await assertFails(getDoc(doc(stranger, 'users/owner/withdrawals/withdrawal-1')));
  await assertFails(getDoc(doc(anonymous, 'users/owner/withdrawals/withdrawal-1')));
  await assertFails(getDoc(doc(owner, 'withdrawalIdempotency/private-key')));
  await assertFails(getDoc(doc(owner, 'withdrawalTransitionIdempotency/private-key')));
  await assertFails(getDoc(doc(owner, 'withdrawalLookup/withdrawal-1')));

  await environment.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDoc(doc(context.firestore(), 'users/owner/coinAccount/summary'));
    assert.equal(snapshot.data().availableBalance, 10);
  });
  console.log('MI Coin Firestore rules validation passed.');
} finally {
  await environment.cleanup();
}
