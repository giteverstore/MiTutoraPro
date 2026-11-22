import { createHash, randomUUID } from 'node:crypto';
import { V2_CHALLENGE_ASSIGNMENT_COLLECTION, createV2ChallengeAssignmentId } from './v2ChallengeIdentity.js';
import { createServiceAssertionProvider, ServiceAssertionError } from './ServiceAssertion.js';

const POLICY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PUBLICATION_COLLECTION = 'editorV2Publications';
export const CHALLENGE_TIMEZONE = 'Asia/Kolkata';

export class V2ChallengeAssignmentError extends Error { constructor(code, message, status = 400, details = null) { super(message); this.code = code; this.status = status; this.details = details; } }

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const sha256 = (value) => `sha256:${createHash('sha256').update(canonicalize(value)).digest('hex')}`;
const hash32 = (value) => { let result = 2166136261; for (const character of value) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); } return result >>> 0; };

export function challengeDateAt(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: CHALLENGE_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function candidateSnapshot(candidates) { return [...candidates].map(({ contentId, activePublicationVersion, difficulty, topics, supportedLanguages }) => ({ contentId, activePublicationVersion, difficulty, topics: [...topics].sort(), supportedLanguages: [...supportedLanguages].sort() })).sort((left, right) => left.contentId.localeCompare(right.contentId) || left.activePublicationVersion - right.activePublicationVersion); }
export const eligibilitySnapshotHash = (candidates) => sha256(candidateSnapshot(candidates));

export function candidateEligibilityFindings(policy, candidate) {
  const findings=[];
  if (candidate.namespace !== 'v2' || candidate.contentType !== 'practice') findings.push('learner-dto-incompatible');
  if (candidate.state !== 'published') findings.push('publication-not-published');
  if (!candidate.discoverable) findings.push('publication-not-discoverable');
  if (!candidate.executionCompatible) findings.push('practice-runtime-incompatible');
  if (!candidate.publicTestsValid) findings.push('public-tests-invalid');
  if (!candidate.supportedLanguages.length) findings.push('no-supported-language');
  if (!candidate.learnerDtoReady) findings.push('learner-dto-incompatible');
  const source = policy.content.source;
  if (source.excludePracticeContentIds.includes(candidate.contentId)) findings.push('excluded-by-policy');
  if (source.includePracticeContentIds.length && !source.includePracticeContentIds.includes(candidate.contentId)) findings.push('not-included-by-policy');
  if (source.mode === 'fixed-practice' && source.fixedPracticeContentId !== candidate.contentId) findings.push('fixed-practice-mismatch');
  if (source.difficulties.length && !source.difficulties.includes(candidate.difficulty)) findings.push('difficulty-mismatch');
  if (source.topics.length && !source.topics.some((topic) => candidate.topics.includes(topic))) findings.push('topic-mismatch');
  return findings.length ? findings : ['eligible'];
}
const eligibility = (policy,candidate) => candidateEligibilityFindings(policy,candidate)[0] === 'eligible';

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
  constructor(db, environment = process.env, candidateSource) { this.db = db; this.environment = environment; this.candidateSource = candidateSource; }
  async resolve() {
    const policyId = String(this.environment.V2_CHALLENGE_POLICY_CONTENT_ID ?? '');
    const policyVersion = Number(this.environment.V2_CHALLENGE_POLICY_VERSION);
    if (!POLICY_ID.test(policyId) || !Number.isSafeInteger(policyVersion) || policyVersion < 1 || !this.candidateSource) throw new V2ChallengeAssignmentError('v2/challenge-configuration-invalid', 'Challenge assignment configuration is incomplete.', 503);
    const policyPointerRef = this.db.collection(PUBLICATION_COLLECTION).doc(policyId), policyVersionRef = policyPointerRef.collection('versions').doc(String(policyVersion));
    const [policyPointerSnapshot, policyVersionSnapshot] = await this.db.getAll(policyPointerRef, policyVersionRef);
    if (!policyPointerSnapshot.exists || !policyVersionSnapshot.exists) throw new V2ChallengeAssignmentError('v2/challenge-policy-not-found', 'The configured Challenge policy was not found.', 503);
    const pointer = policyPointerSnapshot.data(), record = policyVersionSnapshot.data(), policy = record.document;
    if (pointer.state !== 'published' || pointer.visibility !== 'public' || pointer.activeVersionNumber !== policyVersion || record.status !== 'READY' || policy?.id !== policyId || policy?.contentType !== 'challenge' || policy?.content?.kind !== 'policy' || policy.content.policyVersion !== policyVersion || policy.content.enabled !== true) throw new V2ChallengeAssignmentError('v2/challenge-policy-unavailable', 'The configured Challenge policy is not publicly active.', 503);
    const candidates = await this.candidateSource.list(), guards = [pointerGuard(policyPointerSnapshot), versionGuard(policyVersionSnapshot)];
    for (const candidate of candidates) {
      const { contentId, activePublicationVersion: version } = candidate;
      if (!POLICY_ID.test(contentId) || !Number.isSafeInteger(version) || version < 1) throw new V2ChallengeAssignmentError('v2/challenge-candidate-projection-invalid', 'The authoritative candidate projection is invalid.', 503);
      const pointerRef = this.db.collection(PUBLICATION_COLLECTION).doc(contentId), pointerSnapshot = await pointerRef.get();
      if (!pointerSnapshot.exists) throw new V2ChallengeAssignmentError('v2/challenge-assignment-stale-context', 'A projected Practice pointer no longer exists.', 409);
      const versionSnapshot = await pointerRef.collection('versions').doc(String(version)).get();
      guards.push(pointerGuard(pointerSnapshot)); if (!versionSnapshot.exists) throw new V2ChallengeAssignmentError('v2/challenge-assignment-stale-context', 'A projected Practice version no longer exists.', 409); guards.push(versionGuard(versionSnapshot));
    }
    return { policy, candidates, guards, policyRecord: record };
  }
}

