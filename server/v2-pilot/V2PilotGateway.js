import { randomUUID } from 'node:crypto';
import { verifyFirebaseIdToken } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import { createServiceAssertionProvider, createV2GatewayFirebaseCredentialContext, ServiceAssertionError } from './ServiceAssertion.js';

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/i;

export class V2PilotGatewayError extends Error {
  constructor(code, message, status = 500, cause) { super(message, { cause }); this.code = code; this.status = status; }
}

export function isServerV2PilotEnabled(environment = process.env, contentType = 'course') {
  const prefix = contentType === 'practice' ? 'V2_PRACTICE_PILOT' : 'V2_COURSE_PILOT';
  const enabled = String(environment[`${prefix}_ENABLED`] ?? '').toLowerCase() === 'true';
  const deployment = String(environment.VERCEL_ENV ?? environment.YCODERS_ENVIRONMENT ?? '').toLowerCase();
  return enabled && ['development', 'preview', 'staging', 'test'].includes(deployment);
}

function allowlist(value) { return new Set(String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean)); }

export function assertPilotEntitlement({ uid, contentId, contentType = 'course' }, environment = process.env) {
  const prefix = contentType === 'practice' ? 'V2_PRACTICE_PILOT' : 'V2_COURSE_PILOT';
  const learners = allowlist(environment[`${prefix}_UIDS`]);
  const content = allowlist(environment[`${prefix}_CONTENT_IDS`]);
  if (!learners.has(uid) || !content.has(contentId)) throw new V2PilotGatewayError('v2/access-denied', `This account is not entitled to the requested V2 pilot ${contentType === 'practice' ? 'Practice' : 'Course'}.`, 403);
}

async function authenticate(request, options) {
  const header = request?.headers?.authorization ?? request?.headers?.Authorization;
  const match = typeof header === 'string' ? header.match(/^Bearer\s+([^\s]+)$/i) : null;
  if (!match) throw new V2PilotGatewayError('v2/auth-required', 'Sign in to open this V2 pilot Course.', 401);
  try {
    const decoded = await (options.verifyToken ?? verifyFirebaseIdToken)(match[1], options);
    if (!decoded?.uid) throw new Error('Verified token has no uid.');
    return { uid: decoded.uid };
  } catch (cause) {
    throw new V2PilotGatewayError('v2/auth-invalid', 'The learner session is no longer valid.', 401, cause);
  }
}

function parseRequestPath(request) {
  const raw = String(request.query?.path ?? '').replace(/^\/+|\/+$/g, '');
  const parts = raw.split('/').filter(Boolean);
  const contentId = parts[0];
  if (!SAFE_ID.test(contentId ?? '')) throw new V2PilotGatewayError('v2/invalid-request', 'A valid V2 Course ID is required.', 400);
  if (parts.length === 1) return { kind: 'course', contentId, publicationVersion: null, mode: 'active' };
  if (parts[1] !== 'versions' || !/^\d+$/.test(parts[2] ?? '')) throw new V2PilotGatewayError('v2/invalid-request', 'The V2 pilot path is invalid.', 400);
  const publicationVersion = Number(parts[2]);
  if (!Number.isSafeInteger(publicationVersion) || publicationVersion < 1) throw new V2PilotGatewayError('v2/invalid-request', 'The publication version is invalid.', 400);
  if (parts.length === 3) return { kind: 'course', contentId, publicationVersion, mode: 'exact' };
  if (parts.length === 5 && parts[3] === 'assets' && SAFE_ID.test(parts[4])) return { kind: 'asset', contentId, publicationVersion, assetId: parts[4], mode: 'exact' };
  throw new V2PilotGatewayError('v2/invalid-request', 'The V2 pilot path is invalid.', 400);
}

