import { createHash } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const base = process.env.COMPILER_PUBLIC_HTTP_BASE || 'http://127.0.0.1:13000';
const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-compiler-public-http';
const app = initializeApp({ projectId }, `compiler-http-${Date.now()}`);
const db = getFirestore(app);
const auth = getAuth(app);
const results = {};
const json = async (path, options = {}) => {
  const response = await fetch(`${base}${path}`, options);
  const text = await response.text();
  let body = null; try { body = JSON.parse(text); } catch { body = text; }
  return { response, body, text };
};
const post = (path, body, headers = {}) => json(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const assert = (value, message) => { if (!value) throw new Error(message); };
const clear = async (name) => { const snapshot = await db.collection(name).get(); for (let i = 0; i < snapshot.size; i += 400) { const batch = db.batch(); snapshot.docs.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref)); await batch.commit(); } };

try {
  await Promise.all(['compilerShares', 'compilerFeedback', 'compilerPublicRateLimits'].map(clear));
  const anonymous = await post('/api/compiler/share', { languageId: 'python', source: 'print("http anonymous")', stdin: 'ignored', ownerUid: 'spoof' }, { origin: 'http://127.0.0.1:13000', 'x-vercel-forwarded-for': '198.51.100.10' });
  assert(anonymous.response.status === 201, `anonymous share ${anonymous.response.status}: ${anonymous.text}`);
  assert(/^[A-Za-z0-9_-]{22}$/.test(anonymous.body.shareId), 'share ID shape');
  const anonymousDoc = (await db.collection('compilerShares').doc(anonymous.body.shareId).get()).data();
  assert(anonymousDoc.ownerUid === null && anonymousDoc.stdin === null && anonymousDoc.stdinIncluded === false, 'anonymous persisted privacy');
  assert(Math.abs(anonymousDoc.expiresAt.toMillis() - anonymousDoc.createdAt.toMillis() - 30 * 86400000) < 2, '30 day expiry');
  results.anonymousShare = { status: anonymous.response.status, shareIdLength: anonymous.body.shareId.length, cacheControl: anonymous.response.headers.get('cache-control'), ownerUid: anonymousDoc.ownerUid, stdinIncluded: anonymousDoc.stdinIncluded };

  const uid = `http-user-${Date.now()}`;
  const customToken = await auth.createCustomToken(uid);
  const signIn = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) });
  const signedIn = await signIn.json(); assert(signIn.ok, 'auth emulator sign in');
  const authenticated = await post('/api/compiler/share', { languageId: 'javascript', source: 'console.log("auth")', ownerUid: 'spoof' }, { authorization: `Bearer ${signedIn.idToken}`, origin: 'http://localhost:13000' });
  assert(authenticated.response.status === 201, `authenticated share ${authenticated.response.status}: ${authenticated.text}`);
  const authenticatedDoc = (await db.collection('compilerShares').doc(authenticated.body.shareId).get()).data();
  assert(authenticatedDoc.ownerUid === uid && !('ownerUid' in authenticated.body), 'authenticated ownership');
  const malformedAuth = await post('/api/compiler/share', { languageId: 'python', source: '' }, { authorization: 'Token bad', 'x-vercel-forwarded-for': '198.51.100.11' });
  const invalidAuth = await post('/api/compiler/share', { languageId: 'python', source: '' }, { authorization: 'Bearer definitely-not-a-token', 'x-vercel-forwarded-for': '198.51.100.12' });
  assert(malformedAuth.response.status === 401 && invalidAuth.response.status === 401, 'invalid auth rejection');
  assert(!malformedAuth.text.includes('Token bad') && !invalidAuth.text.includes('definitely-not'), 'token not echoed');
  results.authenticatedShare = { status: authenticated.response.status, ownerStored: authenticatedDoc.ownerUid === uid, ownerExposed: 'ownerUid' in authenticated.body };
  results.invalidAuth = [malformedAuth.response.status, invalidAuth.response.status];

  const read = await json(`/api/compiler/share/${anonymous.body.shareId}`, { headers: { origin: 'https://compiler.ycoders.com' } });
  assert(read.response.status === 200 && read.body.source === 'print("http anonymous")' && !('ownerUid' in read.body), 'public read');
  const record = { schemaVersion: 1, languageId: 'python', source: '', stdinIncluded: false, stdin: null, createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() - 1), status: 'active' };
  await db.collection('compilerShares').doc('EEEEEEEEEEEEEEEEEEEEEE').set(record);
  await db.collection('compilerShares').doc('RRRRRRRRRRRRRRRRRRRRRR').set({ ...record, expiresAt: Timestamp.fromMillis(Date.now() + 60000), status: 'removed' });
  const misses = await Promise.all(['UNKNOWNUNKNOWNUNKNOWNUN', 'bad', 'EEEEEEEEEEEEEEEEEEEEEE', 'RRRRRRRRRRRRRRRRRRRRRR'].map((id) => json(`/api/compiler/share/${id}`)));
  assert(misses.every(({ response, body }) => response.status === 404 && body.error?.code === 'compiler-share/not-found'), 'generic not found');
  results.shareRead = { status: read.response.status, cacheControl: read.response.headers.get('cache-control'), misses: misses.map((item) => item.response.status) };

  const methodStatuses = {};
  for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) methodStatuses[method] = (await json('/api/compiler/share', { method })).response.status;
  const plain = await json('/api/compiler/share', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
  const malformedJson = await json('/api/compiler/share', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
  const invalidPayload = await post('/api/compiler/share', []);
  const invalidLanguage = await post('/api/compiler/share', { languageId: 'Python', source: '' });
  const validationEvidence = { ...methodStatuses, plain: plain.response.status, malformedJson: malformedJson.response.status, invalidPayload: invalidPayload.response.status, invalidLanguage: invalidLanguage.response.status };
  assert(Object.values(methodStatuses).every((status) => status === 405) && plain.response.status === 415 && [400, 500].includes(malformedJson.response.status) && invalidPayload.response.status === 400 && invalidLanguage.response.status === 400, `transport validation ${JSON.stringify(validationEvidence)}`);
  assert(!malformedJson.text.includes('SyntaxError') && !malformedJson.text.includes('node_modules'), 'malformed JSON sanitized');
  results.validation = validationEvidence;

  const origins = {};
  for (const [name, origin] of Object.entries({ localhost: 'http://localhost:5173', loopback: 'http://127.0.0.1:5173', production: 'https://compiler.ycoders.com', hostile: 'https://evil.example', malformed: 'not a url' })) {
    origins[name] = (await post('/api/compiler/share', { languageId: 'python', source: '' }, { origin, 'x-vercel-forwarded-for': `203.0.113.${Object.keys(origins).length + 1}` })).response.status;
  }
  origins.none = (await post('/api/compiler/share', { languageId: 'python', source: '' }, { 'x-vercel-forwarded-for': '203.0.113.20' })).response.status;
  assert(origins.localhost === 201 && origins.loopback === 201 && origins.production === 201 && origins.none === 201 && origins.hostile === 403 && origins.malformed === 403, 'origin matrix');
  results.origins = origins;

  await clear('compilerPublicRateLimits');
  const rateStatuses = [];
  for (let index = 0; index < 11; index += 1) rateStatuses.push((await post('/api/compiler/share', { languageId: 'python', source: String(index) }, { 'x-vercel-forwarded-for': '192.0.2.100' })).response.status);
  assert(rateStatuses.slice(0, 10).every((status) => status === 201) && rateStatuses[10] === 429, `share HTTP rate limit ${JSON.stringify(rateStatuses)}`);
  results.shareRateLimit = rateStatuses;
  const shareRateBucketIds = (await db.collection('compilerPublicRateLimits').where('scope', '==', 'share').get()).docs.map((doc) => doc.id);

  const feedbackBody = { type: 'bug', description: 'HTTP feedback evidence', languageId: 'python', route: '/__compiler/python', source: 'private-source', stdin: 'private-stdin', stdout: 'private-out', stderr: 'private-err', email: 'private@example.com', name: 'Private', token: 'private-token', uid: 'spoof', arbitrary: 'private', context: { theme: 'dark' } };
  const anonymousFeedback = await post('/api/compiler/feedback', feedbackBody, { 'x-vercel-forwarded-for': '192.0.2.110' });
  const authenticatedFeedback = await post('/api/compiler/feedback', { ...feedbackBody, description: 'Authenticated HTTP feedback' }, { authorization: `Bearer ${signedIn.idToken}` });
  assert(anonymousFeedback.response.status === 201 && authenticatedFeedback.response.status === 201, 'feedback accepted');
  const feedbackDocs = (await db.collection('compilerFeedback').get()).docs.map((doc) => doc.data());
  assert(feedbackDocs.some((item) => item.userUid === null) && feedbackDocs.some((item) => item.userUid === uid), 'feedback ownership');
  const serializedFeedback = JSON.stringify(feedbackDocs);
  for (const secret of ['private-source', 'private-stdin', 'private-out', 'private-err', 'private@example.com', 'private-token', 'spoof']) assert(!serializedFeedback.includes(secret), `feedback excludes ${secret}`);
  await clear('compilerPublicRateLimits');
  const feedbackRate = [];
  for (let index = 0; index < 6; index += 1) feedbackRate.push((await post('/api/compiler/feedback', { type: 'general', description: `Feedback boundary ${index}` }, { 'x-vercel-forwarded-for': '192.0.2.120' })).response.status);
  assert(feedbackRate.slice(0, 5).every((status) => status === 201) && feedbackRate[5] === 429, `feedback HTTP rate limit ${JSON.stringify(feedbackRate)}`);
  results.feedback = { anonymous: anonymousFeedback.response.status, authenticated: authenticatedFeedback.response.status, stored: feedbackDocs.length, privacy: true, rateLimit: feedbackRate };

  const platformHash = createHash('sha256').update('192.0.2.100').digest('hex').slice(0, 32);
  const socketHashes = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].map((value) => createHash('sha256').update(value).digest('hex').slice(0, 32));
  results.proxy = { xVercelForwardedForHonored: shareRateBucketIds.some((id) => id.includes(platformHash)), socketFallbackMatched: socketHashes.some((hash) => shareRateBucketIds.some((id) => id.includes(hash))), bucketCount: shareRateBucketIds.length };
  results.headers = { contentType: read.response.headers.get('content-type'), cacheControl: read.response.headers.get('cache-control'), allowOrigin: read.response.headers.get('access-control-allow-origin'), sensitiveHeadersPresent: [...read.response.headers.keys()].some((key) => /token|credential|secret/i.test(key)) };
  console.log(JSON.stringify(results, null, 2));
} finally {
  await deleteApp(app);
}