export class HttpChallengeCandidateSource {
  constructor(environment=process.env, fetchImpl=globalThis.fetch, assertionProvider=createServiceAssertionProvider(environment), correlationId=randomUUID()) { this.environment=environment; this.fetch=fetchImpl; this.assertionProvider=assertionProvider; this.correlationId=correlationId; }
  async list() {
    const base=String(this.environment.V2_DELIVERY_SERVICE_URL??'').replace(/\/+$/,''); const path='/api/v2/gateway/challenge-candidates';
    if(!base) throw new V2ChallengeAssignmentError('v2/upstream-unconfigured','Challenge candidate delivery is not configured.',503);
    let authorization; try{authorization=await this.assertionProvider.authorization({method:'GET',path,correlationId:this.correlationId,targetUrl:`${base}${path}`})}catch(error){if(error instanceof ServiceAssertionError)throw new V2ChallengeAssignmentError(error.code,error.message,503);throw error}
    const response=await this.fetch(`${base}${path}`,{headers:{Authorization:authorization,'X-Correlation-Id':this.correlationId,Accept:'application/json'}}); const body=await response.json().catch(()=>null);
    if(!response.ok||!Array.isArray(body?.data))throw new V2ChallengeAssignmentError(body?.error?.code??'v2/challenge-candidates-unavailable',body?.error?.message??'Authoritative Practice candidates are unavailable.',response.status||503);
    return body.data;
  }
}

export class DailyChallengeAssignmentService {
  constructor({ repository, context, now = () => new Date(), correlationId = randomUUID } = {}) { this.repository = repository; this.context = context; this.now = now; this.correlationId = correlationId; }
  async getOrCreateToday() { return this.getOrCreate(challengeDateAt(this.now())); }
  async getHistorical(challengeDate) {
    const today=challengeDateAt(this.now());
    if(challengeDate>today)throw new V2ChallengeAssignmentError('v2/challenge-date-future','Future Daily Challenges are not available.',422);
    const policyId=String(this.context.environment?.V2_CHALLENGE_POLICY_CONTENT_ID??'');
    const assignment=await this.repository.getHistoricalById(createV2ChallengeAssignmentId(policyId,challengeDate));
    if(!assignment)throw new V2ChallengeAssignmentError('v2/challenge-assignment-not-found','The Daily Challenge assignment is unavailable.',404);
    return {created:false,assignment};
  }
  async getOrCreate(challengeDate) {
    const { policy, candidates, guards } = await this.context.resolve();
    const existing = await this.repository.getByScope(policy.id, challengeDate); if (existing) return { created: false, assignment: existing };
    const diagnostics=candidates.map((candidate)=>({contentId:candidate.contentId,publicationVersion:candidate.activePublicationVersion,findingCodes:candidateEligibilityFindings(policy,candidate)})); const eligible = candidates.filter((candidate) => eligibility(policy, candidate));
    if(!eligible.length)throw new V2ChallengeAssignmentError('v2/challenge-no-eligible-practice','No eligible Practice publication is available.',503,diagnostics);
    const snapshotHash = eligibilitySnapshotHash(eligible), selected = selectCandidate({ challengeDate, policy, candidates: eligible });
    const assignment = { schemaVersion: '1.0.0', assignmentId: createV2ChallengeAssignmentId(policy.id, challengeDate), challengeDate, timezone: CHALLENGE_TIMEZONE, challengePolicyId: policy.id, challengePolicyVersion: policy.content.policyVersion, practiceContentId: selected.contentId, practicePublicationVersion: selected.activePublicationVersion, rewardCoins: policy.content.rewards.coins, rewardPolicyVersion: policy.content.rewards.policyVersion, streakIncrement: policy.content.rewards.streakIncrement, practiceRewardMode: policy.content.rewards.practiceRewardMode, restrictions: structuredClone(policy.content.restrictions), assignedAt: this.now().toISOString(), assignmentSource: policy.content.source.mode === 'fixed-practice' ? 'fixed-practice' : 'deterministic-pool', eligibilitySnapshotHash: snapshotHash };
    const evidence = { challengeDate, challengePolicyId: policy.id, challengePolicyVersion: policy.content.policyVersion, eligibleCandidateCount: eligible.length, eligibilitySnapshotHash: snapshotHash, deterministicSeed: 'challenge-v1', selectedPracticeContentId: selected.contentId, selectedPracticePublicationVersion: selected.activePublicationVersion, correlationId: this.correlationId(), recordedAt: assignment.assignedAt };
    return this.repository.createIfAbsent(assignment, { guards, evidence });
  }
}

export function publicAssignment(assignment) {
  const fields = ['schemaVersion','assignmentId','challengeDate','timezone','challengePolicyId','challengePolicyVersion','practiceContentId','practicePublicationVersion','rewardCoins','rewardPolicyVersion','streakIncrement','practiceRewardMode','restrictions','assignedAt','assignmentSource','eligibilitySnapshotHash'];
  return Object.fromEntries(fields.map((field) => [field, structuredClone(assignment[field])]));
}

