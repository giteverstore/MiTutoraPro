import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const base = process.env.COMPILER_PUBLIC_HTTP_BASE || 'http://127.0.0.1:13000';
const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-public-mysql-e2e';
const app = initializeApp({ projectId }, `mysql-http-${Date.now()}`);
const auth = getAuth(app);
const db = getFirestore(app);
const result = {};
const assert = (value, message) => { if (!value) throw new Error(message); };
const clearCollection = async (name) => {
  const snapshot = await db.collection(name).get();
  if (snapshot.empty) return;
  const batch = db.batch(); snapshot.docs.forEach((document) => batch.delete(document.ref)); await batch.commit();
};
const clearQuota = async () => {
  await clearCollection('compilerPublicMysqlRateLimits');
  await Promise.all([
    db.doc('compilerPublicMysqlRuntime/global').delete().catch(() => undefined),
  ]);
};
const request = async ({ body, raw, headers = {}, method = 'POST', identity = '198.51.100.1' } = {}) => {
  const response = await fetch(`${base}/api/compiler/mysql/public`, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), 'x-vercel-forwarded-for': identity, ...headers },
    ...(method === 'POST' ? { body: raw ?? JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let payload; try { payload = JSON.parse(text); } catch { payload = text; }
  return { response, payload, text };
};
const createIdToken = async (uid) => {
  const customToken = await auth.createCustomToken(uid);
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) });
  const payload = await response.json(); assert(response.ok, `Auth emulator sign-in failed for ${uid}`); return payload.idToken;
};

