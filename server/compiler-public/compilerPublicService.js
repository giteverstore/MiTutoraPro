import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { Timestamp } from '@google-cloud/firestore';
import { createRequestFirebaseApp } from '../firebaseAdminApp.js';
import { createVercelGoogleCredentialContext } from '../auth/VercelGoogleCredentialAdapter.js';
import {
  closeCompilerPublicFirestore,
  createCompilerPublicFirestore,
} from './createCompilerPublicFirestore.js';

const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const TYPES = new Set(['bug', 'improvement', 'general']);
const LANGUAGE_IDS = new Set(['python','java','javascript','typescript','html-css','react','sql','mysql','c','cpp','php','r','csharp','visualbasic','assembly','go','rust']);
const SHARE_ID = /^[A-Za-z0-9_-]{22}$/;
const byteLength = (value) => Buffer.byteLength(String(value ?? ''), 'utf8');

export class CompilerPublicError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

function createCompilerPublicDiagnostics({ environment, logger, correlationId = randomUUID() }) {
  const base = Object.freeze({
    correlationId,
    projectId: String(environment.FIREBASE_PROJECT_ID || environment.GCLOUD_PROJECT || '').trim() || null,
    databaseId: '(default)',
    vercelEnvironment: String(environment.VERCEL_ENV ?? '').trim() || null,
  });
  return Object.freeze({
    event(stage, metadata = {}) {
      logger?.info?.('compiler_public_wif', { ...base, stage, ...metadata });
    },
  });
}

export async function createCompilerPublicDependencies({
  request,
  environment = process.env,
  credentialFactory = createVercelGoogleCredentialContext,
  firebaseAppFactory = createRequestFirebaseApp,
  authFactory = getAuth,
  firestoreFactory = createCompilerPublicFirestore,
  firestoreClose = closeCompilerPublicFirestore,
  clock = Date.now,
  logger = console,
} = {}) {
  const diagnostics = createCompilerPublicDiagnostics({ environment, logger });
  diagnostics.event('wif.request.start', {
    firebaseProjectPresent: Boolean(environment.FIREBASE_PROJECT_ID || environment.GCLOUD_PROJECT),
    wifAudiencePresent: Boolean(environment.GOOGLE_WIF_AUDIENCE),
    wifServiceAccountPresent: Boolean(environment.GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL),
    vercelEnvironmentPresent: Boolean(environment.VERCEL_ENV),
    productionProfileSelected: environment.VERCEL_ENV === 'production' || (!environment.VERCEL_ENV && environment.NODE_ENV === 'production'),
  });
  let googleCredentials;
  let session;
  let db;
  try {
    googleCredentials = credentialFactory({ request, environment, diagnostics });
    await googleCredentials.preflight();
    diagnostics.event('wif.firebase.start', { credentialMode: googleCredentials.mode });
    session = await firebaseAppFactory(environment, {
      firebaseCredential: googleCredentials.firebaseCredential,
    });
    diagnostics.event('wif.firebase.success', { credentialMode: googleCredentials.mode });
    const auth = authFactory(session.app);
    diagnostics.event('wif.firebase.auth.success', { credentialMode: googleCredentials.mode });
    diagnostics.event('firestore.client.start', { credentialMode: googleCredentials.mode });
    db = firestoreFactory(environment, {
      authClient: googleCredentials.authClient,
      databaseId: '(default)',
    });
    diagnostics.event('firestore.client.success', { credentialMode: googleCredentials.mode });
    return Object.freeze({
      db,
      auth,
      now: clock(),
      credentialMode: googleCredentials.mode,
      diagnostics,
      async close() {
        await Promise.all([
          firestoreClose(db),
          session.close(),
        ]);
      },
    });
  } catch (error) {
    diagnostics.event(session ? 'firestore.client.failure' : 'wif.initialization.failure', {
      credentialMode: googleCredentials?.mode ?? null,
      errorName: String(error?.name ?? 'Error').slice(0, 80),
      errorCode: typeof error?.code === 'string' ? error.code.slice(0, 80) : null,
      httpStatus: Number(error?.status) || null,
    });
    await Promise.allSettled([
      firestoreClose(db),
      session?.close(),
    ]);
    throw error;
  }
}

