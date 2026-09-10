import { Timestamp } from 'firebase-admin/firestore';
import {
  COIN_DIRECTIONS,
  COIN_TRANSACTION_STATUSES,
  COIN_TRANSACTION_TYPES,
  COIN_SOURCE_TYPES,
  digestIdentifier,
  enumValue,
  mutationFingerprint,
  nonNegativeInteger,
  positiveInteger,
  requiredIdentifier,
  requiredUid,
  validateAccount,
} from './CoinModels.js';
import { failCoin } from './CoinError.js';

const accountPath = (uid) => `users/${uid}/coinAccount/summary`;
const transactionPath = (uid, transactionId) => `users/${uid}/coinTransactions/${transactionId}`;
const idempotencyPath = (id) => `coinIdempotency/${id}`;

function normalizeMutation(input, expectedDirection) {
  const direction = enumValue(expectedDirection, COIN_DIRECTIONS, 'direction');
  const expectedType = direction === COIN_DIRECTIONS.CREDIT
    ? COIN_TRANSACTION_TYPES.ACTIVITY_REWARD
    : COIN_TRANSACTION_TYPES.COIN_SPEND;
  const type = enumValue(input.type, COIN_TRANSACTION_TYPES, 'type');
  if (type !== expectedType) failCoin('coin/invalid-argument', 'Transaction type does not match its direction.');
  return {
    uid: requiredUid(input.uid),
    amount: positiveInteger(input.amount),
    direction,
    type,
    sourceType: enumValue(input.sourceType, COIN_SOURCE_TYPES, 'sourceType'),
    sourceId: requiredIdentifier(input.sourceId, 'sourceId'),
    idempotencyKey: requiredIdentifier(input.idempotencyKey, 'idempotencyKey'),
    policyVersion: requiredIdentifier(input.policyVersion, 'policyVersion', 128),
  };
}

function initialAccount(timestamp) {
  return {
    availableBalance: 0,
    lifetimeEarned: 0,
    lifetimeSpent: 0,
    revision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion: '1.0.0',
  };
}

export class CoinLedgerService {
  constructor({ db, timestamp = () => Timestamp.now() }) {
    if (!db?.doc || !db?.runTransaction) throw new TypeError('CoinLedgerService requires Firestore.');
    this.db = db;
    this.timestamp = timestamp;
  }