try {
  await clearQuota();
  const anonymous = await request({ body: { sql: 'SELECT 1 AS value;' }, headers: { origin: 'http://127.0.0.1:13000' } });
  assert(anonymous.response.status === 200 && String(anonymous.payload.database.resultSets[0].rows[0][0]) === '1', `anonymous: ${anonymous.response.status} ${anonymous.text}`);
  assert(!/(password|yc_run_|yc_sbx_)/i.test(anonymous.text), 'anonymous response leaked credentials');
  result.anonymous = { status: anonymous.response.status, cacheControl: anonymous.response.headers.get('cache-control'), contentType: anonymous.response.headers.get('content-type') };

  const uid = `mysql-http-${Date.now()}`;
  const idToken = await createIdToken(uid);
  const authenticated = await request({ body: { sql: 'SELECT 2 AS value;' }, headers: { authorization: `Bearer ${idToken}` }, identity: '198.51.100.2' });
  assert(authenticated.response.status === 200 && !authenticated.text.includes(uid), 'authenticated execution/UID privacy');
  const quotaDocs = await db.collection('compilerPublicMysqlRateLimits').get();
  assert(quotaDocs.docs.some((document) => document.data().authenticated === true), 'authenticated quota path absent');
  result.authenticated = { status: 200, uidExposed: false };

  const malformedAuth = await request({ body: { sql: 'SELECT 1;' }, headers: { authorization: 'Token bad' }, identity: '198.51.100.3' });
  const invalidAuth = await request({ body: { sql: 'SELECT 1;' }, headers: { authorization: 'Bearer invalid' }, identity: '198.51.100.4' });
  assert(malformedAuth.response.status === 401 && invalidAuth.response.status === 401, 'invalid auth downgraded');
  result.invalidAuth = [malformedAuth.response.status, invalidAuth.response.status];

  const validations = {};
  for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) validations[method] = (await request({ method, identity: `198.51.100.${10 + Object.keys(validations).length}` })).response.status;
  validations.contentType = (await request({ raw: JSON.stringify({ sql: 'SELECT 1;' }), headers: { 'content-type': 'text/plain' }, identity: '198.51.100.20' })).response.status;
  validations.malformed = (await request({ raw: '{', headers: { 'content-type': 'application/json' }, identity: '198.51.100.21' })).response.status;
  for (const [name, body] of Object.entries({ extra: { sql: 'SELECT 1;', uid: 'spoof' }, setup: { sql: 'SELECT 1;', setupSql: 'CREATE TABLE hidden(id INT)' }, host: { sql: 'SELECT 1;', host: 'internal' }, empty: { sql: '' }, oversized: { sql: 'x'.repeat(65_537) } })) validations[name] = (await request({ body, identity: `198.51.100.${22 + Object.keys(validations).length}` })).response.status;
  assert(['GET', 'PUT', 'PATCH', 'DELETE'].every((key) => validations[key] === 405) && validations.contentType === 415 && validations.malformed === 400 && validations.extra === 400 && validations.setup === 400 && validations.host === 400 && validations.empty === 400 && validations.oversized === 413, `validation ${JSON.stringify(validations)}`);
  result.validation = validations;

  const origins = {};
  for (const [name, origin] of Object.entries({ production: 'https://compiler.ycoders.com', localhost: 'http://localhost:5173', loopback: 'http://127.0.0.1:5173', hostile: 'https://evil.example', malformed: 'not-a-url' })) { await clearQuota(); origins[name] = (await request({ body: { sql: 'SELECT 1;' }, headers: { origin }, identity: `203.0.113.${Object.keys(origins).length + 1}` })).response.status; }
  await clearQuota();
  origins.none = (await request({ body: { sql: 'SELECT 1;' }, identity: '203.0.113.20' })).response.status;
  assert(origins.production === 200 && origins.localhost === 200 && origins.loopback === 200 && origins.none === 200 && origins.hostile === 403 && origins.malformed === 403, `origins ${JSON.stringify(origins)}`);
  result.origins = origins;

  await clearQuota();
  const rate = [];
  for (let index = 0; index < 11; index += 1) rate.push((await request({ body: { sql: `SELECT ${index};` }, identity: '192.0.2.100' })).response.status);
  assert(rate.slice(0, 10).every((status) => status === 200) && rate[10] === 429, `rate ${rate}`);
  result.rate = rate;

  await clearQuota();
  const long = request({ body: { sql: 'SELECT SLEEP(5);' }, identity: '192.0.2.110' });
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  const same = await request({ body: { sql: 'SELECT 1;' }, identity: '192.0.2.110' });
  const otherToken = await createIdToken(`mysql-other-${Date.now()}`);
  const other = await request({ body: { sql: 'SELECT 1;' }, headers: { authorization: `Bearer ${otherToken}` }, identity: '192.0.2.111' });
  await long;
  assert(same.response.status === 429 && other.response.status === 200, `identity concurrency ${same.response.status}/${other.response.status}`);
  result.identityConcurrency = { same: same.response.status, other: other.response.status };

  await clearQuota();
  const capacityTokens = await Promise.all([1, 2, 3, 4, 5].map((value) => createIdToken(`mysql-capacity-${Date.now()}-${value}`)));
  const active = [1, 2, 3, 4].map((value) => request({ body: { sql: 'SELECT SLEEP(5);' }, headers: { authorization: `Bearer ${capacityTokens[value - 1]}` }, identity: `192.0.2.${120 + value}` }));
  const capacityDeadline = Date.now() + 6_000;
  let fifth;
  let fifthAttempts = 0;
  do {
    fifthAttempts += 1;
    fifth = await request({ body: { sql: 'SELECT 1;' }, headers: { authorization: `Bearer ${capacityTokens[4]}` }, identity: '192.0.2.130' });
    if (fifth.response.status === 503) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (fifthAttempts < 12 && Date.now() < capacityDeadline);
  const activeResults = await Promise.all(active);
  assert(activeResults.every(({ response }) => response.status === 200) && fifth.response.status === 503, `global capacity ${activeResults.map(({ response }) => response.status).join(',')}/${fifth.response.status}`);
  result.globalCapacity = { firstFour: activeResults.map(({ response }) => response.status), fifth: fifth.response.status, probeAttempts: fifthAttempts };

  await clearQuota();
  const started = Date.now();
  const timeout = await request({ body: { sql: 'SELECT SLEEP(20);' }, identity: '192.0.2.140' });
  const timeoutMs = Date.now() - started;
  const recovery = await request({ body: { sql: 'SELECT 1;' }, identity: '192.0.2.140' });
  assert(timeout.response.status === 408 && recovery.response.status === 200 && timeoutMs >= 9_000 && timeoutMs < 15_000, `timeout ${timeout.response.status}/${timeoutMs}`);
  result.timeout = { status: timeout.response.status, elapsedMs: timeoutMs, recovery: recovery.response.status };

  const errors = {};
  for (const [name, sql] of Object.entries({ syntax: 'SELEC 1;', missing: 'SELECT * FROM missing;', duplicate: 'CREATE TABLE t(id INT PRIMARY KEY); INSERT INTO t VALUES(1),(1);' })) {
    const value = await request({ body: { sql }, identity: `192.0.2.${150 + Object.keys(errors).length}` });
    errors[name] = { status: value.response.status, code: value.payload.error?.code, sanitized: !/(password|127\.0\.0\.1:3307|node_modules|yc_run_)/i.test(value.text) };
  }
  assert(Object.values(errors).every((value) => value.status === 400 && value.code === 'mysql/query-error' && value.sanitized), 'learner SQL errors');
  result.errors = errors;

  const large = await request({ body: { sql: "SELECT REPEAT('x', 1048576) AS payload;" }, identity: '192.0.2.160' });
  const cellBytes = Buffer.byteLength(large.payload.database.resultSets[0].rows[0][0]);
  assert(large.response.status === 200 && large.payload.database.truncated === true && cellBytes <= 128 * 1024 && Buffer.byteLength(large.text) < 1_100_000, 'large result bounds');
  result.large = { status: 200, cellBytes, responseBytes: Buffer.byteLength(large.text), truncated: true };

  result.headers = { cacheControl: anonymous.response.headers.get('cache-control'), contentType: anonymous.response.headers.get('content-type'), allowOrigin: anonymous.response.headers.get('access-control-allow-origin'), sensitive: [...anonymous.response.headers.keys()].some((key) => /secret|password|credential|token/i.test(key)) };
  assert(result.headers.cacheControl === 'no-store' && /application\/json/.test(result.headers.contentType) && result.headers.allowOrigin !== '*' && !result.headers.sensitive, 'response headers');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await deleteApp(app);
}
