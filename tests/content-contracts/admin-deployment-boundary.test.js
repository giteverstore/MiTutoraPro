import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAdminContentApiRouter, createAdminPublicVersionReader, createAdminStorageBucket, createLegacyPublicVersionReader } from '../../server/admin/content/adminContentApiRouter.js';
import { createDefaultFirestore } from '../../server/firestore/createDefaultFirestore.js';
import { resolveAdminGoogleWifConfiguration } from '../../server/admin/AdminWifConfiguration.js';
import { resolveGoogleWifConfiguration } from '../../server/auth/VercelGoogleCredentialAdapter.js';
import { FirebaseArtifactStore, FirebaseAssetRegistry } from '../../server/admin/content/FirebaseContentPublicationStore.js';
import mainContentHandler from '../../api/admin-content/[...path].js';

function response() {
  return {
    statusCode: 200,
    setHeader() { return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

const production = { VERCEL_ENV: 'production', FIREBASE_PROJECT_ID: 'mi-tutora-pro' };

describe('Admin deployment boundary', () => {
  it('keeps the main-site content function public-read-only, so Admin writes cannot target the legacy bucket', async () => {
    for (const method of ['GET', 'POST']) {
      const result = response();
      await mainContentHandler({ method, query: { path: ['drafts'] }, headers: {} }, result);
      expect(result.statusCode).toBe(404);
    }
  });
  it('hosts the API locally and never proxies Preview to the production domain', () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), 'apps/admin/vercel.json'), 'utf8'));
    expect(JSON.stringify(config)).not.toContain('ycoders.com');
    expect(config.installCommand).toBe('npm ci --prefix ../..');
    expect(config.outputDirectory).toBe('dist');
    const spaRoute = new RegExp(`^${config.rewrites[0].source}$`);
    expect(spaRoute.test('/content/projects')).toBe(true);
    expect(spaRoute.test('/api/admin-content/drafts')).toBe(false);
    const adminEntrypoint = readFileSync(resolve(process.cwd(), 'apps/admin/api/admin-content/[...path].js'), 'utf8');
    expect(adminEntrypoint).toContain('useDedicatedAdminBucket: true');
    expect(adminEntrypoint).toContain('configurationResolver: resolveAdminGoogleWifConfiguration');
  });

  it('blocks every Preview write before credentials, auth, or dependencies are acquired', async () => {
    const dependencies = vi.fn();
    const credentialFactory = vi.fn();
    const authorize = vi.fn();
    const route = createAdminContentApiRouter({ environment: { VERCEL_ENV: 'preview' }, dependencies, credentialFactory, authorize });
    for (const path of ['drafts', 'validate', 'publish', 'rollback', 'archive', 'assets', 'assign-challenge']) {
      const result = response();
      await route({ method: 'POST', query: { path: [path] }, headers: { authorization: 'Bearer token' } }, result);
      expect(result.statusCode).toBe(403);
      expect(result.body.error.code).toBe('admin/preview-read-only');
    }
    expect(dependencies).not.toHaveBeenCalled();
    expect(credentialFactory).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
  });

  it('keeps Preview reads isolated and denies unauthenticated Admin requests', async () => {
    const route = createAdminContentApiRouter({ environment: { VERCEL_ENV: 'preview' }, dependencies: vi.fn(), credentialFactory: vi.fn() });
    const unauthorized = response();
    await route({ method: 'GET', query: { path: ['drafts'] }, headers: {} }, unauthorized);
    expect(unauthorized.statusCode).toBe(401);
    const unavailable = response();
    await route({ method: 'GET', query: { path: ['public'] }, headers: {} }, unavailable);
    expect(unavailable.statusCode).toBe(503);
  });

  it('passes request-scoped credentials to Production authorization and dependencies, then disposes resources', async () => {
    const close = vi.fn();
    const credentials = { mode: 'wif', authClient: {}, firebaseCredential: {}, preflight: vi.fn() };
    const credentialFactory = vi.fn(() => credentials);
    const authorize = vi.fn(async () => ({ uid: 'admin', role: 'SUPER_ADMIN' }));
    const dependencies = vi.fn(async () => ({ service: { listDrafts: async () => [] }, close }));
    const route = createAdminContentApiRouter({ environment: production, dependencies, credentialFactory, authorize });
    const result = response();
    await route({ method: 'GET', query: { path: ['drafts'] }, headers: { authorization: 'Bearer token' } }, result);
    expect(result.statusCode).toBe(200);
    expect(credentialFactory).toHaveBeenCalledWith({ request: expect.any(Object), environment: production, configurationResolver: resolveGoogleWifConfiguration });
    expect(authorize).toHaveBeenCalledWith(expect.any(Object), expect.any(String));
    expect(dependencies).toHaveBeenCalledWith({ environment: production, googleCredentials: credentials, useDedicatedAdminBucket: false });
    expect(close).toHaveBeenCalledOnce();
  });

  it('does not fall back to ADC when Production WIF identity is missing', async () => {
    const dependencies = vi.fn();
    const route = createAdminContentApiRouter({
      environment: production,
      credentialFactory: () => ({ preflight: async () => { throw Object.assign(new Error('identity unavailable'), { status: 503 }); } }),
      dependencies,
    });
    const result = response();
    await route({ method: 'GET', query: { path: ['public'] }, headers: {} }, result);
    expect(result.statusCode).toBe(503);
    expect(result.body.error.message).toBe('Content service is temporarily unavailable.');
    expect(dependencies).not.toHaveBeenCalled();
  });

  it('uses an explicit WIF Firestore AuthClient and preserves local request-app behavior', async () => {
    const authClient = { getAccessToken: vi.fn() };
    const terminate = vi.fn();
    const FirestoreClient = vi.fn(function FakeFirestore() { this.terminate = terminate; });
    const appFactory = vi.fn(async () => ({ app: {}, close: vi.fn() }));
    const remote = await createDefaultFirestore(production, { authClient }, { FirestoreClient, firebaseAppFactory: appFactory });
    expect(FirestoreClient).toHaveBeenCalledWith({ projectId: 'mi-tutora-pro', databaseId: '(default)', authClient });
    expect(appFactory).not.toHaveBeenCalled();
    await remote.close();
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('uses the WIF AuthClient for Storage without invoking Firebase Admin Storage', async () => {
    const authClient = { getAccessToken: vi.fn() };
    const bucket = {};
    const StorageClient = vi.fn(function FakeStorage() { this.bucket = vi.fn(() => bucket); });
    const firebaseAppFactory = vi.fn();
    const result = await createAdminStorageBucket({ ...production, FIREBASE_STORAGE_BUCKET: 'test-bucket' }, { authClient }, { StorageClient, firebaseAppFactory });
    expect(StorageClient).toHaveBeenCalledWith({ projectId: 'mi-tutora-pro', authClient });
    expect(result.bucket).toBe(bucket);
    expect(firebaseAppFactory).not.toHaveBeenCalled();
    await expect(createAdminStorageBucket({ ...production, FIREBASE_STORAGE_BUCKET: 'test-bucket' }, {}, { StorageClient })).rejects.toMatchObject({ code: 'admin/storage-unavailable', status: 503 });
  });

  it('pins Production Admin WIF to its own provider and configured Admin-only service account', () => {
    const environment = {
      ...production,
      VERCEL_PROJECT_ID: 'prj_VdnJ6Q6FzEL5u5nSvUL88uoMB4xq',
      GOOGLE_WIF_AUDIENCE: '//iam.googleapis.com/projects/196429461457/locations/global/workloadIdentityPools/ai-tutor-vercel/providers/vercel-admin-production',
      GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL: 'ycoders-admin-runtime@mi-tutora-pro.iam.gserviceaccount.com',
    };
    expect(resolveAdminGoogleWifConfiguration(environment)).toMatchObject({
      projectId: 'mi-tutora-pro',
      serviceAccountEmail: environment.GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL,
    });
    for (const changed of [
      { VERCEL_PROJECT_ID: 'prj_other' },
      { GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL: 'ai-tutor-runtime@mi-tutora-pro.iam.gserviceaccount.com' },
      { GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL: 'ycoders-admin-runtime@another-project.iam.gserviceaccount.com' },
      { GOOGLE_WIF_AUDIENCE: '//iam.googleapis.com/projects/196429461457/locations/global/workloadIdentityPools/ai-tutor-vercel/providers/vercel-production' },
      { FIREBASE_PROJECT_ID: 'another-project' },
    ]) expect(() => resolveAdminGoogleWifConfiguration({ ...environment, ...changed })).toThrow();
    expect(resolveAdminGoogleWifConfiguration({})).toBeNull();
  });

  it('requires a dedicated Admin bucket in Production and never selects the Firebase bucket for Admin writes', async () => {
    const bucket = { name: 'mi-tutora-pro-admin-content' };
    const StorageClient = vi.fn(function FakeStorage() { this.bucket = vi.fn(() => bucket); });
    const environment = { ...production, FIREBASE_STORAGE_BUCKET: 'mi-tutora-pro.firebasestorage.app', ADMIN_CONTENT_STORAGE_BUCKET: bucket.name };
    const result = await createAdminStorageBucket(environment, { authClient: {} }, { StorageClient, useDedicatedAdminBucket: true });
    expect(StorageClient.mock.instances[0].bucket).toHaveBeenCalledWith(bucket.name);
    expect(result.bucket).toBe(bucket);
    await expect(createAdminStorageBucket({ ...environment, ADMIN_CONTENT_STORAGE_BUCKET: '' }, { authClient: {} }, { StorageClient, useDedicatedAdminBucket: true })).rejects.toMatchObject({ code: 'admin/storage-unavailable' });
    await expect(createAdminStorageBucket({ ...environment, ADMIN_CONTENT_STORAGE_BUCKET: environment.FIREBASE_STORAGE_BUCKET }, { authClient: {} }, { StorageClient, useDedicatedAdminBucket: true })).rejects.toMatchObject({ code: 'admin/storage-unavailable' });
    expect(StorageClient).toHaveBeenCalledTimes(1);
  });

  it('routes only verified dedicated-bucket versions through the private server-side public API', async () => {
    const metadata = { artifactBucket: 'mi-tutora-pro-admin-content', artifactHash: 'abc', schemaVersion: '1.0.0' };
    const value = { metadata, document: { contentId: 'project-one', version: 2, schemaVersion: '1.0.0' } };
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => value }));
    const reader = createAdminPublicVersionReader({ ADMIN_CONTENT_STORAGE_BUCKET: metadata.artifactBucket, ADMIN_PUBLIC_CONTENT_ORIGIN: 'https://admin.ycoders.com' }, fetcher);
    await expect(reader('project-one', 2, metadata)).resolves.toBe(value);
    expect(fetcher).toHaveBeenCalledWith('https://admin.ycoders.com/api/admin-content/public/project-one/2', expect.objectContaining({ headers: { Accept: 'application/json' } }));
    await expect(reader('project-one', 2, { ...metadata, artifactBucket: 'mi-tutora-pro.firebasestorage.app' })).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(() => createAdminPublicVersionReader({ ADMIN_CONTENT_STORAGE_BUCKET: metadata.artifactBucket, ADMIN_PUBLIC_CONTENT_ORIGIN: 'https://other.example' }, fetcher)).toThrow();
  });

  it('allows the Admin server to read legacy published versions through the existing main public API', async () => {
    const metadata = { artifactHash: 'legacy', schemaVersion: '1.0.0' };
    const value = { metadata, document: { contentId: 'project-one', version: 1, schemaVersion: '1.0.0' } };
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => value }));
    expect(createLegacyPublicVersionReader({ VERCEL_ENV: 'preview' }, fetcher)).toBeNull();
    const reader = createLegacyPublicVersionReader(production, fetcher);
    await expect(reader('project-one', 1, metadata)).resolves.toBe(value);
    expect(fetcher).toHaveBeenCalledWith('https://ycoders.com/api/admin-content/public/project-one/1', expect.any(Object));
    await expect(reader('project-one', 1, { ...metadata, artifactBucket: 'mi-tutora-pro-admin-content' })).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('preserves artifact and asset paths inside the selected Admin bucket without object listing', async () => {
    const objects = new Map();
    const file = vi.fn((path) => ({
      save: async (bytes, options) => { expect(options.preconditionOpts).toEqual({ ifGenerationMatch: 0 }); objects.set(path, Buffer.from(bytes)); },
      download: async () => [objects.get(path)],
      getMetadata: async () => [{ metadata: { publicationState: 'CREATING' } }],
      setMetadata: async () => {},
    }));
    const bucket = { name: 'mi-tutora-pro-admin-content', file, getFiles: vi.fn(() => { throw new Error('Object listing is not permitted.'); }) };
    const artifacts = new FirebaseArtifactStore(bucket);
    const artifactPath = 'published-content/projects/project-one/v1.json';
    await artifacts.createImmutable(artifactPath, Buffer.from('{"ok":true}'), { artifactHash: 'abc' });
    expect((await artifacts.read(artifactPath)).toString()).toBe('{"ok":true}');
    await artifacts.markReady(artifactPath);
    const assetPath = 'admin-content-assets/asset-00000000-0000-0000-0000-000000000000.png';
    objects.set(assetPath, Buffer.from('image'));
    const assets = new FirebaseAssetRegistry({}, bucket);
    expect((await assets.read({ path: assetPath })).toString()).toBe('image');
    expect(file.mock.calls.map(([path]) => path)).toEqual([artifactPath, artifactPath, artifactPath, assetPath]);
    expect(bucket.getFiles).not.toHaveBeenCalled();
  });
});