export function clientKey(request) {
  const platform = String(request.headers?.['x-vercel-forwarded-for'] ?? '').split(',')[0].trim();
  const forwarded = String(request.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim();
  const address = platform || request.socket?.remoteAddress || forwarded || 'unknown';
  return createHash('sha256').update(address).digest('hex').slice(0, 32);
}

export async function optionalUid(request, auth) {
  const header = String(request.headers?.authorization ?? '');
  if (!header) return null;
  if (!header.startsWith('Bearer ')) throw new CompilerPublicError('compiler-public/invalid-auth', 'Authentication could not be verified.', 401);
  try { return (await auth.verifyIdToken(header.slice(7))).uid; }
  catch { throw new CompilerPublicError('compiler-public/invalid-auth', 'Authentication could not be verified.', 401); }
}

export async function enforceRateLimit(db, { scope, key, limit, now, diagnostics }) {
  const windowStart = Math.floor(now / HOUR_MS) * HOUR_MS;
  const ref = db.collection('compilerPublicRateLimits').doc(`${scope}_${key}_${windowStart}`);
  diagnostics?.event('share.firestore.rate_limit.start', { operation: scope });
  diagnostics?.event('firestore.rpc.start', { operation: `${scope}-rate-limit` });
  try { await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref); const count = snapshot.exists ? Number(snapshot.data().count || 0) : 0;
    if (count >= limit) throw new CompilerPublicError('compiler-public/rate-limited', 'Too many requests. Try again later.', 429);
    transaction.set(ref, { scope, count: count + 1, windowStart: Timestamp.fromMillis(windowStart), expiresAt: Timestamp.fromMillis(windowStart + 2 * HOUR_MS) }, { merge: false });
  }); diagnostics?.event('firestore.rpc.success', { operation: `${scope}-rate-limit` }); } catch (error) {
    diagnostics?.event('share.firestore.rate_limit.failure', { operation: scope, errorName: String(error?.name ?? 'Error').slice(0, 80), errorCode: typeof error?.code === 'string' ? error.code.slice(0, 80) : null });
    diagnostics?.event('firestore.rpc.failure', { operation: `${scope}-rate-limit`, errorName: String(error?.name ?? 'Error').slice(0, 80), errorCode: typeof error?.code === 'string' ? error.code.slice(0, 80) : null });
    throw error;
  }
}

export function validateSharePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CompilerPublicError('compiler-share/invalid-body', 'Invalid share request.');
  const languageId = String(body.languageId ?? '');
  const source = typeof body.source === 'string' ? body.source : '';
  const stdinIncluded = body.stdinIncluded === true;
  const stdin = stdinIncluded && typeof body.stdin === 'string' ? body.stdin : null;
  if (!LANGUAGE_IDS.has(languageId)) throw new CompilerPublicError('compiler-share/invalid-language', 'Select a supported compiler language.');
  if (byteLength(source) > 65536) throw new CompilerPublicError('compiler-share/source-too-large', 'Source code must be 64 KiB or smaller.', 413);
  if (stdinIncluded && byteLength(stdin) > 65536) throw new CompilerPublicError('compiler-share/stdin-too-large', 'Standard input must be 64 KiB or smaller.', 413);
  return { languageId, source, stdinIncluded, stdin };
}

