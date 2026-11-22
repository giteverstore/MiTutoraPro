import { createHash, randomUUID } from 'node:crypto';
import { V2_CHALLENGE_ASSIGNMENT_COLLECTION, createV2ChallengeAssignmentId } from './v2ChallengeIdentity.js';

const POLICY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PUBLICATION_COLLECTION = 'editorV2Publications';
export const CHALLENGE_TIMEZONE = 'Asia/Kolkata';

export class V2ChallengeAssignmentError extends Error { constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; } }

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const sha256 = (value) => `sha256:${createHash('sha256').update(canonicalize(value)).digest('hex')}`;
const list = (value) => [...new Set(String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean))];
const hash32 = (value) => { let result = 2166136261; for (const character of value) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); } return result >>> 0; };

export function challengeDateAt(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: CHALLENGE_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function candidateSnapshot(candidates) { return [...candidates].map(({ contentId, activePublicationVersion, difficulty, topics, supportedLanguages }) => ({ contentId, activePublicationVersion, difficulty, topics: [...topics].sort(), supportedLanguages: [...supportedLanguages].sort() })).sort((left, right) => left.contentId.localeCompare(right.contentId) || left.activePublicationVersion - right.activePublicationVersion); }
export const eligibilitySnapshotHash = (candidates) => sha256(candidateSnapshot(candidates));

function eligibility(policy, candidate) {
  if (candidate.state !== 'published' || !candidate.discoverable || !candidate.executionCompatible || !candidate.publicTestsValid || !candidate.supportedLanguages.length || !candidate.learnerDtoReady) return false;
  const source = policy.content.source;
  if (source.excludePracticeContentIds.includes(candidate.contentId) || (source.includePracticeContentIds.length && !source.includePracticeContentIds.includes(candidate.contentId))) return false;
  if (source.mode === 'fixed-practice' && source.fixedPracticeContentId !== candidate.contentId) return false;
  if (source.difficulties.length && !source.difficulties.includes(candidate.difficulty)) return false;
  if (source.topics.length && !source.topics.some((topic) => candidate.topics.includes(topic))) return false;
  return true;
}

function selectCandidate({ challengeDate, policy, candidates, seed = 'challenge-v1' }) {
  const ordered = [...candidates].sort((left, right) => left.contentId.localeCompare(right.contentId) || left.activePublicationVersion - right.activePublicationVersion);
  if (!ordered.length) throw new V2ChallengeAssignmentError('v2/challenge-no-eligible-practice', 'No eligible Practice publication is available.', 503);
  const input = `${seed}\0${challengeDate}\0${policy.id}\0${policy.content.policyVersion}\0${canonicalize(candidateSnapshot(ordered))}`;
  return ordered[hash32(input) % ordered.length];
}

function pointerGuard(snapshot) { const value = snapshot.data(); return { path: snapshot.ref.path, expected: { revision: value.revision, state: value.state, visibility: value.visibility, activeVersionNumber: value.activeVersionNumber, latestVersionNumber: value.latestVersionNumber } }; }
function versionGuard(snapshot) { const value = snapshot.data(); return { path: snapshot.ref.path, expected: { status: value.status, documentHash: value.documentHash, artifactHash: value.artifactHash } }; }
function sameGuard(actual, expected) { return Object.entries(expected).every(([key, value]) => actual?.[key] === value); }

export class FirestoreDailyChallengeAssignmentRepository {
  constructor(db) { this.db = db; }
  reference(challengeDate) { if (!DATE.test(challengeDate)) throw new V2ChallengeAssignmentError('v2/challenge-date-invalid', 'The Challenge date is invalid.', 400); return this.db.collection(V2_CHALLENGE_ASSIGNMENT_COLLECTION).doc(challengeDate); }
  async getByScope(policyId, challengeDate) { const snapshot = await this.reference(challengeDate).get(); if (!snapshot.exists) return null; const assignment = snapshot.data(); if (assignment.challengePolicyId !== policyId) throw new V2ChallengeAssignmentError('v2/challenge-assignment-scope-conflict', 'The date already belongs to another Challenge policy.', 409); return assignment; }
  async getHistoricalById(assignmentId) { const challengeDate = String(assignmentId).split(':').at(-1); if (!DATE.test(challengeDate ?? '')) return null; const snapshot = await this.reference(challengeDate).get(); return snapshot.exists && snapshot.data().assignmentId === assignmentId ? snapshot.data() : null; }
  async createIfAbsent(assignment, { guards = [], evidence = null } = {}) {
    const reference = this.reference(assignment.challengeDate);
    return this.db.runTransaction(async (transaction) => {
      const references = [reference, ...guards.map(({ path }) => this.db.doc(path))];
      const [existing, ...guardSnapshots] = await transaction.getAll(...references);
      if (existing.exists) return { created: false, assignment: existing.data() };
      if (guardSnapshots.some((snapshot, index) => !snapshot.exists || !sameGuard(snapshot.data(), guards[index].expected))) throw new V2ChallengeAssignmentError('v2/challenge-assignment-stale-context', 'Challenge eligibility changed before assignment creation.', 409);
      transaction.create(reference, assignment);
      if (evidence) transaction.create(this.db.collection('dailyChallengeAssignmentAudits').doc(assignment.challengeDate), { ...evidence, assignmentId: assignment.assignmentId, assignmentHash: sha256(assignment) });
      return { created: true, assignment };
    });
  }
}

export class FirestoreChallengeAssignmentContext {
  constructor(db, environment = process.env) { this.db = db; this.environment = environment; }
  async resolve() {
    const policyId = String(this.environment.V2_CHALLENGE_POLICY_CONTENT_ID ?? '');
    const policyVersion = Number(this.environment.V2_CHALLENGE_POLICY_VERSION);
    const candidateIds = list(this.environment.V2_CHALLENGE_CANDIDATE_CONTENT_IDS);
    if (!POLICY_ID.test(policyId) || !Number.isSafeInteger(policyVersion) || policyVersion < 1 || !candidateIds.length || candidateIds.some((id) => !POLICY_ID.test(id))) throw new V2ChallengeAssignmentError('v2/challenge-configuration-invalid', 'Challenge assignment configuration is incomplete.', 503);
    const policyPointerRef = this.db.collection(PUBLICATION_COLLECTION).doc(policyId), policyVersionRef = policyPointerRef.collection('versions').doc(String(policyVersion));
    const [policyPointerSnapshot, policyVersionSnapshot] = await this.db.getAll(policyPointerRef, policyVersionRef);
    if (!policyPointerSnapshot.exists || !policyVersionSnapshot.exists) throw new V2ChallengeAssignmentError('v2/challenge-policy-not-found', 'The configured Challenge policy was not found.', 503);
    const pointer = policyPointerSnapshot.data(), record = policyVersionSnapshot.data(), policy = record.document;
    if (pointer.state !== 'published' || pointer.visibility !== 'public' || pointer.activeVersionNumber !== policyVersion || record.status !== 'READY' || policy?.id !== policyId || policy?.contentType !== 'challenge' || policy?.content?.kind !== 'policy' || policy.content.policyVersion !== policyVersion || policy.content.enabled !== true) throw new V2ChallengeAssignmentError('v2/challenge-policy-unavailable', 'The configured Challenge policy is not publicly active.', 503);
    const candidates = [], guards = [pointerGuard(policyPointerSnapshot), versionGuard(policyVersionSnapshot)];
    for (const contentId of candidateIds) {
      const pointerRef = this.db.collection(PUBLICATION_COLLECTION).doc(contentId), pointerSnapshot = await pointerRef.get();
      if (!pointerSnapshot.exists) continue;
      const candidatePointer = pointerSnapshot.data(), version = Number(candidatePointer.activeVersionNumber ?? candidatePointer.latestVersionNumber);
      if (!Number.isSafeInteger(version) || version < 1) { guards.push(pointerGuard(pointerSnapshot)); continue; }
      const versionSnapshot = await pointerRef.collection('versions').doc(String(version)).get();
      guards.push(pointerGuard(pointerSnapshot)); if (!versionSnapshot.exists) continue; guards.push(versionGuard(versionSnapshot));
      const candidateRecord = versionSnapshot.data(), document = candidateRecord.document, content = document?.content;
      candidates.push({ contentId, activePublicationVersion: version, state: candidatePointer.state, discoverable: candidatePointer.visibility === 'public' && Number.isSafeInteger(candidatePointer.activeVersionNumber), difficulty: content?.difficulty, topics: content?.questionMetadata?.topics ?? [], executionCompatible: Boolean(content?.execution), publicTestsValid: Boolean(content?.executablePublicTests?.length), supportedLanguages: content?.languages?.supported?.map(({ id }) => id) ?? [], learnerDtoReady: candidateRecord.compatibilitySnapshot?.learnerIntegrationReady === true });
    }
    return { policy, candidates, guards, policyRecord: record };
  }
}

export class DailyChallengeAssignmentService {
  constructor({ repository, context, now = () => new Date(), correlationId = randomUUID } = {}) { this.repository = repository; this.context = context; this.now = now; this.correlationId = correlationId; }
  async getOrCreateToday() { return this.getOrCreate(challengeDateAt(this.now())); }
  async getOrCreate(challengeDate) {
    const { policy, candidates, guards } = await this.context.resolve();
    const existing = await this.repository.getByScope(policy.id, challengeDate); if (existing) return { created: false, assignment: existing };
    const eligible = candidates.filter((candidate) => eligibility(policy, candidate)), snapshotHash = eligibilitySnapshotHash(eligible), selected = selectCandidate({ challengeDate, policy, candidates: eligible });
    const assignment = { schemaVersion: '1.0.0', assignmentId: createV2ChallengeAssignmentId(policy.id, challengeDate), challengeDate, timezone: CHALLENGE_TIMEZONE, challengePolicyId: policy.id, challengePolicyVersion: policy.content.policyVersion, practiceContentId: selected.contentId, practicePublicationVersion: selected.activePublicationVersion, rewardCoins: policy.content.rewards.coins, rewardPolicyVersion: policy.content.rewards.policyVersion, streakIncrement: policy.content.rewards.streakIncrement, practiceRewardMode: policy.content.rewards.practiceRewardMode, restrictions: structuredClone(policy.content.restrictions), assignedAt: this.now().toISOString(), assignmentSource: policy.content.source.mode === 'fixed-practice' ? 'fixed-practice' : 'deterministic-pool', eligibilitySnapshotHash: snapshotHash };
    const evidence = { challengeDate, challengePolicyId: policy.id, challengePolicyVersion: policy.content.policyVersion, eligibleCandidateCount: eligible.length, eligibilitySnapshotHash: snapshotHash, deterministicSeed: 'challenge-v1', selectedPracticeContentId: selected.contentId, selectedPracticePublicationVersion: selected.activePublicationVersion, correlationId: this.correlationId(), recordedAt: assignment.assignedAt };
    return this.repository.createIfAbsent(assignment, { guards, evidence });
  }
}

export function publicAssignment(assignment) {
  const fields = ['schemaVersion','assignmentId','challengeDate','timezone','challengePolicyId','challengePolicyVersion','practiceContentId','practicePublicationVersion','rewardCoins','rewardPolicyVersion','streakIncrement','practiceRewardMode','restrictions','assignedAt','assignmentSource','eligibilitySnapshotHash'];
  return Object.fromEntries(fields.map((field) => [field, structuredClone(assignment[field])]));
}

