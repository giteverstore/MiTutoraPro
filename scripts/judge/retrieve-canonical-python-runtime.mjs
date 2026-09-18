import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { CANONICAL_PYTHON_RUNTIME } from '../../functions/src/python-judge/CanonicalPythonRuntime.js';

const destination = resolve(process.argv[2] ?? '/opt/mitutora-judge');
const archive = resolve(destination, 'canonical-runtime.tar.zst');
const artifact = CANONICAL_PYTHON_RUNTIME.artifact;
const uri = `gs://${artifact.bucket}/${artifact.object}#${artifact.generation}`;

async function exists(path) {
  try { await access(path); return true; } catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
}

function run(file, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(file, args, { stdio: 'inherit', env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C' } });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolvePromise() : reject(new Error(`${file} failed.`)));
  });
}

function sha256File(path) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256');
    const input = createReadStream(path);
    input.once('error', reject);
    input.on('data', (chunk) => hash.update(chunk));
    input.once('end', () => resolvePromise(hash.digest('hex')));
  });
}

if (await exists(resolve(destination, 'runtime'))) throw new Error('Canonical runtime destination must not already contain runtime artifacts.');
await mkdir(destination, { recursive: true });
try {
  await run('gcloud', ['storage', 'cp', uri, archive, `--project=${artifact.projectId}`, '--no-clobber']);
  const downloaded = await stat(archive);
  if (downloaded.size !== artifact.sizeBytes || await sha256File(archive) !== artifact.sha256) {
    throw new Error('Canonical runtime bundle integrity check failed.');
  }
  await run('tar', ['--zstd', '-xf', archive, '-C', destination]);
  for (const [path, expected] of [['runtime/vmlinux', CANONICAL_PYTHON_RUNTIME.kernelDigest], ['runtime/rootfs.ext4', CANONICAL_PYTHON_RUNTIME.rootfsDigest]]) {
    if (await sha256File(resolve(destination, path)) !== expected) throw new Error(`Canonical runtime integrity check failed: ${path}.`);
  }
  process.stdout.write(`${JSON.stringify({ status: 'pass', generation: artifact.generation, sha256: artifact.sha256 })}\n`);
} finally {
  await rm(archive, { force: true });
}