export async function createShare({ db, auth, request, body, now = Date.now(), diagnostics }) {
  const uid = await optionalUid(request, auth); await enforceRateLimit(db, { scope: 'share', key: uid || clientKey(request), limit: 10, now, diagnostics });
  const payload = validateSharePayload(body); const shareId = randomBytes(16).toString('base64url');
  const record = { schemaVersion: 1, ...payload, createdAt: Timestamp.fromMillis(now), ownerUid: uid, expiresAt: Timestamp.fromMillis(now + SHARE_TTL_MS), sourceBytes: byteLength(payload.source), status: 'active' };
  diagnostics?.event('share.firestore.write.start', { operation: 'share-create' });
  diagnostics?.event('firestore.rpc.start', { operation: 'share-create' });
  try { await db.collection('compilerShares').doc(shareId).create(record); diagnostics?.event('firestore.rpc.success', { operation: 'share-create' }); }
  catch (error) { diagnostics?.event('share.firestore.write.failure', { operation: 'share-create', errorName: String(error?.name ?? 'Error').slice(0, 80), errorCode: typeof error?.code === 'string' ? error.code.slice(0, 80) : null }); diagnostics?.event('firestore.rpc.failure', { operation: 'share-create', errorName: String(error?.name ?? 'Error').slice(0, 80), errorCode: typeof error?.code === 'string' ? error.code.slice(0, 80) : null }); throw error; }
  return { shareId, expiresAt: record.expiresAt.toDate().toISOString() };
}

export async function readShare({ db, shareId, now = Date.now(), diagnostics }) {
  if (!SHARE_ID.test(String(shareId ?? ''))) throw new CompilerPublicError('compiler-share/not-found', 'Shared code was not found.', 404);
  diagnostics?.event('share.firestore.read.start', { operation: 'share-read' });
  diagnostics?.event('firestore.rpc.start', { operation: 'share-read' });
  let snapshot; try { snapshot = await db.collection('compilerShares').doc(shareId).get(); diagnostics?.event('firestore.rpc.success', { operation: 'share-read' }); }
  catch (error) { diagnostics?.event('share.firestore.read.failure', { operation: 'share-read', errorName: String(error?.name ?? 'Error').slice(0, 80), errorCode: typeof error?.code === 'string' ? error.code.slice(0, 80) : null }); diagnostics?.event('firestore.rpc.failure', { operation: 'share-read', errorName: String(error?.name ?? 'Error').slice(0, 80), errorCode: typeof error?.code === 'string' ? error.code.slice(0, 80) : null }); throw error; }
  const data = snapshot.data();
  if (!snapshot.exists || data.status !== 'active' || data.expiresAt?.toMillis?.() <= now) throw new CompilerPublicError('compiler-share/not-found', 'Shared code was not found.', 404);
  return { schemaVersion: 1, languageId: data.languageId, source: data.source, stdinIncluded: data.stdinIncluded === true, stdin: data.stdinIncluded === true ? data.stdin : null, createdAt: data.createdAt.toDate().toISOString() };
}

export function validateFeedbackPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CompilerPublicError('compiler-feedback/invalid-body', 'Invalid feedback request.');
  const type = String(body.type ?? ''); const description = String(body.description ?? '').trim(); const languageId = body.languageId == null ? null : String(body.languageId);
  if (!TYPES.has(type)) throw new CompilerPublicError('compiler-feedback/invalid-type', 'Select a valid feedback type.');
  if (description.length < 5 || description.length > 5000) throw new CompilerPublicError('compiler-feedback/invalid-description', 'Feedback must contain between 5 and 5000 characters.');
  if (languageId && !LANGUAGE_IDS.has(languageId)) throw new CompilerPublicError('compiler-feedback/invalid-language', 'Invalid compiler language.');
  const raw = body.context && typeof body.context === 'object' && !Array.isArray(body.context) ? body.context : {};
  const bounded = (value, max) => String(value ?? '').slice(0, max);
  return { type, description, languageId, route: bounded(body.route, 160), context: { executionMode: bounded(raw.executionMode, 32), executionProvider: bounded(raw.executionProvider, 32), appVersion: bounded(raw.appVersion, 80), theme: bounded(raw.theme, 16), viewportWidth: Math.max(0, Math.min(10000, Number(raw.viewportWidth) || 0)), viewportHeight: Math.max(0, Math.min(10000, Number(raw.viewportHeight) || 0)), userAgent: bounded(raw.userAgent, 500) } };
}

