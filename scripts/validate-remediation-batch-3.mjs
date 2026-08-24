import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ContentCache } from '../src/content/cache/ContentCache.js';
import { verifyContentIntegrity } from '../src/content/utils/contentIntegrity.js';
import { createPracticeSourceAdapter } from '../src/practice/practiceContentSourceCore.js';
import { ContentPublicationProtocol } from './publishing/ContentPublicationProtocol.mjs';
import { loadPracticeBundle } from './publishing/loadPracticeBundle.mjs';
import { loadAndValidateCourseBundle } from './publishing/loadCourseBundle.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const makeQuestions = (count) => Array.from({ length: count }, (_, index) => ({ id: `q-${index + 1}`, title: `Question ${index + 1}`, summary: 'Summary', topic: index % 2 ? 'B' : 'A', category: 'Fundamentals', skills: [], difficulty: 'Easy', position: index + 1 }));
const noFirebase = { getPublication: async () => { throw new Error('Firebase must not be contacted.'); } };

for (const count of [0, 1, 24, 25, 73]) {
  const source = createPracticeSourceAdapter({ source: 'local', firebaseService: noFirebase, localQuestions: makeQuestions(count) });
  let cursor = null;
  const ids = [];
  do {
    const page = await source.listPage({ cursor, filters: {}, pageSize: 24 });
    ids.push(...page.items.map(({ id }) => id));
    cursor = page.cursor;
    if (!page.hasMore) break;
  } while (true);
  assert(ids.length === count, `Local pagination skipped an item for catalog size ${count}.`);
  assert(new Set(ids).size === count, `Local pagination duplicated an item for catalog size ${count}.`);
}

const local = createPracticeSourceAdapter({ source: 'local', firebaseService: noFirebase, localQuestions: makeQuestions(30) });
const filtered = await local.listPage({ filters: { topic: 'B' }, pageSize: 5 });
const reset = await local.listPage({ filters: {}, cursor: null, pageSize: 5 });
assert(filtered.items.every(({ topic }) => topic === 'B') && reset.items[0].id === 'q-1', 'Changing filters must reset pagination deterministically.');
await assertRejects(
  () => createPracticeSourceAdapter({ source: 'local', firebaseService: noFirebase, localQuestions: null }).listPage({ filters: {} }),
  'A broken local catalog must surface an error.',
);
await assertRejects(
  () => createPracticeSourceAdapter({ source: 'firebase', firebaseService: { getPublication: async () => { throw new Error('firebase failed'); } }, localQuestions: makeQuestions(1) }).listPage({ filters: {} }),
  'Explicit Firebase failure must not silently use local content.',
);

let metadataCalls = 0;
let bodyCalls = 0;
let failBody = true;
const firebaseQuestions = makeQuestions(49).map((item) => ({ ...item, published: true, version: 'v2', contentHash: 'a'.repeat(64) }));
const fakeService = {
  getPublication: async () => ({ activeVersion: 'v2', integrityRequired: true, facets: { difficulties: ['Easy'], topics: ['A', 'B'] } }),
  listMetadataPage: async ({ query }) => {
    metadataCalls += 1;
    const start = Number(query.cursor?.offset ?? 0);
    const items = firebaseQuestions.filter((item) => query.filters.every(({ field, value }) => item[field] === value)).slice(start, start + query.limit);
    const next = start + items.length;
    return { items, cursor: next < firebaseQuestions.length ? { offset: next } : null, hasMore: next < firebaseQuestions.length };
  },
  getQuestionFromMetadata: async (metadata) => {
    bodyCalls += 1;
    if (failBody) throw new Error('simulated object failure');
    return { content: { ...metadata, blocks: [{ type: 'compiler' }] } };
  },
  getMetadata: async (id) => firebaseQuestions.find((item) => item.id === id),
  invalidateQuestion: () => {},
};
const firebase = createPracticeSourceAdapter({ source: 'firebase', firebaseService: fakeService, localQuestions: [] });
const firstPage = await firebase.listPage({ filters: {}, pageSize: 24 });
assert(firstPage.items.length === 24 && metadataCalls === 1 && bodyCalls === 0, 'Catalog listing must be metadata-only.');
await firebase.loadQuestion(firstPage.items[0]).catch(() => {});
assert(firstPage.items.length === 24, 'A selected question failure must not destroy catalog metadata.');
failBody = false;
await firebase.retryQuestion(firstPage.items[0]);
assert(bodyCalls === 2, 'A failed selected question must be retryable.');

const cache = new ContentCache({ maxEntries: 2 });
let factoryCalls = 0;
await Promise.all([cache.getOrCreate('same', async () => { factoryCalls += 1; return {}; }), cache.getOrCreate('same', async () => { factoryCalls += 1; return {}; })]);
assert(factoryCalls === 1, 'Concurrent content requests must deduplicate.');
cache.set('two', 2); cache.set('three', 3);
assert(!cache.has('same') && cache.has('two') && cache.has('three'), 'Content cache must enforce its configured bound.');

const bytes = new TextEncoder().encode('{"valid":true}');
const validHash = createHash('sha256').update(bytes).digest('hex');
assert(await verifyContentIntegrity(bytes, validHash, 'test.json') === validHash, 'Valid hashes must pass.');
await assertRejects(() => verifyContentIntegrity(new TextEncoder().encode('{"valid":false}'), validHash, 'test.json'), 'Tampered content must fail integrity verification.');
await assertRejects(() => verifyContentIntegrity(bytes, '', 'test.json'), 'Missing required hashes must fail.');
await assertRejects(() => verifyContentIntegrity(bytes, 'invalid', 'test.json'), 'Malformed hashes must fail.');

async function assertRejects(operation, message) { let rejected = false; try { await operation(); } catch { rejected = true; } assert(rejected, message); }
async function runProtocolFailure(stage) {
  let activeVersion = 'v1';
  const protocol = new ContentPublicationProtocol();
  await protocol.execute({
    upload: async () => { if (stage === 'upload') throw new Error('injected'); },
    verify: async () => { if (stage === 'verify') throw new Error('injected'); return { ok: true }; },
    markReady: async () => { if (stage === 'ready') throw new Error('injected'); },
    activate: async () => { if (stage === 'activate') throw new Error('injected'); activeVersion = 'v2'; },
  }).catch(() => {});
  assert(activeVersion === (stage ? 'v1' : 'v2'), `Publication failure at ${stage} changed the active version.`);
}
for (const stage of ['upload', 'verify', 'ready', 'activate']) await runProtocolFailure(stage);
await runProtocolFailure(null);
await runProtocolFailure(null);

const practiceBundle = await loadPracticeBundle();
for (const file of practiceBundle.files) assert(createHash('sha256').update(await readFile(file.localPath)).digest('hex') === file.sha256, `${file.remotePath} is not hashed deterministically.`);
for (const course of ['python', 'java']) {
  const bundle = await loadAndValidateCourseBundle(course);
  assert(bundle.files.every(({ sha256 }) => /^[a-f0-9]{64}$/.test(sha256)), `${course} course artifacts require SHA-256 hashes.`);
  assert(bundle.metadata.contentIntegrity?.manifest, `${course} course manifest integrity metadata is missing.`);
}

console.log(JSON.stringify({
  metadataFirst: 'passed', partialFailureAndRetry: 'passed', paginationCases: [0, 1, 24, 25, 73],
  cacheBoundAndDeduplication: 'passed', integrity: 'passed', publicationFailureInjection: 'passed',
  practiceArtifacts: practiceBundle.files.length, courseBundles: ['python', 'java'],
}, null, 2));
