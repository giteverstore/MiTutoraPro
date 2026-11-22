import { createPrivateKey, sign } from 'node:crypto';
import { IdentityPoolClient, Impersonated } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';

export const V2_GATEWAY_AUDIENCE = 'ycoders-editor-v2-gateway';
export const V2_GATEWAY_CALLER = 'ycoders-learner-gateway';

export class ServiceAssertionError extends Error {
  constructor(code, message) { super(message); this.name = 'ServiceAssertionError'; this.code = code; }
}

function assertTestOnly(environment, targetUrl) {
  const deployment = String(environment.VERCEL_ENV ?? environment.YCODERS_ENVIRONMENT ?? '').toLowerCase();
  const projectId = String(environment.FIREBASE_PROJECT_ID ?? '');
  const hostname = new URL(targetUrl).hostname.toLowerCase();
  const productionHost = String(environment.V2_DELIVERY_PRODUCTION_HOSTNAME ?? '').toLowerCase();
  if (deployment === 'production' || !projectId.startsWith('demo-') || (productionHost && hostname === productionHost)) {
    throw new ServiceAssertionError('v2/test-service-auth-forbidden', 'Test service authentication cannot target production.');
  }
}

export class LocalTestServiceAssertionProvider {
  constructor({ environment = process.env, privateKey, now = () => Date.now() } = {}) {
    this.environment = environment; this.privateKey = typeof privateKey === 'object' && privateKey?.type === 'private' ? privateKey : createPrivateKey(privateKey); this.now = now;
  }
  async authorization({ method, path, correlationId, targetUrl }) {
    assertTestOnly(this.environment, targetUrl);
    const issuedAt = Math.floor(this.now()/1000);
    const claims = { iss:'ycoders-test-service-auth', sub:V2_GATEWAY_CALLER, aud:V2_GATEWAY_AUDIENCE, env:String(this.environment.V2_GATEWAY_TRUST_ENVIRONMENT ?? 'emulator'), method:method.toUpperCase(), path, iat:issuedAt, exp:issuedAt+30, jti:correlationId };
    const encoded = Buffer.from(JSON.stringify(claims)).toString('base64url'), input = `v1.${encoded}`;
    return `ServiceAssertion ${input}.${sign(null, Buffer.from(input), this.privateKey).toString('base64url')}`;
  }
}

export class UnconfiguredWorkloadIdentityProvider {
  async authorization() { throw new ServiceAssertionError('v2/service-auth-unconfigured', 'Production workload identity is not configured.'); }
}

