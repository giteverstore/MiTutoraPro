import { createServer } from 'node:http';
import { verifyRunnerSignature } from '../../server/remote-compiler/RemoteRunnerClient.js';
import { assertRemoteCompilerRequest } from '../../server/remote-compiler/remoteCompilerPolicy.js';
import { DockerExecutor } from './DockerExecutor.mjs';
import { BoundedExecutor } from './BoundedExecutor.mjs';
import { RunnerHealthProbe } from './RunnerHealthProbe.mjs';

const port = Number(process.env.PORT || 8080); const secret = String(process.env.REMOTE_COMPILER_RUNNER_SECRET || ''); const executor = new BoundedExecutor(new DockerExecutor()); const healthProbe = new RunnerHealthProbe(); const seen = new Map();
function send(response, status, value) { response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(value)); }
function readBody(request, limit = 160 * 1024) { return new Promise((resolve, reject) => { let body = ''; request.setEncoding('utf8'); request.on('data', (chunk) => { body += chunk; if (Buffer.byteLength(body) > limit) { request.destroy(); reject(new Error('Request too large.')); } }); request.on('end', () => resolve(body)); request.on('error', reject); }); }

createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/healthz') { const health = await healthProbe.readiness(); return send(response, health.ready ? 200 : 503, health); }
  if (request.method !== 'POST' || request.url !== '/v1/execute') return send(response, 404, { error: 'not_found' });
  try {
    const bodyText = await readBody(request); const timestamp = request.headers['x-ycoders-timestamp']; const executionId = request.headers['x-ycoders-execution-id']; const provided = request.headers['x-ycoders-signature'];
    if (!verifyRunnerSignature({ secret, timestamp, executionId, body: bodyText, provided })) return send(response, 401, { error: 'unauthorized' });
    if (seen.has(executionId)) return send(response, 409, { error: 'replay' }); seen.set(executionId, Date.now()); for (const [id, time] of seen) if (Date.now() - time > 60_000) seen.delete(id);
    const body = JSON.parse(bodyText); const checked = assertRemoteCompilerRequest(body, { GO_RUNTIME_ENABLED: 'true', RUST_RUNTIME_ENABLED: 'true' }); if (checked.error) return send(response, 400, { error: checked.error[0] });
    const result = await executor.execute({ language: checked.language, source: checked.source, stdin: checked.stdin, signal: AbortSignal.timeout(35_000) }); return send(response, 200, result);
  } catch (error) { return send(response, 503, { error: error?.message === 'runner_busy' ? 'runner_busy' : 'runner_failure' }); }
}).listen(port, '0.0.0.0');
