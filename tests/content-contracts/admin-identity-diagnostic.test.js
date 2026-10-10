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
    const expired = createTemporaryIdentityDiagnostic({ environment: enabled, now: () => Date.parse('2026-10-11T18:00:01Z'), verifyAdmin, oidcSource });
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
    expect(result.body.wif).not.toHaveProperty('googleError');
    expect(result.body.wif).not.toHaveProperty('googleMessage');
    expect(result.body.claims.environment).toBe('production');
    expect(JSON.stringify(result.body)).not.toContain(rawToken);
    expect(JSON.stringify(result.body)).not.toContain('SECRET_ACCESS_TOKEN');
    expect(result.headers['Cache-Control']).toBe('no-store');
  });

  it('serializes a real Preview WIF denial without enabling Preview data reads', async () => {
    const probeReads = vi.fn();
    const route = createTemporaryIdentityDiagnostic({ environment: { ...enabled, VERCEL_ENV: 'preview' }, now: future,
      verifyAdmin: async () => ({ uid: UID, adminRole: 'SUPER_ADMIN' }), oidcSource: async () => rawToken,
      exchange: async () => ({ success: false, stage: 'sts', reasonCategory: 'provider-condition-mismatch', googleError: 'invalid_grant', googleMessage: 'Rejected by attribute condition.' }), probeReads,
    });
    const result = response(); await route({ method: 'GET', headers: {} }, result);
    expect(result.body.wif).toEqual({ status: 'denied', stage: 'sts', reasonCategory: 'provider-condition-mismatch', googleError: 'invalid_grant', googleMessage: 'Rejected by attribute condition.' });
    expect(result.body.firestore).toBeUndefined(); expect(probeReads).not.toHaveBeenCalled();
  });

  it('keeps failure details credential-free at the HTTP boundary during the extended window', async () => {
    const firebaseIdToken = 'SYNTHETIC_FIREBASE_ID_TOKEN_VALUE_123456789';
    const route = createTemporaryIdentityDiagnostic({ environment: { ...enabled, VERCEL_ENV: 'preview' },
      now: () => Date.parse('2026-10-10T12:00:00Z'),
      verifyAdmin: async () => ({ uid: UID, adminRole: 'SUPER_ADMIN' }), oidcSource: async () => rawToken,
      exchange: async () => ({ success: false, stage: 'sts', reasonCategory: 'google-exchange-denied', googleError: 'invalid_request',
        googleMessage: `Invalid request. id_token=${firebaseIdToken} subject_token=${rawToken}`, accessToken: 'SHOULD_NOT_LEAK' }),
    });
    const result = response(); await route({ method: 'GET', headers: { authorization: `Bearer ${firebaseIdToken}` } }, result);
    expect(result.statusCode).toBe(200);
    expect(result.body.wif).toMatchObject({ status: 'denied', reasonCategory: 'google-exchange-denied', googleError: 'invalid_request' });
    const serialized = JSON.stringify(result.body);
    expect(serialized).not.toContain(firebaseIdToken);
    expect(serialized).not.toContain(rawToken);
    expect(serialized).not.toContain('SHOULD_NOT_LEAK');
  });

  it('sends the cloud-platform STS scope and returns only bounded, redacted failure detail', async () => {
    const fetcher = vi.fn(async () => ({ ok: false, json: async () => ({ error: 'invalid_grant', error_description: `The given credential is rejected by the attribute condition. subject_token=${rawToken} ${'more detail '.repeat(50)}` }) }));
    const denied = await exchangeAdminIdentity(rawToken, fetcher);
    const stsRequest = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(stsRequest.scope).toBe('https://www.googleapis.com/auth/cloud-platform');
    expect(stsRequest.subjectToken).toBe(rawToken);
    expect(stsRequest.audience).toContain('/providers/vercel-admin-production');
    expect(denied).toMatchObject({ success: false, stage: 'sts', reasonCategory: 'provider-condition-mismatch', googleError: 'invalid_grant' });
    expect(denied.googleMessage).toContain('attribute condition');
    expect(denied.googleMessage.length).toBeLessThanOrEqual(300);
    expect(JSON.stringify(denied)).not.toContain(rawToken);
  });

  it('redacts the intermediate STS access token from impersonation failure detail', async () => {
    const accessToken = 'SYNTHETIC_STS_ACCESS_TOKEN_VALUE_123456789';
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: accessToken }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: { status: 'PERMISSION_DENIED', message: `Permission denied; access_token=${accessToken}` } }) });
    const denied = await exchangeAdminIdentity(rawToken, fetcher);
    expect(denied).toMatchObject({ success: false, stage: 'impersonation', reasonCategory: 'google-exchange-denied', googleError: 'PERMISSION_DENIED' });
    expect(denied.googleMessage).toContain('Permission denied');
    expect(JSON.stringify(denied)).not.toContain(accessToken);
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
