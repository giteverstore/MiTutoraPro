import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { productionActivityVerificationBoundary } from '../functions/src/activity-verification/ProductionActivityVerificationBoundary.js';

const root = resolve(import.meta.dirname, '..');
const practiceMetadata = JSON.parse(await readFile(resolve(root, 'firebase-content/firestore/practiceQuestions.json'), 'utf8'));
const dailyMetadata = JSON.parse(await readFile(resolve(root, 'firebase-content/firestore/dailyChallenges.json'), 'utf8'));
const fixtureRoot = resolve(root, 'scripts/fixtures');
const fixtureFiles = (await readdir(fixtureRoot)).filter((name) => /^practice-bank-batch-\d+\.private\.mjs$/.test(name));
const protectedIds = new Set();
for (const file of fixtureFiles) {
  const fixture = await import(pathToFileURL(resolve(fixtureRoot, file)));
  for (const [id, tests] of Object.entries(fixture.protectedTests ?? {})) {
    if (!Array.isArray(tests) || tests.length === 0) throw new Error(`Missing protected tests for ${id}.`);
    if (protectedIds.has(id)) throw new Error(`Duplicate protected tests for ${id}.`);
    protectedIds.add(id);
  }
}

const practiceWithoutProtectedTests = [];
for (const metadata of practiceMetadata) {
  const versionedPath = metadata.storagePath.replace(/\/([^/]+)$/, `/${metadata.version}/$1`);
  const bytes = await readFile(resolve(root, 'firebase-content', versionedPath));
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== metadata.contentHash) throw new Error(`Practice content hash mismatch for ${metadata.id}.`);
  if (!protectedIds.has(metadata.id)) practiceWithoutProtectedTests.push(metadata.id);
  const text = bytes.toString('utf8');
  if (text.includes('protectedTests') || text.includes('referenceImplementations')) {
    throw new Error(`Protected verification content leaked into ${metadata.id}.`);
  }
}

const dailyWithHashes = dailyMetadata.filter((item) => /^[a-f0-9]{64}$/.test(item.contentHash ?? '')).length;
if (productionActivityVerificationBoundary.enabled
  || productionActivityVerificationBoundary.endpointExposed
  || productionActivityVerificationBoundary.rewardActivationEnabled) {
  throw new Error('Production activity verification must remain disabled.');
}

console.log(JSON.stringify({
  boundaryContract: 'ready',
  productionEndpoint: 'disabled',
  rewardActivation: 'disabled',
  practiceQuestions: practiceMetadata.length,
  practiceQuestionsWithCanonicalHashes: practiceMetadata.filter((item) => /^[a-f0-9]{64}$/.test(item.contentHash ?? '')).length,
  practiceQuestionsWithPrivateTests: protectedIds.size,
  practiceQuestionsWithoutPrivateTests: practiceWithoutProtectedTests.length,
  learnerArtifactsWithProtectedContent: 0,
  dailyChallenges: dailyMetadata.length,
  dailyChallengesWithCanonicalHashes: dailyWithHashes,
  compliantExecutionSandbox: 'not-configured',
}, null, 2));
