import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const port = 18081;
const secret = 'local-auth-validation-secret-0123456789abcdef';
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['tools/remote-compiler-runner/server.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), REMOTE_COMPILER_RUNNER_SECRET: secret },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

function sign(timestamp, executionId, body) {
  const digest = createHash('sha256').update(body).digest('hex');
  return createHmac('sha256', secret).update(`${timestamp}.${executionId}.${digest}`).digest('hex');
}

async function waitReady() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { const response = await fetch(`${base}/healthz`); if (response.ok) return; } catch { /* bounded retry */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('runner_not_ready');
}

async function request({ body, timestamp = String(Date.now()), executionId = randomUUID(), signature, omitSignature = false }) {
  const headers = { 'content-type': 'application/json', 'x-ycoders-timestamp': timestamp, 'x-ycoders-execution-id': executionId };
  if (!omitSignature) headers['x-ycoders-signature'] = signature ?? sign(timestamp, executionId, body);
  const response = await fetch(`${base}/v1/execute`, { method: 'POST', headers, body });
  return { status: response.status, body: await response.json() };
}

try {
  await waitReady();
  const body = JSON.stringify({ language: 'rust', source: 'fn main(){println!("auth-ok");}', stdin: '' });
  const executionId = randomUUID(); const timestamp = String(Date.now()); const validSignature = sign(timestamp, executionId, body);
  assert.equal((await request({ body, timestamp, executionId, signature: validSignature })).status, 200);
  assert.equal((await request({ body, timestamp, executionId, signature: validSignature })).status, 409);
  assert.equal((await request({ body, omitSignature: true })).status, 401);
  assert.equal((await request({ body, signature: '0'.repeat(64) })).status, 401);
  assert.equal((await request({ body: `${body} `, timestamp, executionId: randomUUID(), signature: validSignature })).status, 401);
  assert.equal((await request({ body, timestamp: String(Date.now() - 31_000) })).status, 401);
  assert.equal((await request({ body, timestamp: String(Date.now() + 31_000) })).status, 401);
  console.log(JSON.stringify({ valid: 200, replay: 409, missingSignature: 401, wrongSignature: 401, modifiedBody: 401, oldTimestamp: 401, futureTimestamp: 401, directBypass: 401 }));
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('close', resolve));
}