const WIF_AUDIENCE = /^\/\/iam\.googleapis\.com\/projects\/\d+\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/;
const SERVICE_ACCOUNT = /^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/;
export class StagingWifServiceAssertionProvider {
  constructor({ environment=process.env, tokenSource=getVercelOidcToken, IdentityPoolClientClass=IdentityPoolClient, ImpersonatedClass=Impersonated }={}) { this.environment=environment; this.tokenSource=tokenSource; this.IdentityPoolClientClass=IdentityPoolClientClass; this.ImpersonatedClass=ImpersonatedClass; this.configuration=this.resolve(); }
  resolve() {
    const env=this.environment, deployment=String(env.VERCEL_ENV??env.YCODERS_ENVIRONMENT??'').toLowerCase();
    if (!['preview','staging'].includes(deployment) || String(env.FIREBASE_PROJECT_ID??'').startsWith('demo-') || env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new ServiceAssertionError('v2/staging-wif-forbidden','Staging WIF configuration is not valid for this environment.');
    const audience=String(env.V2_GATEWAY_WIF_AUDIENCE??''), serviceAccount=String(env.V2_GATEWAY_SERVICE_ACCOUNT_EMAIL??''), targetAudience=String(env.V2_GATEWAY_GOOGLE_TOKEN_AUDIENCE??'');
    if (!WIF_AUDIENCE.test(audience) || !SERVICE_ACCOUNT.test(serviceAccount) || !/^https:\/\/[^/]+$/.test(targetAudience)) throw new ServiceAssertionError('v2/service-auth-unconfigured','Staging WIF configuration is incomplete.');
    return { audience, serviceAccount, targetAudience };
  }
  createImpersonatedClient() {
    const source = new this.IdentityPoolClientClass({ type:'external_account', audience:this.configuration.audience, subject_token_type:'urn:ietf:params:oauth:token-type:jwt', token_url:'https://sts.googleapis.com/v1/token', subject_token_supplier:{ getSubjectToken:()=>this.tokenSource() }, scopes:['https://www.googleapis.com/auth/cloud-platform'] });
    return new this.ImpersonatedClass({ sourceClient:source, targetPrincipal:this.configuration.serviceAccount, targetScopes:['https://www.googleapis.com/auth/cloud-platform'], lifetime:600 });
  }
  firebaseCredential(impersonated = this.createImpersonatedClient()) {
    return Object.freeze({
      async getAccessToken() {
        const result = await impersonated.getAccessToken();
        const accessToken = result?.token ?? impersonated.credentials?.access_token;
        if (typeof accessToken !== 'string' || !accessToken) throw new ServiceAssertionError('v2/service-auth-unavailable','Google service identity could not be obtained.');
        const expiryDate = Number(impersonated.credentials?.expiry_date);
        return { access_token: accessToken, expires_in: Number.isFinite(expiryDate) ? Math.max(1, Math.floor((expiryDate-Date.now())/1000)) : 600 };
      },
    });
  }
  async authorization({ targetUrl }) {
    if (new URL(targetUrl).origin !== this.configuration.targetAudience) throw new ServiceAssertionError('v2/service-audience-mismatch','Editor gateway origin does not match the configured token audience.');
    const impersonated = this.createImpersonatedClient();
    const token = await impersonated.fetchIdToken(this.configuration.targetAudience, { includeEmail:true });
    if (!token) throw new ServiceAssertionError('v2/service-auth-unavailable','Google service identity could not be obtained.');
    return `Bearer ${token}`;
  }
}

export function createV2GatewayFirebaseCredentialContext({ environment=process.env }={}) {
  if (String(environment.V2_GATEWAY_SERVICE_AUTH_MODE??'') !== 'staging-wif') return Object.freeze({ mode:'adc', firebaseCredential:null });
  const provider = new StagingWifServiceAssertionProvider({ environment });
  return Object.freeze({ mode:'wif', firebaseCredential:provider.firebaseCredential() });
}

export function createV2ProgressFirebaseCredentialContext({ environment=process.env }={}) {
  if (String(environment.V2_PROGRESS_SERVICE_AUTH_MODE??'') !== 'staging-wif') return Object.freeze({ mode:'adc', firebaseCredential:null });
  const progressEnvironment = { ...environment, V2_GATEWAY_SERVICE_AUTH_MODE:'staging-wif', V2_GATEWAY_SERVICE_ACCOUNT_EMAIL:environment.V2_PROGRESS_SERVICE_ACCOUNT_EMAIL };
  const provider = new StagingWifServiceAssertionProvider({ environment:progressEnvironment });
  const authClient = provider.createImpersonatedClient();
  return Object.freeze({ mode:'wif', authClient, firebaseCredential:provider.firebaseCredential(authClient) });
}

export function createV2PracticeStateFirebaseCredentialContext({ environment=process.env }={}) {
  if (String(environment.V2_PRACTICE_STATE_SERVICE_AUTH_MODE??'') !== 'staging-wif') return Object.freeze({ mode:'adc', firebaseCredential:null });
  const practiceEnvironment = { ...environment, V2_GATEWAY_SERVICE_AUTH_MODE:'staging-wif', V2_GATEWAY_SERVICE_ACCOUNT_EMAIL:environment.V2_PRACTICE_STATE_SERVICE_ACCOUNT_EMAIL };
  const provider = new StagingWifServiceAssertionProvider({ environment:practiceEnvironment });
  const authClient = provider.createImpersonatedClient();
  return Object.freeze({ mode:'wif', authClient, firebaseCredential:provider.firebaseCredential(authClient) });
}

export function createServiceAssertionProvider(environment = process.env) {
  const mode=String(environment.V2_GATEWAY_SERVICE_AUTH_MODE??'');
  if (mode === 'staging-wif') return new StagingWifServiceAssertionProvider({ environment });
  if (mode !== 'test-ed25519') return new UnconfiguredWorkloadIdentityProvider();
  const target = String(environment.V2_DELIVERY_SERVICE_URL ?? '');
  const privateKey = environment.V2_GATEWAY_TEST_PRIVATE_KEY;
  if (!target || !privateKey) throw new ServiceAssertionError('v2/service-auth-unconfigured', 'Test service assertion configuration is incomplete.');
  assertTestOnly(environment, target);
  return new LocalTestServiceAssertionProvider({ environment, privateKey: privateKey.replaceAll('\\n', '\n') });
}
