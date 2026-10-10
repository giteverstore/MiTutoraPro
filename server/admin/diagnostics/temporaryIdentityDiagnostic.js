import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getVercelOidcToken } from '@vercel/oidc';

// TEMPORARY: remove this module and its API entrypoint after Phase 14.2A.4.
const PROJECT_ID = 'mi-tutora-pro';
const ADMIN_UID = 'xPpffhj3Z7XQP2aWwHUBnZqpw063';
const SERVICE_ACCOUNT = 'ycoders-admin-runtime@mi-tutora-pro.iam.gserviceaccount.com';
const AUDIENCE = '//iam.googleapis.com/projects/196429461457/locations/global/workloadIdentityPools/ai-tutor-vercel/providers/vercel-admin-production';
const EXPIRES_AT = Date.parse('2026-10-11T18:00:00Z');

function bearer(request) {
  const match = String(request.headers?.authorization ?? '').match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

export async function verifyDiagnosticAdmin(request) {
  const idToken = bearer(request);
  if (!idToken) return null;
  // Signature, issuer, audience and expiry are verified using Google's public
  // certificates. Preview deliberately has no privileged Firebase credentials.
  const app = initializeApp({ projectId: PROJECT_ID }, `admin-identity-probe-${randomUUID()}`);
  try { return await getAuth(app).verifyIdToken(idToken, false); }
  catch { return null; }
  finally { await deleteApp(app); }
}

export function sanitizedOidcClaims(rawToken) {
  if (typeof rawToken !== 'string' || rawToken.length > 16_384 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(rawToken)) throw new Error('OIDC token unavailable.');
  const claims = JSON.parse(Buffer.from(rawToken.split('.')[1], 'base64url').toString('utf8'));
  const short = (value) => typeof value === 'string' ? value.slice(0, 256) : null;
  return {
    issuer: short(claims.iss), subject: short(claims.sub),
    audience: Array.isArray(claims.aud) ? claims.aud.map(short).slice(0, 3) : short(claims.aud),
    ownerId: short(claims.owner_id), projectId: short(claims.project_id),
    environment: short(claims.environment), branch: short(claims.ref),
  };
}

function categoryFromGoogleError(value) {
  const description = String(value?.error_description ?? value?.error?.message ?? '');
  return /attribute condition/i.test(description) ? 'provider-condition-mismatch' : 'google-exchange-denied';
}

function sanitizedGoogleFailure(value, secrets = []) {
  const rawCode = typeof value?.error === 'string' ? value.error : value?.error?.status;
  const googleError = typeof rawCode === 'string' && /^[a-z][a-z0-9._-]{0,63}$/i.test(rawCode) ? rawCode : null;
  let message = String(value?.error_description ?? value?.error?.message ?? '');
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret) message = message.replaceAll(secret, '[redacted]');
  }
  const googleMessage = message
    .replace(/(?:access|refresh|subject|id)[_-]?token\s*[:=]\s*[^\s,;]+/gi, '[redacted]')
    .replace(/[a-z0-9_./~+=-]{24,}/gi, '[redacted]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .slice(0, 300);
  return {
    ...(googleError ? { googleError } : {}),
    ...(googleMessage ? { googleMessage } : {}),
  };
}

