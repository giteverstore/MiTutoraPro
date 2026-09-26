import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getServerFirebaseApp } from '../firebaseAdminApp.js';

const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const TYPES = new Set(['bug', 'improvement', 'general']);
const LANGUAGE_IDS = new Set(['python','java','javascript','typescript','html-css','react','sql','mysql','c','cpp','php','r','csharp','visualbasic','assembly','go','rust']);
const SHARE_ID = /^[A-Za-z0-9_-]{22}$/;
const byteLength = (value) => Buffer.byteLength(String(value ?? ''), 'utf8');

export class CompilerPublicError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

export async function createCompilerPublicDependencies(environment = process.env) {
  const app = await getServerFirebaseApp(environment);
  return { db: getFirestore(app), auth: getAuth(app), now: Date.now() };
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

export async function enforceRateLimit(db, { scope, key, limit, now }) {
  const windowStart = Math.floor(now / HOUR_MS) * HOUR_MS;
  const ref = db.collection('compilerPublicRateLimits').doc(`${scope}_${key}_${windowStart}`);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref); const count = snapshot.exists ? Number(snapshot.data().count || 0) : 0;
    if (count >= limit) throw new CompilerPublicError('compiler-public/rate-limited', 'Too many requests. Try again later.', 429);
    transaction.set(ref, { scope, count: count + 1, windowStart: Timestamp.fromMillis(windowStart), expiresAt: Timestamp.fromMillis(windowStart + 2 * HOUR_MS) }, { merge: false });
  });
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

export async function createShare({ db, auth, request, body, now = Date.now() }) {
  const uid = await optionalUid(request, auth); await enforceRateLimit(db, { scope: 'share', key: uid || clientKey(request), limit: 10, now });
  const payload = validateSharePayload(body); const shareId = randomBytes(16).toString('base64url');
  const record = { schemaVersion: 1, ...payload, createdAt: Timestamp.fromMillis(now), ownerUid: uid, expiresAt: Timestamp.fromMillis(now + SHARE_TTL_MS), sourceBytes: byteLength(payload.source), status: 'active' };
  await db.collection('compilerShares').doc(shareId).create(record);
  return { shareId, expiresAt: record.expiresAt.toDate().toISOString() };
}

export async function readShare({ db, shareId, now = Date.now() }) {
  if (!SHARE_ID.test(String(shareId ?? ''))) throw new CompilerPublicError('compiler-share/not-found', 'Shared code was not found.', 404);
  const snapshot = await db.collection('compilerShares').doc(shareId).get(); const data = snapshot.data();
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

export async function createFeedback({ db, auth, request, body, now = Date.now() }) {
  const uid = await optionalUid(request, auth); await enforceRateLimit(db, { scope: 'feedback', key: uid || clientKey(request), limit: uid ? 10 : 5, now });
  const payload = validateFeedbackPayload(body); const ref = db.collection('compilerFeedback').doc();
  await ref.create({ schemaVersion: 1, ...payload, createdAt: Timestamp.fromMillis(now), userUid: uid, status: 'new' });
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
