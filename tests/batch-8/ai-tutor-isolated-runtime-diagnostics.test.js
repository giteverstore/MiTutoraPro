import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createPhase47d3eHandler } from '../../server/diagnostics/phase47d3eAuthorization.js';

const SECRET = 'x'.repeat(48);
const environment = Object.freeze({
  AI_TUTOR_INFRA_PROBE_SECRET: SECRET,
  AI_TUTOR_ENABLED: 'false',
  AI_TUTOR_ROLLOUT_PERCENTAGE: '0',
});

function response() {
  return {
    statusCode: 0, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function invoke(layer, run, { headers = { 'x-ai-tutor-infra-probe': SECRET }, body = {} } = {}) {
  const reply = response();
  await createPhase47d3eHandler({ layer, run, environment })({ method: 'POST', headers, body }, reply);
  return reply;
}

describe('Phase 4.7D.3E isolated runtime diagnostics', () => {
  it.each(['handler-runtime', 'vercel-oidc', 'google-wif', 'firebase-auth-init', 'quota-firestore-init'])
  ('allows each fixed diagnostic layer to execute independently: %s', async (layer) => {
    const run = vi.fn(async () => {});
    const reply = await invoke(layer, run);
    expect(reply).toMatchObject({ statusCode: 200, body: { probe: 'phase47d3e', layer, status: 'pass' } });
    expect(run).toHaveBeenCalledOnce();
  });

  it('fails closed before a layer runs when authentication is missing or incorrect', async () => {
    for (const headers of [{}, { 'x-ai-tutor-infra-probe': 'wrong' }]) {
      const run = vi.fn();
      const reply = await invoke('handler-runtime', run, { headers });
      expect(reply.statusCode).toBe(401);
      expect(run).not.toHaveBeenCalled();
    }
  });

  it('rejects caller-selected targets and sanitizes layer failures', async () => {
    const run = vi.fn(async () => { throw new Error('token credential learner UID'); });
    const invalid = await invoke('quota-firestore-init', run, { body: { database: '(default)' } });
    expect(invalid.statusCode).toBe(400);
    expect(run).not.toHaveBeenCalled();
    const failed = await invoke('quota-firestore-init', run);
    expect(failed).toMatchObject({ statusCode: 503, body: { status: 'fail' } });
    expect(JSON.stringify(failed.body)).not.toMatch(/token|credential|learner|uid/i);
  });

  it('keeps every route isolated from later layers and all provider/learner code', async () => {
    const sources = Object.fromEntries(await Promise.all([
      ['entrypoint', 'api/ai/explain.js'],
      ['authorization', 'server/diagnostics/phase47d3eAuthorization.js'],
      ['probe', 'server/ai/infrastructureProbe.js'],
    ].map(async ([name, path]) => [name, await readFile(path, 'utf8')])));

    expect(sources.entrypoint).toMatch(/createAIExplainHandler/);
    expect(sources.authorization).not.toMatch(/firebase-admin|Firestore|createAIProvider|OpenAIProvider|HuggingFaceProvider|verifyIdToken/);
    expect(sources.probe).toMatch(/collection\('aiTutorQuotas'\).*collection\('aiTutorQuotaReservations'\)/s);
    expect(sources.probe).not.toMatch(/createAIProvider|OpenAIProvider|HuggingFaceProvider|learner/);
    expect(environment.AI_TUTOR_ENABLED).toBe('false');
    expect(environment.AI_TUTOR_ROLLOUT_PERCENTAGE).toBe('0');
  });
});
