import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { RemoteCompilerError } from './RemoteCompilerError.js';

function signature(secret, timestamp, executionId, body) {
  const digest = createHash('sha256').update(body).digest('hex');
  return createHmac('sha256', secret).update(`${timestamp}.${executionId}.${digest}`).digest('hex');
}

export class RemoteRunnerClient {
  constructor({ environment = process.env, fetchImpl = globalThis.fetch, now = Date.now } = {}) { this.environment = environment; this.fetchImpl = fetchImpl; this.now = now; }
  async execute(payload, { signal } = {}) {
    const url = String(this.environment.REMOTE_COMPILER_RUNNER_URL ?? '').trim(); const secret = String(this.environment.REMOTE_COMPILER_RUNNER_SECRET ?? '');
    if (!url || secret.length < 32) throw new RemoteCompilerError('remote-compiler/unavailable', 'The compiler runner is not configured.', { status: 503 });
    const body = JSON.stringify(payload); const timestamp = String(this.now()); const executionId = randomUUID();
    let response;
    try {
      response = await this.fetchImpl(`${url.replace(/\/$/, '')}/v1/execute`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ycoders-timestamp': timestamp, 'x-ycoders-execution-id': executionId, 'x-ycoders-signature': signature(secret, timestamp, executionId, body) }, body, signal });
    } catch (cause) { throw new RemoteCompilerError('remote-compiler/runner-unavailable', 'The compiler runner could not be reached.', { status: 503, cause }); }
    const result = await response.json().catch(() => null);
    if (response.status === 503 && result?.error === 'runner_busy') throw new RemoteCompilerError('remote-compiler/busy', 'The compiler runner is busy.', { status: 503 });
    if (!response.ok || !result) throw new RemoteCompilerError('remote-compiler/runner-error', 'The compiler runner rejected the execution.', { status: response.status >= 400 && response.status < 600 ? response.status : 503 });
    return result;
  }
}

export function verifyRunnerSignature({ secret, timestamp, executionId, body, provided, now = Date.now(), maxAgeMs = 30_000 }) {
  if (!secret || !timestamp || !executionId || !provided || Math.abs(now - Number(timestamp)) > maxAgeMs) return false;
  const expected = signature(secret, timestamp, executionId, body); const left = Buffer.from(expected); const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}
