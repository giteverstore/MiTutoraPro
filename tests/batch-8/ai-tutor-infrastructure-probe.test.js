import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createInfrastructureProbeHandler } from '../../server/ai/infrastructureProbe.js';

function response() {
  return {
    statusCode: 0,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const environment = Object.freeze({
  AI_TUTOR_INFRA_PROBE_SECRET: 'a'.repeat(48),
  AI_TUTOR_ENABLED: 'false',
  AI_TUTOR_ROLLOUT_PERCENTAGE: '0',
});

describe('protected AI Tutor infrastructure probe', () => {
  it('accepts only the configured probe secret and an empty POST', async () => {
    const runner = vi.fn(async () => ({ probe: 'ai-tutor-infrastructure' }));
    const handler = createInfrastructureProbeHandler({ environment, runner });
    const reply = response();
    await handler({ method: 'POST', headers: { 'x-ai-tutor-infra-probe': 'a'.repeat(48) }, body: {} }, reply);
    expect(reply.statusCode).toBe(200);
    expect(runner).toHaveBeenCalledOnce();
  });

  it.each([
    ['missing secret', {}, 401],
    ['incorrect secret', { 'x-ai-tutor-infra-probe': 'b'.repeat(48) }, 401],
  ])('rejects %s before running', async (_name, headers, status) => {
    const runner = vi.fn();
    const reply = response();
    await createInfrastructureProbeHandler({ environment, runner })({ method: 'POST', headers, body: {} }, reply);
    expect(reply.statusCode).toBe(status);
    expect(runner).not.toHaveBeenCalled();
  });

  it('rejects wrong methods and caller-selected parameters', async () => {
    const runner = vi.fn();
    const handler = createInfrastructureProbeHandler({ environment, runner });
    const methodReply = response();
    await handler({ method: 'GET', headers: {} }, methodReply);
    expect(methodReply.statusCode).toBe(405);
    const bodyReply = response();
    await handler({ method: 'POST', headers: { 'x-ai-tutor-infra-probe': 'a'.repeat(48) }, body: { database: '(default)' } }, bodyReply);
    expect(bodyReply.statusCode).toBe(400);
    expect(runner).not.toHaveBeenCalled();
  });

  it('returns no internal error details', async () => {
    const reply = response();
    const runner = vi.fn(async () => { throw new Error('credential token private_key'); });
    await createInfrastructureProbeHandler({ environment, runner })({ method: 'POST', headers: { 'x-ai-tutor-infra-probe': 'a'.repeat(48) }, body: {} }, reply);
    expect(reply).toMatchObject({
      statusCode: 503,
      body: {
        probe: 'ai-tutor-infrastructure',
        status: 'runtime-failure',
        lastCompletedStage: 'probe-authentication',
        failureCategory: 'runtime-failure',
      },
    });
    expect(JSON.stringify(reply.body)).not.toMatch(/credential|token|private_key/);
  });

  it('reports only the last successfully completed diagnostic stage', async () => {
    const runner = vi.fn(async ({ advanceStage }) => {
      advanceStage('vercel-oidc-acquired');
      advanceStage('google-wif-credential-created');
      throw new Error('sensitive credential detail');
    });
    const reply = response();
    await createInfrastructureProbeHandler({ environment, runner })({
      method: 'POST',
      headers: { 'x-ai-tutor-infra-probe': 'a'.repeat(48) },
      body: {},
    }, reply);
    expect(reply.statusCode).toBe(503);
    expect(reply.body.lastCompletedStage).toBe('google-wif-credential-created');
    expect(JSON.stringify(reply.body)).not.toMatch(/sensitive|credential detail/);
  });

  it('advances stages monotonically without continuing after failure', async () => {
    const stages = [];
    const runner = vi.fn(async ({ advanceStage }) => {
      advanceStage('vercel-oidc-acquired');
      stages.push('vercel-oidc-acquired');
      throw new Error('stop');
    });
    const reply = response();
    await createInfrastructureProbeHandler({ environment, runner })({
      method: 'POST',
      headers: { 'x-ai-tutor-infra-probe': 'a'.repeat(48) },
      body: {},
    }, reply);
    expect(stages).toEqual(['vercel-oidc-acquired']);
    expect(reply.body.lastCompletedStage).toBe('vercel-oidc-acquired');
    expect(runner).toHaveBeenCalledOnce();
  });

  it('pins targets, reuses WIF, and cannot construct a provider', async () => {
    const source = await readFile('server/ai/infrastructureProbe.js', 'utf8');
    expect(source).toContain("const PROJECT_ID = 'mi-tutora-pro'");
    expect(source).toContain("const QUOTA_DATABASE = 'ai-tutor-quota'");
    expect(source).toContain('createVercelGoogleCredentialContext');
    expect(source).toContain("databaseId: '(default)'");
    expect(source).not.toMatch(/createAIProvider|OpenAIProvider|HuggingFaceProvider|FIREBASE_SERVICE_ACCOUNT_JSON/);
    expect(environment.AI_TUTOR_ENABLED).toBe('false');
    expect(environment.AI_TUTOR_ROLLOUT_PERCENTAGE).toBe('0');
  });
});