  async ensureAccount(uidValue) {
    const uid = requiredUid(uidValue);
    const reference = this.db.doc(accountPath(uid));
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (snapshot.exists) return { ...validateAccount(snapshot.data()), created: false };
      const account = initialAccount(this.timestamp());
      transaction.create(reference, account);
      return { ...account, created: true };
    });
  }

  async grantCoins(input, options = {}) {
    return this.#post(normalizeMutation(input, COIN_DIRECTIONS.CREDIT), options);
  }

  async debitCoins(input, options = {}) {
    return this.#post(normalizeMutation(input, COIN_DIRECTIONS.DEBIT), options);
  }

  async claimActivityReward(input, claim, { verifyEligibility, dailyCredit } = {}) {
    if (!claim?.path || !claim?.data) failCoin('coin/invalid-argument', 'A server-derived reward claim is required.');
    if (typeof verifyEligibility !== 'function') failCoin('coin/invalid-argument', 'Transactional eligibility verification is required.');
    return this.#post(normalizeMutation(input, COIN_DIRECTIONS.CREDIT), { claimToCreate: claim, verifyEligibility, dailyCredit });
  }

  async #post(mutation, { claim = null, claimToCreate = null, verifyEligibility = null, dailyCredit = null } = {}) {
    const fingerprint = mutationFingerprint(mutation);
    const idempotencyId = digestIdentifier('idem', mutation.idempotencyKey);
    const transactionId = digestIdentifier('coin', mutation.idempotencyKey);
    const replayReference = this.db.doc(idempotencyPath(idempotencyId));
    const accountReference = this.db.doc(accountPath(mutation.uid));
    const ledgerReference = this.db.doc(transactionPath(mutation.uid, transactionId));
    const claimReference = (claim?.path || claimToCreate?.path) ? this.db.doc(claim?.path || claimToCreate.path) : null;

    return this.db.runTransaction(async (transaction) => {
      const replaySnapshot = await transaction.get(replayReference);
      if (replaySnapshot.exists) {
        const replay = replaySnapshot.data();
        if (replay.fingerprint !== fingerprint || replay.ownerUid !== mutation.uid || replay.transactionId !== transactionId) {
          failCoin('coin/idempotency-conflict', 'The idempotency key is already bound to another mutation.');
        }
        const existingLedger = await transaction.get(ledgerReference);
        if (!existingLedger.exists) failCoin('coin/data-integrity', 'Idempotency record has no matching ledger entry.');
        const existing = existingLedger.data();
        if (existing.ownerUid !== mutation.uid
          || existing.amount !== mutation.amount
          || existing.direction !== mutation.direction
          || existing.type !== mutation.type
          || existing.sourceType !== mutation.sourceType
          || existing.sourceId !== mutation.sourceId
          || existing.idempotencyKey !== mutation.idempotencyKey
          || existing.policyVersion !== mutation.policyVersion
          || existing.status !== COIN_TRANSACTION_STATUSES.POSTED) {
          failCoin('coin/data-integrity', 'Replay protection does not match its ledger entry.');
        }
        return {
          transactionId,
          balance: nonNegativeInteger(existing.balanceAfter, 'balanceAfter'),
          revision: nonNegativeInteger(existing.accountRevision, 'accountRevision'),
          duplicate: true,
        };
      }

      const references = claimReference ? [accountReference, ledgerReference, claimReference] : [accountReference, ledgerReference];
      const snapshots = await transaction.getAll(...references);
      const [accountSnapshot, ledgerSnapshot, claimSnapshot] = snapshots;
      if (ledgerSnapshot.exists) failCoin('coin/data-integrity', 'Ledger entry exists without replay protection.');

      let claimData = null;
      if (claimReference) {
        if (claimToCreate) {
          if (claimSnapshot.exists) failCoin('coin/claim-conflict', 'The reward claim exists without replay protection.');
          claimData = claimToCreate.data;
        } else {
          if (!claimSnapshot.exists) failCoin('coin/claim-required', 'A trusted completed activity claim is required.');
          claimData = claimSnapshot.data();
        }
        if (claimData.ownerUid !== mutation.uid
          || claimData.activityType !== (claim?.activityType || mutation.sourceType)
          || claimData.activityId !== (claim?.activityId || mutation.sourceId)
          || claimData.completionStatus !== 'COMPLETED'
          || claimData.policyVersion !== mutation.policyVersion) {
          failCoin('coin/claim-conflict', 'The activity claim does not match this reward.');
        }
        if (claimData.rewardStatus === 'GRANTED') failCoin('coin/data-integrity', 'Rewarded claim is missing its replay record.');
        if (claimData.rewardStatus !== 'NOT_GRANTED' || claimData.rewardTransactionId !== null) {
          failCoin('coin/claim-conflict', 'The activity claim is not rewardable.');
        }
      }

      if (verifyEligibility) await verifyEligibility(transaction);

      let usageReference = null;
      let usage = null;
      if (dailyCredit) {
        usageReference = this.db.doc(dailyCredit.path);
        const usageSnapshot = await transaction.get(usageReference);
        if (!usageSnapshot.exists) failCoin('coin/data-integrity', 'Daily activity usage is missing for this completion.');
        usage = usageSnapshot.data();
        const credited = nonNegativeInteger(usage.rewardCoinsCredited ?? 0, 'rewardCoinsCredited');
        const cap = positiveInteger(dailyCredit.cap, 'dailyCreditCap');
        if (credited + mutation.amount > cap) {
          failCoin('coin/daily-reward-cap-reached', 'The daily activity coin reward cap was reached.');
        }
        usage = { ...usage, rewardCoinsCredited: credited + mutation.amount, updatedAt: this.timestamp(), schemaVersion: '1.0.0' };
      }

      const timestamp = this.timestamp();
      const persistedAccount = accountSnapshot.exists ? accountSnapshot.data() : initialAccount(timestamp);
      const account = validateAccount(persistedAccount) ?? validateAccount(initialAccount(timestamp));
      if (mutation.direction === COIN_DIRECTIONS.DEBIT && account.availableBalance < mutation.amount) {
        failCoin('coin/insufficient-balance', 'The coin account has insufficient balance.');
      }
      const delta = mutation.direction === COIN_DIRECTIONS.CREDIT ? mutation.amount : -mutation.amount;
      const next = {
        ...persistedAccount,
        availableBalance: account.availableBalance + delta,
        lifetimeEarned: account.lifetimeEarned + (mutation.direction === COIN_DIRECTIONS.CREDIT ? mutation.amount : 0),
        lifetimeSpent: account.lifetimeSpent + (mutation.direction === COIN_DIRECTIONS.DEBIT ? mutation.amount : 0),
        revision: account.revision + 1,
        updatedAt: timestamp,
        schemaVersion: '1.0.0',
      };
      nonNegativeInteger(next.availableBalance, 'availableBalance');
      nonNegativeInteger(next.lifetimeEarned, 'lifetimeEarned');
      nonNegativeInteger(next.lifetimeSpent, 'lifetimeSpent');
      nonNegativeInteger(next.revision, 'revision');
      const ledger = {
        ownerUid: mutation.uid,
        amount: mutation.amount,
        direction: mutation.direction,
        type: mutation.type,
        sourceType: mutation.sourceType,
        sourceId: mutation.sourceId,
        idempotencyKey: mutation.idempotencyKey,
        balanceAfter: next.availableBalance,
        accountRevision: next.revision,
        policyVersion: mutation.policyVersion,
        status: COIN_TRANSACTION_STATUSES.POSTED,
        createdAt: timestamp,
        schemaVersion: '1.0.0',
      };
      const replay = {
        ownerUid: mutation.uid,
        fingerprint,
        transactionId,
        transactionPath: ledgerReference.path,
        createdAt: timestamp,
        schemaVersion: '1.0.0',
      };

      transaction.set(accountReference, next, { merge: false });
      transaction.create(ledgerReference, ledger);
      transaction.create(replayReference, replay);
      if (usageReference) transaction.set(usageReference, usage, { merge: false });
      if (claimReference) {
        const rewardedClaim = { ...claimData, rewardStatus: 'GRANTED', rewardTransactionId: transactionId, rewardedAt: timestamp };
        if (claimToCreate) transaction.create(claimReference, rewardedClaim);
        else transaction.update(claimReference, { rewardStatus: 'GRANTED', rewardTransactionId: transactionId, rewardedAt: timestamp });
      }
      return { transactionId, balance: next.availableBalance, revision: next.revision, duplicate: false };
    });
  }
}
