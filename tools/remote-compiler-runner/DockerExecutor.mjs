import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { RUNTIMES, CONTAINER_LIMITS } from './runtime-policy.mjs';

function runProcess(spawnImpl, binary, args, { signal, timeoutMs, outputBytes, stdin = null } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(binary, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: process.env.PATH } });
    let stdout = ''; let stderr = ''; let outputLimited = false; let timedOut = false;
    const append = (field, chunk) => {
      const next = field === 'stdout' ? stdout + chunk : stderr + chunk; const bounded = Buffer.from(next).subarray(0, outputBytes).toString('utf8');
      if (Buffer.byteLength(next) > outputBytes) { outputLimited = true; child.kill('SIGKILL'); }
      if (field === 'stdout') stdout = bounded; else stderr = bounded;
    };
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8'); child.stdout.on('data', (chunk) => append('stdout', chunk)); child.stderr.on('data', (chunk) => append('stderr', chunk));
    const terminate = () => { if (!child.killed) child.kill('SIGKILL'); }; const timer = setTimeout(() => { timedOut = true; terminate(); }, timeoutMs);
    signal?.addEventListener('abort', terminate, { once: true }); child.once('error', reject); child.once('close', (code) => { clearTimeout(timer); signal?.removeEventListener('abort', terminate); resolve({ code: Number(code), stdout, stderr, timedOut, outputLimited }); });
    child.stdin.end(stdin ?? undefined);
  });
}

function sanitizeLearnerOutput(value) {
  return String(value ?? '').replaceAll('/work/', '');
}

function extractTimings(value) {
  const timings = { compileTimeMs: null, runTimeMs: null };
  const output = String(value ?? '').replace(/^__YCODERS_TIMING__:(compile|run):(-?\d+)\r?\n?/gm, (_, phase, duration) => {
    const measured = Number(duration);
    timings[phase === 'compile' ? 'compileTimeMs' : 'runTimeMs'] = measured >= 0 ? measured : null;
    return '';
  });
  return { output, ...timings };
}

export class DockerExecutor {
  constructor({ spawnImpl = spawn, limits = CONTAINER_LIMITS } = {}) { this.spawnImpl = spawnImpl; this.limits = limits; }
  async docker(args, options = {}) { return runProcess(this.spawnImpl, 'docker', args, { timeoutMs: options.timeoutMs ?? 10_000, outputBytes: options.outputBytes ?? this.limits.outputBytes, signal: options.signal, stdin: options.stdin }); }
  async execute({ language, source, stdin = '', signal }) {
    const runtime = RUNTIMES[language]; if (!runtime) throw new Error('Unsupported runner language.');
    const containerName = `ycoders-${randomUUID()}`; const started = Date.now(); const phases = {};
    let phaseStarted = started;
    const finishPhase = (name) => { const now = Date.now(); phases[name] = now - phaseStarted; phaseStarted = now; };
    try {
      const createArgs = ['create', '--name', containerName, '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', this.limits.memory, '--memory-swap', this.limits.memorySwap, '--cpus', this.limits.cpus, '--pids-limit', this.limits.pids, '--ulimit', 'nofile=128:128', '--ulimit', 'fsize=67108864:67108864', '--user', '65534:65534', '--tmpfs', `/tmp:rw,nosuid,nodev,noexec,size=${this.limits.tempBytes},mode=1777`, '--tmpfs', `/work:rw,exec,nosuid,nodev,size=${this.limits.workspaceBytes},mode=1777`, '--workdir', '/work', '--entrypoint', '/bin/sleep', runtime.image, '65'];
      const created = await this.docker(createArgs, { signal }); if (created.code !== 0) throw new Error(created.stderr || 'Container creation failed.');
      finishPhase('containerCreateMs');
      const launched = await this.docker(['start', containerName], { signal }); if (launched.code !== 0) throw new Error(launched.stderr || 'Container startup failed.');
      finishPhase('containerStartMs');
      const stage = async (fileName, value) => {
        const staged = await this.docker(['exec', '-i', '--user', '65534:65534', containerName, '/bin/sh', '-c', `umask 077; cat > /work/${fileName}`], { signal, stdin: value });
        if (staged.code !== 0) throw new Error(staged.stderr || 'Source staging failed.');
      };
      await stage(runtime.fileName, source); await stage('stdin.txt', stdin);
      finishPhase('workspaceStageMs');
      const result = await this.docker(['exec', '--user', '65534:65534', containerName, '/runner/execute'], { signal, timeoutMs: this.limits.wallTimeoutMs }); const code = result.code;
      finishPhase('compilerAndRunMs');
      const status = result.timedOut || code === 122 || code === 124 ? 'timeout' : result.outputLimited ? 'output_limit' : signal?.aborted ? 'cancelled' : code === 0 ? 'success' : code === 2 ? 'compile_error' : code === 3 || code > 128 ? 'runtime_error' : 'infrastructure_error';
      const timing = extractTimings(result.stderr); const stdout = sanitizeLearnerOutput(result.stdout); const stderr = sanitizeLearnerOutput(timing.output);
      return { status, output: stdout, stdout, stderr, errors: status === 'success' ? [] : [stderr || `Execution stopped with status ${status}.`], diagnostics: [], warnings: [], exitCode: status === 'success' ? 0 : code, compileTimeMs: timing.compileTimeMs, executionTimeMs: timing.runTimeMs, totalTimeMs: Date.now() - started, phaseTimings: phases, timedOut: status === 'timeout', truncated: result.outputLimited, toolchainVersion: runtime.toolchainVersion };
    } finally {
      const cleanupStarted = Date.now();
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const removed = await this.docker(['rm', '-f', containerName], { timeoutMs: 10_000 }).catch(() => null);
        if (removed?.code === 0 || /No such container/i.test(removed?.stderr ?? '')) break;
      }
      phases.cleanupMs = Date.now() - cleanupStarted;
    }
  }
}

export const dockerExecutorInternals = Object.freeze({ runProcess, sanitizeLearnerOutput, extractTimings });
