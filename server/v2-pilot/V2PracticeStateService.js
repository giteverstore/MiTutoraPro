import { createHash } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { CoinLedgerService } from '../../functions/src/coins/CoinLedgerService.js';
import { COIN_TRANSACTION_TYPES } from '../../functions/src/coins/CoinModels.js';
import { practiceContractFingerprints } from '../../src/v2-pilot/V2PracticeAssertion.js';
import { createV2PracticeStateKey } from './v2PracticeStateIdentity.js';

export class V2PracticeStateError extends Error { constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; } }
const statePath = (uid, identity) => `users/${uid}/v2PracticeState/${createV2PracticeStateKey(identity)}`;
const rewardPath = (uid, contentId) => `users/${uid}/v2PracticeRewards/v2_practice_${contentId}`;
const languageId = (value, supported) => { if (typeof value !== 'string' || !supported.has(value)) throw new V2PracticeStateError('v2/practice-state-invalid-language', 'The selected language is not supported by this publication.', 422); return value; };
const codeValue = (value) => { if (typeof value !== 'string' || value.length > 200_000) throw new V2PracticeStateError('v2/practice-state-invalid-code', 'The Practice draft is invalid.', 422); return value; };
const publicState = (record) => record ? { ...record, createdAt: record.createdAt ?? null, updatedAt: record.updatedAt ?? null, solvedAt: record.solvedAt ?? null, rewardGrantedAt: record.rewardGrantedAt ?? null } : null;