export async function createFeedback({ db, auth, request, body, now = Date.now(), diagnostics }) {
  const uid = await optionalUid(request, auth); await enforceRateLimit(db, { scope: 'feedback', key: uid || clientKey(request), limit: uid ? 10 : 5, now, diagnostics });
  const payload = validateFeedbackPayload(body); const ref = db.collection('compilerFeedback').doc();
  diagnostics?.event('share.firestore.write.start', { operation: 'feedback-create' });
  diagnostics?.event('firestore.rpc.start', { operation: 'feedback-create' });
  try { await ref.create({ schemaVersion: 1, ...payload, createdAt: Timestamp.fromMillis(now), userUid: uid, status: 'new' }); diagnostics?.event('firestore.rpc.success', { operation: 'feedback-create' }); }
  catch (error) { diagnostics?.event('share.firestore.write.failure', { operation: 'feedback-create', errorName: String(error?.name ?? 'Error').slice(0, 80), errorCode: typeof error?.code === 'string' ? error.code.slice(0, 80) : null }); diagnostics?.event('firestore.rpc.failure', { operation: 'feedback-create', errorName: String(error?.name ?? 'Error').slice(0, 80), errorCode: typeof error?.code === 'string' ? error.code.slice(0, 80) : null }); throw error; }
  return { feedbackId: ref.id };
}

export async function cleanupExpiredCompilerPublicData(db, now = Date.now(), limit = 200) {
  const snapshot = await db.collection('compilerShares').where('expiresAt', '<=', Timestamp.fromMillis(now)).limit(limit).get();
  if (snapshot.empty) return { deleted: 0 };
  const batch = db.batch(); snapshot.docs.forEach((doc) => batch.delete(doc.ref)); await batch.commit(); return { deleted: snapshot.size };
}

export async function cleanupExpiredRateLimits(db, now = Date.now(), limit = 200) {
  const snapshot = await db.collection('compilerPublicRateLimits').where('expiresAt', '<=', Timestamp.fromMillis(now)).limit(limit).get();
  if (snapshot.empty) return { deleted: 0 }; const batch = db.batch(); snapshot.docs.forEach((doc) => batch.delete(doc.ref)); await batch.commit(); return { deleted: snapshot.size };
}

export function authorizedSecret(header, secret) {
  const supplied = Buffer.from(String(header ?? '').replace(/^Bearer\s+/i, ''));
  const expected = Buffer.from(String(secret ?? ''));
  return expected.length > 0 && supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function assertAllowedOrigin(request) {
  const origin = request.headers?.origin;
  if (!origin) return;
  let parsed; try { parsed = new URL(origin); } catch { throw new CompilerPublicError('compiler-public/origin-denied', 'Request origin is not allowed.', 403); }
  const production = parsed.protocol === 'https:' && parsed.hostname === 'compiler.ycoders.com';
  const local = ['localhost', '127.0.0.1'].includes(parsed.hostname) && ['http:', 'https:'].includes(parsed.protocol);
  if (!production && !local) throw new CompilerPublicError('compiler-public/origin-denied', 'Request origin is not allowed.', 403);
}

export function sendCompilerPublicError(response, error) {
  const known = error instanceof CompilerPublicError; return response.status(known ? error.status : 500).json({ error: { code: known ? error.code : 'compiler-public/server-error', message: known ? error.message : 'The request could not be completed.' } });
}

export function assertJsonPost(request) {
  if (request.method !== 'POST') throw new CompilerPublicError('compiler-public/method-not-allowed', 'Method not allowed.', 405);
  if (!String(request.headers?.['content-type'] ?? '').toLowerCase().startsWith('application/json')) throw new CompilerPublicError('compiler-public/unsupported-media', 'Content-Type must be application/json.', 415);
  assertAllowedOrigin(request);
}
