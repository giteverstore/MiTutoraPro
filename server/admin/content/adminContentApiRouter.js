import { getStorage } from 'firebase-admin/storage';
import { Storage } from '@google-cloud/storage';
import { createVercelGoogleCredentialContext, resolveGoogleWifConfiguration } from '../../auth/VercelGoogleCredentialAdapter.js';
import { createDefaultFirestore } from '../../firestore/createDefaultFirestore.js';
import { createRequestFirebaseApp } from '../../firebaseAdminApp.js';
import { requiresFederatedTutorCredentials } from '../../ai/tutor/tutorRuntimeConfig.js';
import { CONTENT_TYPES } from '../../../shared/content/index.js';
import { ADMIN_PERMISSIONS } from '../../../shared/admin/adminAuthorization.js';
import { requireAdminPermission } from '../AdminAuthorization.js';
import { ContentPublicationService } from './ContentPublicationService.js';
import { PublishedContentService } from './PublishedContentService.js';
import { FirebaseArtifactStore, FirebaseAssetRegistry, FirebaseContentPublicationStore } from './FirebaseContentPublicationStore.js';
import { ContentPublicationError } from './ContentPublicationError.js';
import { AdminAssetService } from './AdminAssetService.js';
import { ChallengeAssignmentService } from './ChallengeAssignmentService.js';

const allowedContentTypes = new Set(Object.values(CONTENT_TYPES));
export const ADMIN_CONTENT_BUCKET_NAME = 'mi-tutora-pro-admin-content';
function requireMatchingContentType(requested, actual) {
  if (!allowedContentTypes.has(requested)) throw new ContentPublicationError('content/type-invalid', 'A valid content type is required.', { status: 400 });
  if (requested !== actual) throw new ContentPublicationError('content/type-conflict', 'Content type does not match this request.', { status: 409 });
}

const segments = (request) => {
  const path = request.query?.path;
  if (Array.isArray(path)) return path.map(String).filter(Boolean);
  if (typeof path === 'string') return path.split('/').filter(Boolean);
  return new URL(request.url || '/', 'http://localhost').pathname.replace(/^\/api\/admin-content\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
};
const body = (request) => {
  if (typeof request.body !== 'string') return request.body ?? {};
  try { return JSON.parse(request.body); }
  catch { throw new ContentPublicationError('content/body-invalid', 'Request body must be valid JSON.', { status: 400 }); }
};
const pageOptions = (request) => {
  const limit = Number(request.query?.limit ?? 25);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new ContentPublicationError('content/page-invalid', 'Page size must be between 1 and 50.', { status: 400 });
  const cursor = request.query?.cursor == null ? null : String(request.query.cursor);
  if (cursor && !/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(cursor)) throw new ContentPublicationError('content/cursor-invalid', 'Invalid page cursor.', { status: 400 });
  return { limit, cursor };
};
const sendError = (response, error) => response.status(error.status ?? 500).json({ error: { code: error.code ?? 'content/internal', message: error.status && error.status < 500 ? error.message : 'Content service is temporarily unavailable.', ...(error.details ? { details: error.details } : {}) } });

function createRemoteVersionReader(origin, matchesMetadata, fetcher) {
  return async (contentId, version, metadata) => {
    if (!matchesMetadata(metadata)) throw new ContentPublicationError('content/artifact-unavailable', 'Published content is temporarily unavailable.', { status: 503 });
    try {
      const result = await fetcher(`${origin}/api/admin-content/public/${encodeURIComponent(contentId)}/${version}`, {
        headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000),
      });
      if (!result.ok) throw new Error('Remote public content read failed.');
      const value = await result.json();
      if (!matchesMetadata(value?.metadata)
        || value.metadata.artifactHash !== metadata.artifactHash
        || value.document?.contentId !== contentId
        || value.document?.version !== version
        || value.document?.schemaVersion !== metadata.schemaVersion) throw new Error('Remote public content identity mismatch.');
      return value;
    } catch (cause) {
      throw new ContentPublicationError('content/artifact-unavailable', 'Published content is temporarily unavailable.', { status: 503, cause });
    }
  };
}