export class HttpV2DeliveryTransport {
  constructor(environment = process.env, fetchImpl = globalThis.fetch, serviceAssertionProvider = createServiceAssertionProvider(environment)) { this.environment = environment; this.fetch = fetchImpl; this.serviceAssertionProvider = serviceAssertionProvider; }
  async request(target, { signal, correlationId } = {}) {
    const base = String(this.environment.V2_DELIVERY_SERVICE_URL ?? '').replace(/\/+$/, '');
    if (!base) throw new V2PilotGatewayError('v2/upstream-unconfigured', 'V2 delivery service trust is not configured.', 503);
    const version = target.publicationVersion ? `/versions/${target.publicationVersion}` : '';
    const asset = target.kind === 'asset' ? `/assets/${encodeURIComponent(target.assetId)}` : '';
    const resource = target.contentType === 'practice' ? 'practice' : 'courses';
    const path = `/api/v2/gateway/${resource}/${encodeURIComponent(target.contentId)}${version}${asset}`;
    let authorization;
    try { authorization = await this.serviceAssertionProvider.authorization({ method:'GET', path, correlationId, targetUrl:`${base}${path}` }); }
    catch (cause) { if (cause instanceof ServiceAssertionError) throw new V2PilotGatewayError(cause.code, cause.message, 503, cause); throw cause; }
    const response = await this.fetch(`${base}${path}`, { signal, headers: { Authorization: authorization, 'X-Correlation-Id': correlationId, Accept: target.kind === 'asset' ? '*/*' : 'application/json' } });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new V2PilotGatewayError(body?.error?.code ?? 'v2/upstream-failed', body?.error?.message ?? 'V2 delivery failed.', response.status);
    }
    if (target.kind === 'asset') return { bytes: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') ?? 'application/octet-stream' };
    const body = await response.json();
    return body?.data ?? body;
  }
}

function publicError(error, correlationId) {
  const known = error instanceof V2PilotGatewayError;
  return { status: known ? error.status : 500, body: { ok: false, error: { code: known ? error.code : 'v2/internal', message: known ? error.message : 'The V2 pilot request could not be completed.', correlationId } } };
}

export function createV2PilotGatewayHandler({ environment = process.env, verifyToken, transport = new HttpV2DeliveryTransport(environment), credentialFactory = createV2GatewayFirebaseCredentialContext, logger = console, contentType = 'course' } = {}) {
  return async function handler(request, response) {
    const correlationId = randomUUID(); const started = Date.now(); let target;
    try {
      if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); throw new V2PilotGatewayError('v2/method-not-allowed', 'Use GET for V2 pilot delivery.', 405); }
      if (!isServerV2PilotEnabled(environment, contentType)) throw new V2PilotGatewayError('v2/pilot-disabled', `The V2 ${contentType === 'practice' ? 'Practice' : 'Course'} pilot is disabled.`, 404);
      target = { ...parseRequestPath(request), contentType };
      const googleCredentials = credentialFactory({ request, environment });
      const principal = await authenticate(request, { environment, verifyToken, googleCredentials });
      assertPilotEntitlement({ uid: principal.uid, contentId: target.contentId, contentType }, environment);
      const delivered = await transport.request(target, { signal: request.signal, correlationId });
      logger.info?.('v2_pilot.delivery', { correlationId, namespace: 'v2', contentType, contentId: target.contentId, requestedPublicationVersion: target.publicationVersion, resolvedPublicationVersion: delivered.publicationVersion ?? target.publicationVersion, mode: target.mode, kind: target.kind, outcome: 'success', latencyMs: Date.now() - started });
      response.setHeader('X-Correlation-Id', correlationId);
      if (target.kind === 'asset') { response.setHeader('Content-Type', delivered.contentType); response.setHeader('Cache-Control', 'private, no-store'); return response.status(200).send(delivered.bytes); }
      return response.status(200).json({ ok: true, data: delivered });
    } catch (error) {
      const result = publicError(error, correlationId);
      logger.warn?.('v2_pilot.delivery', { correlationId, namespace: 'v2', contentType, contentId: target?.contentId ?? null, requestedPublicationVersion: target?.publicationVersion ?? null, mode: target?.mode ?? null, outcome: 'failure', code: result.body.error.code, latencyMs: Date.now() - started });
      response.setHeader('X-Correlation-Id', correlationId);
      return response.status(result.status).json(result.body);
    }
  };
}

export function createV2PracticePilotGatewayHandler(options = {}) {
  return createV2PilotGatewayHandler({ ...options, contentType: 'practice' });
}