export class FirestoreV2PracticeStateStore {
  constructor(db, { timestamp = () => Timestamp.now(), ledger = new CoinLedgerService({ db, timestamp }) } = {}) { this.db = db; this.timestamp = timestamp; this.ledger = ledger; }
  reference(uid, identity) { return this.db.doc(statePath(uid, identity)); }
  async load(uid, identity) { const snapshot = await this.reference(uid, identity).get(); return snapshot.exists ? publicState(snapshot.data()) : null; }
  async saveWorkspace(uid, identity, input, practice) {
    const supported = new Set(practice.languages.supported.map(({ id }) => id));
    const selectedLanguage = languageId(input.selectedLanguage, supported);
    const codeByLanguage = input.codeByLanguage;
    if (!codeByLanguage || Array.isArray(codeByLanguage) || typeof codeByLanguage !== 'object' || Object.keys(codeByLanguage).some((key) => !supported.has(key))) throw new V2PracticeStateError('v2/practice-state-invalid-code', 'The Practice drafts are invalid.', 422);
    const drafts = Object.fromEntries(Object.entries(codeByLanguage).map(([key, value]) => [key, codeValue(value)]));
    const expected = Number(input.revision ?? 0), reference = this.reference(uid, identity);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference), existing = snapshot.exists ? snapshot.data() : null, revision = Number(existing?.revision ?? 0);
      if (revision !== expected) throw new V2PracticeStateError('v2/practice-state-conflict', 'Practice state was updated by another session.', 409);
      const record = { ...existing, namespace: 'v2', contentType: 'practice', ...identity, selectedLanguage, codeByLanguage: drafts, bookmarked: input.bookmarked === true, solved: existing?.solved === true, solvedAt: existing?.solvedAt ?? null, completedExecutionFingerprint: existing?.completedExecutionFingerprint ?? null, rewardGranted: existing?.rewardGranted === true, rewardGrantedAt: existing?.rewardGrantedAt ?? null, revision: revision + 1, createdAt: existing?.createdAt ?? FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      snapshot.exists ? transaction.update(reference, record) : transaction.create(reference, record);
      return publicState(record);
    });
  }
  async commit(uid, identity, assertion, practice) {
    const expected = await practiceContractFingerprints(practice), requiredIds = practice.publicTests.map(({ id }) => id);
    if (!assertion || assertion.contentId !== identity.contentId || assertion.publicationVersion !== identity.publicationVersion || assertion.executionMode !== practice.execution.mode || assertion.executionContractFingerprint !== expected.executionContractFingerprint || assertion.publicTestSetFingerprint !== expected.publicTestSetFingerprint) throw new V2PracticeStateError('v2/practice-completion-invalid-fingerprint', 'The execution assertion does not match this immutable publication.', 422);
    if (!practice.languages.supported.some(({ id }) => id === assertion.languageId)) throw new V2PracticeStateError('v2/practice-completion-invalid-language', 'The execution language is not supported.', 422);
    if (!Array.isArray(assertion.testIds) || assertion.testIds.length !== requiredIds.length || assertion.testIds.some((id, index) => id !== requiredIds[index]) || assertion.outcome?.total !== requiredIds.length || assertion.outcome?.passed !== requiredIds.length || assertion.outcome?.errors !== 0) throw new V2PracticeStateError('v2/practice-completion-incomplete', 'All immutable public tests must pass before completion.', 422);
    if (typeof assertion.requestId !== 'string' || !/^[a-z0-9-]{8,128}$/i.test(assertion.requestId)) throw new V2PracticeStateError('v2/practice-completion-invalid-request', 'A valid completion request ID is required.', 422);
    const reference = this.reference(uid, identity), rewardReference = this.db.doc(rewardPath(uid, identity.contentId)), now = this.timestamp();
    const persisted = await this.db.runTransaction(async (transaction) => {
      const [stateSnapshot, rewardSnapshot] = await transaction.getAll(reference, rewardReference); const existing = stateSnapshot.exists ? stateSnapshot.data() : null;
      const fingerprint = assertion.executionContractFingerprint; const record = { ...existing, namespace: 'v2', contentType: 'practice', ...identity, selectedLanguage: existing?.selectedLanguage ?? practice.languages.defaultLanguageId, codeByLanguage: existing?.codeByLanguage ?? {}, bookmarked: existing?.bookmarked === true, solved: true, solvedAt: existing?.solvedAt ?? now, completedExecutionFingerprint: fingerprint, rewardGranted: existing?.rewardGranted === true, rewardGrantedAt: existing?.rewardGrantedAt ?? null, revision: Number(existing?.revision ?? 0) + (existing?.solved ? 0 : 1), createdAt: existing?.createdAt ?? now, updatedAt: now };
      stateSnapshot.exists ? transaction.update(reference, record) : transaction.create(reference, record);
      if (!rewardSnapshot.exists) transaction.create(rewardReference, { namespace: 'v2', contentType: 'practice', contentId: identity.contentId, ownerUid: uid, status: 'PENDING', firstPublicationVersion: identity.publicationVersion, createdAt: now, updatedAt: now });
      return { state: record, rewardAlreadyGranted: rewardSnapshot.data?.()?.status === 'GRANTED' };
    });
    const idempotencyKey = `v2_practice_reward_${createHash('sha256').update(`${uid}\0${identity.contentId}`).digest('hex')}`;
    const reward = await this.ledger.grantCoins({ uid, amount: 5, type: COIN_TRANSACTION_TYPES.ACTIVITY_REWARD, sourceType: 'PRACTICE', sourceId: identity.contentId, idempotencyKey, policyVersion: 'mvp-v1' });
    await this.db.runTransaction(async (transaction) => { const [stateSnapshot, rewardSnapshot] = await transaction.getAll(reference, rewardReference); if (rewardSnapshot.exists) transaction.update(rewardReference, { status: 'GRANTED', amount: 5, transactionId: reward.transactionId, updatedAt: this.timestamp() }); if (stateSnapshot.exists) transaction.update(reference, { rewardGranted: true, rewardGrantedAt: stateSnapshot.data().rewardGrantedAt ?? this.timestamp(), updatedAt: this.timestamp() }); });
    return { ...publicState(persisted.state), rewardGranted: true, rewardGrantedAt: persisted.state.rewardGrantedAt ?? now, reward: { granted: !reward.duplicate, duplicate: reward.duplicate, amount: reward.duplicate ? 0 : 5, balance: reward.balance } };
  }
}
