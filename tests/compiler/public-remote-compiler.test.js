import { describe, expect, it, vi } from 'vitest';
import { createPublicRemoteCompilerHandler } from '../../server/remote-compiler/publicRemoteCompilerHandler.js';
import { RemoteCompilerError } from '../../server/remote-compiler/RemoteCompilerError.js';

const environment = {
  PUBLIC_REMOTE_COMPILER_ENABLED: 'true',
  REMOTE_COMPILER_RUNTIME_ENABLED: 'true',
  REMOTE_COMPILER_DISTRIBUTED_QUOTA_ENABLED: 'true',
  GO_RUNTIME_ENABLED: 'true',
  RUST_RUNTIME_ENABLED: 'true',
};

function exchange({ body = { languageId: 'go', source: 'package main\nfunc main() {}', stdin: '' }, headers = {}, method = 'POST' } = {}) {
  const request = { method, body, headers, socket: { remoteAddress: '127.0.0.1' } };
  const response = {
    writableEnded: false,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; this.writableEnded = true; return this; },
  };
  return { request, response };
}

function dependencies(overrides = {}) {
  const quota = { acquire: vi.fn().mockResolvedValue({ identityHash: 'hash', executionId: 'execution' }), release: vi.fn().mockResolvedValue() };
  return {
    environment,
    authenticator: { authenticate: vi.fn().mockResolvedValue({ uid: 'learner-1' }) },
    credentialFactory: () => ({ preflight: vi.fn().mockResolvedValue() }),
    quotaFactory: vi.fn().mockResolvedValue({ quota, close: vi.fn().mockResolvedValue() }),
    runner: { execute: vi.fn().mockResolvedValue({ status: 'success', stdout: 'ok\n', stderr: '', exitCode: 0, secret: 'must-not-leak' }) },
    logger: { info: vi.fn() },
    quota,
    ...overrides,
  };
}

describe('public anonymous remote compiler endpoint', () => {
  it('executes anonymous Go through the existing runner and returns an allowlisted result', async () => {
    const deps = dependencies(); const { request, response } = exchange({ headers: { 'x-vercel-forwarded-for': '203.0.113.8' } });
    await createPublicRemoteCompilerHandler(deps)(request, response);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ language: 'go', status: 'success', stdout: 'ok\n', stderr: '', exitCode: 0 });
    expect(deps.authenticator.authenticate).not.toHaveBeenCalled();
    expect(deps.quota.acquire).toHaveBeenCalledWith(expect.objectContaining({ authenticated: false, language: 'go' }));
    expect(deps.runner.execute).toHaveBeenCalledWith(expect.objectContaining({ language: 'go', fileName: 'main.go' }), expect.any(Object));
    expect(deps.quota.release).toHaveBeenCalled();
  });

  it('uses verified optional auth and rejects invalid credentials without anonymous downgrade', async () => {
    const deps = dependencies(); const accepted = exchange({ headers: { authorization: 'Bearer valid' } });
    await createPublicRemoteCompilerHandler(deps)(accepted.request, accepted.response);
    expect(deps.quota.acquire).toHaveBeenCalledWith(expect.objectContaining({ identity: 'learner-1', authenticated: true }));

    const rejectedDeps = dependencies({ authenticator: { authenticate: vi.fn().mockRejectedValue(new Error('invalid')) } });
    const rejected = exchange({ headers: { authorization: 'Bearer invalid' } });
    await createPublicRemoteCompilerHandler(rejectedDeps)(rejected.request, rejected.response);
    expect(rejected.response).toMatchObject({ statusCode: 401, body: { error: { code: 'compiler/invalid-auth' } } });
    expect(rejectedDeps.quota.acquire).not.toHaveBeenCalled();
  });

  it.each([
    [{ languageId: 'python', source: 'print(1)', stdin: '' }, 400, 'compiler/invalid-language'],
    [{ languageId: 'go', source: 'package main', stdin: '', extra: true }, 400, 'compiler/invalid-request'],
    [{ languageId: 'go', source: 123, stdin: '' }, 400, 'compiler/invalid-request'],
    [{ languageId: 'go', source: 'x'.repeat(65 * 1024), stdin: '' }, 413, 'compiler/source-too-large'],
    [{ languageId: 'rust', source: 'fn main() {}', stdin: 'x'.repeat(65 * 1024) }, 413, 'compiler/stdin-too-large'],
  ])('rejects an invalid public payload', async (body, status, code) => {
    const deps = dependencies(); const value = exchange({ body });
    await createPublicRemoteCompilerHandler(deps)(value.request, value.response);
    expect(value.response).toMatchObject({ statusCode: status, body: { error: { code } } });
    expect(deps.runner.execute).not.toHaveBeenCalled();
  });

  it('rejects an oversized JSON envelope before field validation', async () => {
    const deps = dependencies(); const value = exchange({ body: { languageId: 'go', source: 'package main', stdin: '', extra: 'x'.repeat(151 * 1024) } });
    await createPublicRemoteCompilerHandler(deps)(value.request, value.response);
    expect(value.response).toMatchObject({ statusCode: 413, body: { error: { code: 'compiler/request-too-large' } } });
  });

  it('fails closed when the public feature gate is disabled', async () => {
    const deps = dependencies({ environment: { ...environment, PUBLIC_REMOTE_COMPILER_ENABLED: 'false' } }); const value = exchange();
    await createPublicRemoteCompilerHandler(deps)(value.request, value.response);
    expect(value.response).toMatchObject({ statusCode: 503, body: { error: { code: 'compiler/runner-unavailable' } } });
    expect(deps.runner.execute).not.toHaveBeenCalled();
  });

  it('maps origin denial and runner saturation to stable public errors', async () => {
    const denied = exchange({ headers: { origin: 'https://evil.example' } });
    await createPublicRemoteCompilerHandler(dependencies())(denied.request, denied.response);
    expect(denied.response).toMatchObject({ statusCode: 403, body: { error: { code: 'compiler/origin-denied' } } });

    const busyError = new RemoteCompilerError('remote-compiler/busy', 'internal runner detail', { status: 503 });
    const busyDeps = dependencies({ runner: { execute: vi.fn().mockRejectedValue(busyError) } });
    const busy = exchange(); await createPublicRemoteCompilerHandler(busyDeps)(busy.request, busy.response);
    expect(busy.response).toMatchObject({ statusCode: 503, body: { error: { code: 'compiler/runner-busy' } } });
    expect(busyDeps.quota.release).toHaveBeenCalled();
  });
});
