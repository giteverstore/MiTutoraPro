import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { HttpV2DeliveryTransport } from '../../server/v2-pilot/V2PilotGateway';
import { LocalTestServiceAssertionProvider, ServiceAssertionError, StagingWifServiceAssertionProvider, createServiceAssertionProvider } from '../../server/v2-pilot/ServiceAssertion';

const keys = generateKeyPairSync('ed25519');
const environment = { VERCEL_ENV:'preview', FIREBASE_PROJECT_ID:'demo-ycoders-learner', V2_GATEWAY_TRUST_ENVIRONMENT:'emulator', V2_DELIVERY_SERVICE_URL:'http://127.0.0.1:4400' };

describe('learner gateway service assertions', () => {
  it('creates a short-lived request-bound assertion separate from the learner token', async () => {
    const provider = new LocalTestServiceAssertionProvider({ environment, privateKey:keys.privateKey, now:()=>1_000_000 });
    const authorization = await provider.authorization({ method:'GET', path:'/api/v2/gateway/courses/course-a', correlationId:'correlation-1', targetUrl:'http://127.0.0.1:4400/api/v2/gateway/courses/course-a' });
    const token = authorization.replace('ServiceAssertion ', ''), [version, encoded, signature] = token.split('.');
    const claims = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    expect(claims).toMatchObject({ sub:'ycoders-learner-gateway', aud:'ycoders-editor-v2-gateway', env:'emulator', method:'GET', path:'/api/v2/gateway/courses/course-a', iat:1000, exp:1030, jti:'correlation-1' });
    expect(verify(null, Buffer.from(`${version}.${encoded}`), keys.publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
    expect(authorization).not.toContain('learner-token');
  });

  it('hard-disables test assertions for production, non-demo projects, and production hosts', async () => {
    const cases = [
      { ...environment, VERCEL_ENV:'production' },
      { ...environment, FIREBASE_PROJECT_ID:'real-project' },
      { ...environment, V2_DELIVERY_PRODUCTION_HOSTNAME:'editor.example.com' },
    ];
    for (const current of cases) {
      const provider = new LocalTestServiceAssertionProvider({ environment:current, privateKey:keys.privateKey });
      const targetUrl = current.V2_DELIVERY_PRODUCTION_HOSTNAME ? 'https://editor.example.com/api/v2/gateway/courses/a' : 'http://127.0.0.1:4400/api/v2/gateway/courses/a';
      await expect(provider.authorization({ method:'GET', path:'/api/v2/gateway/courses/a', correlationId:'c', targetUrl })).rejects.toBeInstanceOf(ServiceAssertionError);
    }
  });

  it('fails closed when workload identity configuration is absent', async () => {
    await expect(createServiceAssertionProvider({}).authorization({})).rejects.toMatchObject({ code:'v2/service-auth-unconfigured' });
  });

  it('forwards service identity and correlation to the dedicated Editor gateway path', async () => {
    const serviceAssertionProvider = { authorization:vi.fn(async ()=>'ServiceAssertion signed') };
    const fetchImpl = vi.fn(async () => ({ ok:true, json:async()=>({ ok:true, data:{ contentId:'course-a', publicationVersion:2 } }) }));
    const transport = new HttpV2DeliveryTransport(environment, fetchImpl, serviceAssertionProvider);
    await transport.request({ kind:'course', contentId:'course-a', publicationVersion:2 }, { correlationId:'correlation-1' });
    expect(serviceAssertionProvider.authorization).toHaveBeenCalledWith(expect.objectContaining({ method:'GET', path:'/api/v2/gateway/courses/course-a/versions/2', correlationId:'correlation-1' }));
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:4400/api/v2/gateway/courses/course-a/versions/2', expect.objectContaining({ headers:expect.objectContaining({ Authorization:'ServiceAssertion signed', 'X-Correlation-Id':'correlation-1' }) }));
  });
  it('uses Vercel OIDC, WIF and dedicated impersonation to mint an exact-audience staging ID token', async()=>{
    let sourceOptions,impersonatedOptions;
    class Source{constructor(options){sourceOptions=options}}
    class ImpersonatedClient{constructor(options){impersonatedOptions=options}async fetchIdToken(audience){expect(audience).toBe('https://editor-staging.example.com');return 'google-id-token'}}
    const provider=new StagingWifServiceAssertionProvider({environment:{VERCEL_ENV:'preview',FIREBASE_PROJECT_ID:'ycoders-staging',V2_GATEWAY_WIF_AUDIENCE:'//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/vercel/providers/mitutora',V2_GATEWAY_SERVICE_ACCOUNT_EMAIL:'learner-gateway@ycoders-staging.iam.gserviceaccount.com',V2_GATEWAY_GOOGLE_TOKEN_AUDIENCE:'https://editor-staging.example.com'},tokenSource:async()=>'vercel-oidc',IdentityPoolClientClass:Source,ImpersonatedClass:ImpersonatedClient});
    await expect(provider.authorization({targetUrl:'https://editor-staging.example.com/api/v2/gateway/courses/a'})).resolves.toBe('Bearer google-id-token');
    expect(await sourceOptions.subject_token_supplier.getSubjectToken()).toBe('vercel-oidc');expect(impersonatedOptions.targetPrincipal).toBe('learner-gateway@ycoders-staging.iam.gserviceaccount.com');
  });
  it('does not allow staging WIF in production or demo projects',()=>{for(const env of [{VERCEL_ENV:'production',FIREBASE_PROJECT_ID:'real'},{VERCEL_ENV:'preview',FIREBASE_PROJECT_ID:'demo-local'}])expect(()=>new StagingWifServiceAssertionProvider({environment:env})).toThrow(/staging wif/i)});
});
