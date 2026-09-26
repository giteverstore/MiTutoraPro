import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { RUNTIMES } from './runtime-policy.mjs';

const executeFile = promisify(execFile);

export class RunnerHealthProbe {
  constructor({ execute = executeFile } = {}) { this.execute = execute; }

  async command(args) {
    const { stdout } = await this.execute('docker', args, {
      timeout: 5_000,
      windowsHide: true,
      env: { PATH: process.env.PATH },
      maxBuffer: 64 * 1024,
    });
    return String(stdout).trim();
  }

  async inspectRuntime(language) {
    const runtime = RUNTIMES[language];
    await this.command(['image', 'inspect', runtime.image, '--format', '{{.Id}}']);
    const versionCommand = language === 'go' ? ['go', 'version'] : ['rustc', '--version'];
    const version = await this.command(['run', '--rm', '--network', 'none', '--entrypoint', versionCommand[0], runtime.image, ...versionCommand.slice(1)]);
    const uid = await this.command(['run', '--rm', '--network', 'none', '--user', '65534:65534', '--entrypoint', 'id', runtime.image, '-u']);
    if (!version.includes(runtime.toolchainVersion)) throw new Error(`${language} toolchain version mismatch.`);
    if (!/^\d+$/.test(uid) || uid === '0') throw new Error(`${language} learner identity is not non-root.`);
    return Object.freeze({ version, uid: Number(uid) });
  }

  async readiness() {
    try {
      const engine = await this.command(['version', '--format', '{{.Server.Version}}']);
      const [go, rust] = await Promise.all([this.inspectRuntime('go'), this.inspectRuntime('rust')]);
      return { ready: true, status: 'ready', runnerVersion: '1', engine, toolchains: { go: go.version, rust: rust.version }, learnerUid: { go: go.uid, rust: rust.uid } };
    } catch {
      return { ready: false, status: 'not_ready', runnerVersion: '1' };
    }
  }
}
