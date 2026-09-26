import { describe, expect, it, vi } from 'vitest';
import { createRemoteCompilerExecutionHandler } from '../../server/remote-compiler/remoteCompilerExecutionHandler.js';
import { verifyRunnerSignature, RemoteRunnerClient } from '../../server/remote-compiler/RemoteRunnerClient.js';
import { assertRemoteCompilerRequest } from '../../server/remote-compiler/remoteCompilerPolicy.js';

function responseDouble() { return { writableEnded: false, statusCode: 0, body: null, setHeader: vi.fn(), status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; this.writableEnded = true; return this; } }; }
function handler(overrides = {}) {
  return createRemoteCompilerExecutionHandler({
    environment: { NODE_ENV: 'test', REMOTE_COMPILER_RUNTIME_ENABLED: 'true', GO_RUNTIME_ENABLED: 'true', RUST_RUNTIME_ENABLED: 'true' },
    credentialFactory: () => ({ preflight: vi.fn(), authClient: {} }), authenticator: { authenticate: vi.fn().mockResolvedValue({ uid: 'learner' }) },
    quotaFactory: async () => ({ quota: { acquire: vi.fn().mockResolvedValue({ uid: 'learner', leaseId: 'lease' }), release: vi.fn() }, close: vi.fn() }),
    runner: { execute: vi.fn().mockResolvedValue({ status: 'success', output: 'Hello\n', stdout: 'Hello\n', stderr: '', errors: [], exitCode: 0, executionTimeMs: 5 }) }, ...overrides,
  });
}

describe('remote compiler control plane', () => {
  it('fails closed when the global gate is disabled', async () => {
    const response = responseDouble(); await createRemoteCompilerExecutionHandler({ environment: {}, credentialFactory: vi.fn() })({ method: 'POST', headers: {}, body: {} }, response);
    expect(response.statusCode).toBe(503); expect(response.body.error.code).toBe('remote-compiler/unavailable');
  });
  it('authenticates, leases quota, and delegates a bounded Go request', async () => {
    const runner = { execute: vi.fn().mockResolvedValue({ status: 'success', output: 'ok\n' }) }; const response = responseDouble();
    await handler({ runner })({ method: 'POST', headers: {}, body: { language: 'go', source: 'package main\nfunc main(){}', stdin: '' } }, response);
    expect(response.statusCode).toBe(200); expect(runner.execute).toHaveBeenCalledWith(expect.objectContaining({ language: 'go', fileName: 'main.go' }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
  it('rejects unsupported languages and oversized source before runner execution', () => {
    expect(assertRemoteCompilerRequest({ language: 'python', source: 'print(1)' }, {})).toEqual(expect.objectContaining({ error: expect.any(Array) }));
    expect(assertRemoteCompilerRequest({ language: 'go', source: 'x'.repeat(70_000) }, { GO_RUNTIME_ENABLED: 'true' }).error[0]).toBe('remote-compiler/source-too-large');
  });
  it('signs runner calls and validates exact body integrity', async () => {
    const secret = 's'.repeat(32); let captured;
    const client = new RemoteRunnerClient({ environment: { REMOTE_COMPILER_RUNNER_URL: 'https://runner.internal', REMOTE_COMPILER_RUNNER_SECRET: secret }, now: () => 123, fetchImpl: async (_url, init) => { captured = init; return { ok: true, json: async () => ({ status: 'success' }) }; } });
    await client.execute({ language: 'rust', source: 'fn main() {}' });
    expect(verifyRunnerSignature({ secret, timestamp: captured.headers['x-ycoders-timestamp'], executionId: captured.headers['x-ycoders-execution-id'], body: captured.body, provided: captured.headers['x-ycoders-signature'], now: 123 })).toBe(true);
    expect(verifyRunnerSignature({ secret, timestamp: '123', executionId: captured.headers['x-ycoders-execution-id'], body: `${captured.body}x`, provided: captured.headers['x-ycoders-signature'], now: 123 })).toBe(false);
  });
  it('normalizes runner queue saturation without exposing runner details', async () => {
    const client = new RemoteRunnerClient({ environment: { REMOTE_COMPILER_RUNNER_URL: 'https://runner.internal', REMOTE_COMPILER_RUNNER_SECRET: 's'.repeat(32) }, fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ error: 'runner_busy', detail: 'private' }) }) });
    await expect(client.execute({ language: 'go', source: 'package main' })).rejects.toMatchObject({ code: 'remote-compiler/busy', status: 503, message: 'The compiler runner is busy.' });
  });
});