export async function exchangeAdminIdentity(rawToken, fetcher = globalThis.fetch) {
  const sts = await fetcher('https://sts.googleapis.com/v1/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audience: AUDIENCE,
      grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
      subjectToken: rawToken,
    }),
  });
  const stsBody = await sts.json();
  if (!sts.ok) return { success: false, stage: 'sts', reasonCategory: categoryFromGoogleError(stsBody), ...sanitizedGoogleFailure(stsBody, [rawToken]) };
  if (typeof stsBody.access_token !== 'string') return { success: false, stage: 'sts', reasonCategory: 'incomplete-response' };
  const impersonation = await fetcher(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${SERVICE_ACCOUNT}:generateAccessToken`, {
    method: 'POST', headers: { Authorization: `Bearer ${stsBody.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/cloud-platform'], lifetime: '900s' }),
  });
  const impersonationBody = await impersonation.json();
  if (!impersonation.ok) return { success: false, stage: 'impersonation', reasonCategory: categoryFromGoogleError(impersonationBody), ...sanitizedGoogleFailure(impersonationBody, [rawToken, stsBody.access_token]) };
  if (typeof impersonationBody.accessToken !== 'string') return { success: false, stage: 'impersonation', reasonCategory: 'incomplete-response' };
  return { success: true, principal: SERVICE_ACCOUNT, accessToken: impersonationBody.accessToken };
}

export async function probeAdminReads(accessToken, fetcher = globalThis.fetch) {
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
  const firestore = await fetcher(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/adminContentDrafts?pageSize=1`, { headers });
  const firestoreResult = firestore.ok
    ? { authorized: true, itemCount: (await firestore.json()).documents?.length ?? 0, collection: 'adminContentDrafts' }
    : { authorized: false, httpStatus: firestore.status, collection: 'adminContentDrafts' };
  const bucket = 'mi-tutora-pro-admin-content';
  const objectGet = async (path) => {
    const result = await fetcher(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`, { headers });
    return { authorized: result.status === 404 || result.ok, result: result.status === 404 ? 'not-found' : result.status === 403 ? 'permission-denied' : result.ok ? 'unexpected-found' : 'unexpected-error', httpStatus: result.status };
  };
  const published = await objectGet('published-content/__identity-probe-does-not-exist__.json');
  const assets = await objectGet('admin-content-assets/__identity-probe-does-not-exist__.png');
  const other = await objectGet('other/__identity-probe__.json');
  const listResponse = await fetcher(`https://storage.googleapis.com/storage/v1/b/${bucket}/o?maxResults=1`, { headers });
  return {
    firestore: firestoreResult,
    storage: { published, assets, other, list: { denied: listResponse.status === 403, httpStatus: listResponse.status } },
  };
}

export function createTemporaryIdentityDiagnostic({
  environment = process.env, now = Date.now, verifyAdmin = verifyDiagnosticAdmin,
  oidcSource = getVercelOidcToken, exchange = exchangeAdminIdentity,
  probeReads = probeAdminReads,
} = {}) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (environment.ADMIN_DIAGNOSTICS_ENABLED !== 'true' || now() >= EXPIRES_AT
      || !['production', 'preview'].includes(environment.VERCEL_ENV)) {
      return response.status(404).json({ error: 'not-found' });
    }
    if (request.method !== 'GET') return response.status(405).json({ error: 'method-not-allowed' });
    const actor = await verifyAdmin(request);
    if (!actor) return response.status(401).json({ error: 'auth-required' });
    if (actor.uid !== ADMIN_UID || actor.adminRole !== 'SUPER_ADMIN') return response.status(403).json({ error: 'access-denied' });
    try {
      const rawToken = await oidcSource();
      const claims = sanitizedOidcClaims(rawToken);
      const exchanged = await exchange(rawToken);
      const wif = exchanged.success
        ? { status: 'success', effectivePrincipal: exchanged.principal }
        : { status: 'denied', stage: exchanged.stage, reasonCategory: exchanged.reasonCategory,
          ...sanitizedGoogleFailure({ error: exchanged.googleError, error_description: exchanged.googleMessage }, [rawToken, bearer(request)]),
        };
      // Never return a credential or use Preview to read Production data.
      const reads = environment.VERCEL_ENV === 'production' && exchanged.success
        ? await probeReads(exchanged.accessToken) : null;
      return response.status(200).json({ deploymentEnvironment: environment.VERCEL_ENV, claims, wif, ...(reads ? reads : {}) });
    } catch {
      return response.status(503).json({ error: 'diagnostic-unavailable' });
    }
  };
}