export function createAdminPublicVersionReader(environment = process.env, fetcher = globalThis.fetch) {
  const bucketName = String(environment.ADMIN_CONTENT_STORAGE_BUCKET ?? '').trim();
  const origin = String(environment.ADMIN_PUBLIC_CONTENT_ORIGIN ?? '').trim();
  if (!bucketName && !origin) return null;
  if (bucketName !== ADMIN_CONTENT_BUCKET_NAME || origin !== 'https://admin.ycoders.com') {
    throw new ContentPublicationError('content/artifact-unavailable', 'Published content is temporarily unavailable.', { status: 503 });
  }
  return createRemoteVersionReader(origin, (metadata) => metadata?.artifactBucket === bucketName, fetcher);
}

export function createLegacyPublicVersionReader(environment = process.env, fetcher = globalThis.fetch) {
  if (environment.VERCEL_ENV !== 'production') return null;
  return createRemoteVersionReader('https://ycoders.com', (metadata) => !metadata?.artifactBucket, fetcher);
}

// Storage 7.x bundles google-auth-library 9, whose GoogleAuth copies request
// headers with Object.assign(). Our WIF client uses google-auth-library 10 and
// returns Headers, whose entries are not enumerable to Object.assign().
export function createStorageAuthClient(authClient) {
  return new Proxy(authClient, {
    get(target, property) {
      if (property === 'getRequestHeaders') return async (...args) => {
        const source = await target.getRequestHeaders(...args);
        const headers = typeof source?.entries === 'function' && typeof source?.get === 'function'
          ? Object.fromEntries(source.entries()) : source;
        if (!headers || !Object.keys(headers).some((key) => key.toLowerCase() === 'authorization')) {
          throw new Error('Admin Storage authorization is unavailable.');
        }
        return headers;
      };
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export async function createAdminStorageBucket(environment = process.env, googleCredentials, {
  StorageClient = Storage,
  firebaseAppFactory = createRequestFirebaseApp,
  useDedicatedAdminBucket = false,
} = {}) {
  const bucketName = String(useDedicatedAdminBucket
    ? (environment.ADMIN_CONTENT_STORAGE_BUCKET || (environment.VERCEL_ENV === 'production' ? '' : environment.FIREBASE_STORAGE_BUCKET))
    : environment.FIREBASE_STORAGE_BUCKET ?? '').trim();
  if (!bucketName || (useDedicatedAdminBucket && environment.VERCEL_ENV === 'production' && bucketName !== ADMIN_CONTENT_BUCKET_NAME)) {
    throw new ContentPublicationError('admin/storage-unavailable', 'Admin storage is not configured.', { status: 503 });
  }
  if (requiresFederatedTutorCredentials(environment)) {
    if (!googleCredentials?.authClient) throw new ContentPublicationError('admin/storage-unavailable', 'Admin storage is not configured.', { status: 503 });
    const projectId = String(environment.FIREBASE_PROJECT_ID ?? '').trim();
    const storage = new StorageClient({ projectId, authClient: createStorageAuthClient(googleCredentials.authClient) });
    return { bucket: storage.bucket(bucketName), async close() {} };
  }
  const session = await firebaseAppFactory(environment, { firebaseCredential: googleCredentials?.firebaseCredential });
  try { return { bucket: getStorage(session.app).bucket(bucketName), close: () => session.close() }; }
  catch (error) { await session.close(); throw error; }
}

export async function createDefaultContentDependencies({ environment = process.env, googleCredentials, useDedicatedAdminBucket = false } = {}) {
  const firestoreSession = await createDefaultFirestore(environment, googleCredentials);
  let storageSession;
  try {
    storageSession = await createAdminStorageBucket(environment, googleCredentials, { useDedicatedAdminBucket });
  } catch (error) {
    await firestoreSession.close();
    throw error;
  }
  const db = firestoreSession.db;
  const store = new FirebaseContentPublicationStore(db);
  const bucket = storageSession.bucket;
  const artifacts = new FirebaseArtifactStore(bucket);
  const assets = new FirebaseAssetRegistry(db, bucket);
  const delivery = new PublishedContentService({
    store, artifacts,
    externalVersionReader: useDedicatedAdminBucket ? null : createAdminPublicVersionReader(environment),
    legacyVersionReader: useDedicatedAdminBucket ? createLegacyPublicVersionReader(environment) : null,
  });
  return { service: new ContentPublicationService({ store, artifacts, assets }), delivery, assetService: new AdminAssetService(assets), challengeAssignments: new ChallengeAssignmentService({ db, delivery }), async close() { await Promise.allSettled([firestoreSession.close(), storageSession.close()]); } };
}

export function createAdminContentApiRouter({ dependencies = createDefaultContentDependencies, authorize = requireAdminPermission, credentialFactory = createVercelGoogleCredentialContext, configurationResolver = resolveGoogleWifConfiguration, useDedicatedAdminBucket = false, publicOnly = false, environment = process.env } = {}) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const path = segments(request);
    let resources;
    try {
      if (publicOnly && !(request.method === 'GET' && path[0] === 'public')) {
        return response.status(404).json({ error: { code: 'content/not-found', message: 'Content API route not found.' } });
      }
      // Until an isolated staging backend is provisioned, Preview has no
      // privileged or public content backend. Never inherit Production IAM.
      if (environment.VERCEL_ENV === 'preview') {
        if (request.method !== 'GET') return response.status(403).json({ error: { code: 'admin/preview-read-only', message: 'Admin changes are disabled in Preview.' } });
        if (path[0] !== 'public' && !/^Bearer\s+\S+$/i.test(String(request.headers?.authorization ?? ''))) return response.status(401).json({ error: { code: 'admin/auth-required', message: 'Admin authentication is required.' } });
        return response.status(503).json({ error: { code: 'admin/preview-backend-disabled', message: 'Preview content is not configured.' } });
      }
      const isPublic = request.method === 'GET' && path[0] === 'public';
      let actor;
      let googleCredentials;
      if (!isPublic && authorize === requireAdminPermission && !/^Bearer\s+\S+$/i.test(String(request.headers?.authorization ?? ''))) {
        return response.status(401).json({ error: { code: 'admin/auth-required', message: 'Admin authentication is required.' } });
      }
      googleCredentials = credentialFactory({ request, environment, configurationResolver });
      await googleCredentials.preflight();
      if (!isPublic) {
        const permission = request.method === 'GET' ? ADMIN_PERMISSIONS.ADMIN_ACCESS
          : path[0] === 'publish' || path[0] === 'rollback' || path[0] === 'archive' || path[0] === 'assign-challenge' ? ADMIN_PERMISSIONS.CONTENT_PUBLISH
            : path[0] === 'validate' ? ADMIN_PERMISSIONS.CONTENT_VALIDATE : ADMIN_PERMISSIONS.CONTENT_EDIT;
        actor = authorize === requireAdminPermission
          ? await authorize(request, permission, { environment, googleCredentials })
          : await authorize(request, permission);
      }
      resources = await dependencies({ environment, googleCredentials, useDedicatedAdminBucket });
      const { service, delivery, assetService, challengeAssignments } = resources;
      if (request.method === 'GET' && path[0] === 'public' && !path[1]) {
        const contentType = String(request.query?.contentType ?? '').toUpperCase() || 'PROJECT';
        if (!['PROJECT', 'COURSE', 'PRACTICE', 'CHALLENGE'].includes(contentType)) return response.status(400).json({ error: { code: 'content/type-invalid', message: 'Unsupported content type.' } });
        const items = await delivery.listActive(contentType);
        return response.status(200).json({ items, ...(contentType === 'PROJECT' ? { projects: items } : {}) });
      }
      if (request.method === 'GET' && path[0] === 'public' && path[1]) {
        const result = path[2] ? await delivery.fetchVersion(path[1], path[2]) : await delivery.resolveActive(path[1]);
        return result ? response.status(200).json(result) : response.status(404).json({ error: { code: 'content/not-published', message: 'Published content was not found.' } });
      }
      if (request.method === 'POST' && path[0] === 'assign-challenge' && !path[1]) {
        const input = body(request);
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => key !== 'contentId')) throw new ContentPublicationError('challenge/body-invalid', 'Only contentId is accepted.', { status: 400 });
        return response.status(200).json({ assignment: await challengeAssignments.assign({ contentId: input.contentId, actor }) });
      }
      if (request.method === 'GET' && path[0] === 'draft-summaries' && !path[1]) return response.status(200).json(await service.listDraftSummaries(pageOptions(request)));
      if (request.method === 'GET' && path[0] === 'catalog' && !path[1]) return response.status(200).json(await service.listPointers(pageOptions(request)));
      if (request.method === 'GET' && path[0] === 'assets' && !path[1]) return response.status(200).json(await assetService.list(pageOptions(request)));
      if (request.method === 'GET' && path[0] === 'assets' && path[1] && !path[2]) {
        const asset = await assetService.get(path[1]);
        if (!asset) throw new ContentPublicationError('content/asset-not-found', 'Asset not found.', { status: 404 });
        return response.status(200).json({ asset });
      }
      if (request.method === 'GET' && path[0] === 'assets' && path[1] && path[2] === 'file') {
        const asset = await assetService.get(path[1]);
        if (!asset) throw new ContentPublicationError('content/asset-not-found', 'Asset not found.', { status: 404 });
        if (!/^admin-content-assets\/asset-[a-f0-9-]{36}\.(png|jpg|webp)$/.test(asset.path ?? '')) throw new ContentPublicationError('content/asset-preview-unavailable', 'This migrated asset uses an existing public path.', { status: 404 });
        const bytes = await assetService.read(asset);
        response.setHeader('Content-Type', asset.mediaType);
        response.setHeader('X-Content-Type-Options', 'nosniff');
        return response.status(200).send(bytes);
      }
      if (request.method === 'GET' && path[0] === 'drafts' && !path[1]) return response.status(200).json({ drafts: await service.listDrafts() });
      if (request.method === 'GET' && path[0] === 'drafts' && path[1]) return response.status(200).json({ draft: await service.getDraft(path[1]) });
      if (request.method === 'GET' && path[0] === 'history' && path[1]) return response.status(200).json({ versions: await service.history(path[1]), active: await service.pointer(path[1]) });
      if (request.method === 'DELETE' && path[0] === 'drafts' && path.length === 2) {
        const input = body(request);
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !['contentType', 'expectedRevision'].includes(key))) throw new ContentPublicationError('content/body-invalid', 'Invalid draft deletion request.', { status: 400 });
        if (!allowedContentTypes.has(input.contentType)) throw new ContentPublicationError('content/type-invalid', 'A valid content type is required.', { status: 400 });
        return response.status(200).json(await service.deleteDraft({ actor, contentId: path[1], contentType: input.contentType, expectedRevision: input.expectedRevision }));
      }
      if (request.method !== 'POST') return response.status(405).json({ error: { code: 'content/method-not-allowed', message: 'Method not allowed.' } });
      const input = body(request);
      if (path[0] === 'assets' && !path[1]) return response.status(201).json({ asset: await assetService.upload(input, actor) });
      if (path[0] === 'drafts') {
        requireMatchingContentType(input.contentType, input.document?.contentType);
        return response.status(200).json({ draft: await service.saveDraft({ actor, document: input.document, expectedRevision: input.expectedRevision }) });
      }
      if (['validate', 'publish', 'rollback', 'archive'].includes(path[0])) {
        const draft = await service.getDraft(input.contentId);
        if (!draft) throw new ContentPublicationError('content/draft-not-found', 'Draft not found.', { status: 404 });
        requireMatchingContentType(input.contentType, draft.contentType);
        requireMatchingContentType(input.contentType, draft.document?.contentType);
      }
      if (path[0] === 'validate') return response.status(200).json({ validation: await service.validateDraft({ actor, contentId: input.contentId, expectedRevision: input.expectedRevision }) });
      if (path[0] === 'publish') return response.status(201).json(await service.publish({ actor, contentId: input.contentId, expectedRevision: input.expectedRevision, expectedActiveRevision: input.expectedActiveRevision }));
      if (path[0] === 'rollback') return response.status(200).json({ active: await service.activate({ actor, contentId: input.contentId, version: input.version, expectedActiveRevision: input.expectedActiveRevision }) });
      if (path[0] === 'archive') return response.status(200).json({ active: await service.archive({ actor, contentId: input.contentId, expectedActiveRevision: input.expectedActiveRevision }) });
      return response.status(404).json({ error: { code: 'content/not-found', message: 'Content API route not found.' } });
    } catch (error) { return sendError(response, error); }
    finally { await resources?.close?.(); }
  };
}
