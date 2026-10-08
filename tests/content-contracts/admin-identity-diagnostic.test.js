import { describe, expect, it, vi } from 'vitest';
import { createTemporaryIdentityDiagnostic, exchangeAdminIdentity, probeAdminReads, sanitizedOidcClaims } from '../../server/admin/diagnostics/temporaryIdentityDiagnostic.js';
import { createAdminContentApiRouter } from '../../server/admin/content/adminContentApiRouter.js';

const UID = 'xPpffhj3Z7XQP2aWwHUBnZqpw063';
const rawToken = `eyJhbGciOiJSUzI1NiJ9.${Buffer.from(JSON.stringify({ iss: 'https://oidc.vercel.com/avinashabbigeris-projects', sub: 'owner:avinashabbigeris-projects:project:ycoders-admin:environment:production', aud: 'https://vercel.com/avinashabbigeris-projects', owner_id: 'team_JWeTI30xjnERJbMpLUkgTpzV', project_id: 'prj_VdnJ6Q6FzEL5u5nSvUL88uoMB4xq', environment: 'production' })).toString('base64url')}.signature`;
function response() { return { headers: {}, statusCode: 200, setHeader(key, value) { this.headers[key] = value; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } }; }
const enabled = { ADMIN_DIAGNOSTICS_ENABLED: 'true', VERCEL_ENV: 'production' };
const future = () => Date.parse('2026-10-08T06:00:00Z');

describe('temporary Admin identity diagnostic', () => {
  it('requires the exact enable flag, an ID token and the named SUPER_ADMIN UID', async () => {
    const verifyAdmin = vi.fn(async () => ({ uid: UID, adminRole: 'SUPER_ADMIN' }));
    const oidcSource = vi.fn(async () => rawToken);
    const disabled = createTemporaryIdentityDiagnostic({ environment: { ...enabled, ADMIN_DIAGNOSTICS_ENABLED: 'false' }, now: future, verifyAdmin, oidcSource });
    const first = response(); await disabled({ method: 'GET', headers: {} }, first);
    expect(first.statusCode).toBe(404); expect(verifyAdmin).not.toHaveBeenCalled();
    const expired = createTemporaryIdentityDiagnostic({ environment: enabled, now: () => Date.parse('2026-10-08T11:00:01Z'), verifyAdmin, oidcSource });
    const second = response(); await expired({ method: 'GET', headers: {} }, second);
    expect(second.statusCode).toBe(404);
    const missing = createTemporaryIdentityDiagnostic({ environment: enabled, now: future, verifyAdmin: async () => null, oidcSource });
    const third = response(); await missing({ method: 'GET', headers: {} }, third);
    expect(third.statusCode).toBe(401);
    for (const actor of [{ uid: 'other', adminRole: 'SUPER_ADMIN' }, { uid: UID, adminRole: 'CONTENT_ADMIN' }]) {
      const route = createTemporaryIdentityDiagnostic({ environment: enabled, now: future, verifyAdmin: async () => actor, oidcSource });
      const denied = response(); await route({ method: 'GET', headers: {} }, denied);
      expect(denied.statusCode).toBe(403);
    }
    expect(oidcSource).not.toHaveBeenCalled();
  });

  it('returns sanitized Production claims and evidence but never raw tokens', async () => {
    const route = createTemporaryIdentityDiagnostic({ environment: enabled, now: future,
      verifyAdmin: async () => ({ uid: UID, adminRole: 'SUPER_ADMIN' }), oidcSource: async () => rawToken,
      exchange: async () => ({ success: true, principal: 'ycoders-admin-runtime@mi-tutora-pro.iam.gserviceaccount.com', accessToken: 'SECRET_ACCESS_TOKEN' }),
      probeReads: async () => ({ firestore: { authorized: true, itemCount: 0 }, storage: { published: { authorized: true, result: 'not-found' } } }),
    });
    const result = response(); await route({ method: 'GET', headers: {} }, result);
    expect(result.statusCode).toBe(200);
    expect(result.body.wif).toEqual({ status: 'success', effectivePrincipal: 'ycoders-admin-runtime@mi-tutora-pro.iam.gserviceaccount.com' });
    expect(result.body.claims.environment).toBe('production');
    expect(JSON.stringify(result.body)).not.toContain(rawToken);
    expect(JSON.stringify(result.body)).not.toContain('SECRET_ACCESS_TOKEN');
    expect(result.headers['Cache-Control']).toBe('no-store');
  });

  it('serializes a real Preview WIF denial without enabling Preview data reads', async () => {
    const probeReads = vi.fn();
    const route = createTemporaryIdentityDiagnostic({ environment: { ...enabled, VERCEL_ENV: 'preview' }, now: future,
      verifyAdmin: async () => ({ uid: UID, adminRole: 'SUPER_ADMIN' }), oidcSource: async () => rawToken,
      exchange: async () => ({ success: false, stage: 'sts', reasonCategory: 'provider-condition-mismatch' }), probeReads,
    });
    const result = response(); await route({ method: 'GET', headers: {} }, result);
    expect(result.body.wif).toEqual({ status: 'denied', stage: 'sts', reasonCategory: 'provider-condition-mismatch' });
    expect(result.body.firestore).toBeUndefined(); expect(probeReads).not.toHaveBeenCalled();
  });

  it('exchanges internally and reports only denial categories', async () => {
    const denied = await exchangeAdminIdentity(rawToken, vi.fn(async () => ({ ok: false, json: async () => ({ error_description: 'The given credential is rejected by the attribute condition.' }) })));
    expect(denied).toEqual({ success: false, stage: 'sts', reasonCategory: 'provider-condition-mismatch' });
    expect(JSON.stringify(denied)).not.toContain(rawToken);
  });

  it('performs bounded reads and distinguishes allowed not-found from prefix/list denial', async () => {
    const fetcher = vi.fn(async (url) => {
      if (url.includes('firestore.googleapis.com')) return { ok: true, status: 200, json: async () => ({}) };
      return { ok: false, status: url.includes('/o?') || url.includes('other%2F') ? 403 : 404 };
    });
    const result = await probeAdminReads('IN_MEMORY_ACCESS_TOKEN', fetcher);
    expect(result.firestore).toEqual({ authorized: true, itemCount: 0, collection: 'adminContentDrafts' });
    expect(result.storage.published).toMatchObject({ authorized: true, result: 'not-found' });
    expect(result.storage.assets).toMatchObject({ authorized: true, result: 'not-found' });
    expect(result.storage.other).toMatchObject({ authorized: false, result: 'permission-denied' });
    expect(result.storage.list).toEqual({ denied: true, httpStatus: 403 });
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(fetcher.mock.calls.every(([, options]) => !options.method || options.method === 'GET')).toBe(true);
  });

  it('retains the original public-detail URL contract through the flat function rewrite', async () => {
    const delivery = { fetchVersion: vi.fn(async () => null), resolveActive: vi.fn(async () => null) };
    const route = createAdminContentApiRouter({ environment: { VERCEL_ENV: 'production' },
      credentialFactory: () => ({ preflight: async () => {} }), dependencies: async () => ({ delivery, close: async () => {} }),
    });
    const result = response(); await route({ method: 'GET', url: '/api/admin-content?path=public%2Fnot-found', query: { path: 'public/not-found' }, headers: {} }, result);
    expect(result.statusCode).toBe(404);
    expect(result.body.error.code).toBe('content/not-published');
    expect(delivery.resolveActive).toHaveBeenCalledWith('not-found');
    expect(sanitizedOidcClaims(rawToken)).not.toHaveProperty('signature');
  });
});
