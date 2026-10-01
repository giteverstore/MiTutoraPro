import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const launcher = readFileSync(join(process.cwd(), 'scripts/start-e2e-firebase-emulators.mjs'), 'utf8');
const playwrightConfig = readFileSync(join(process.cwd(), 'playwright.config.js'), 'utf8');
const teardown = readFileSync(join(process.cwd(), 'scripts/teardown-e2e-servers.mjs'), 'utf8');
const rulesLauncher = readFileSync(join(process.cwd(), 'scripts/run-firebase-rules-test.mjs'), 'utf8');

describe('Firebase emulator harness ownership contract', () => {
  it('pins the isolated project, fixed ports, and real readiness probes', () => {
    expect(launcher).toContain("const PROJECT_ID = 'demo-mitutora'");
    expect(launcher).toContain("{ name: 'Firestore', port: 8080 }");
    expect(launcher).toContain("{ name: 'Auth', port: 9099 }");
    expect(launcher).toContain("fetch('http://127.0.0.1:9099/')");
    expect(launcher).toContain('/v1/projects/${PROJECT_ID}/databases/(default)/documents');
  });

  it('refuses foreign processes and tears down only its owned process tree', () => {
    expect(launcher).toContain('Refusing to attach to an emulator not owned by this E2E run.');
    expect(launcher).toContain("spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F']");
    expect(launcher).toContain("rmSync(temporary, { recursive: true, force: true })");
  });

  it('runs rules suites against pinned demo projects with isolated CLI state', () => {
    expect(rulesLauncher).toContain("projectId: 'demo-content-rules'");
    expect(rulesLauncher).toContain("projectId: 'demo-certification-rules'");
    expect(rulesLauncher).toContain("projectId: 'demo-storage-rules'");
    expect(rulesLauncher).toContain('refusing to attach to an unowned process');
    expect(rulesLauncher).toContain('XDG_CONFIG_HOME');
  });

  it('makes Playwright use the owned launcher without server reuse', () => {
    expect(playwrightConfig).toContain("command: 'node scripts/start-e2e-firebase-emulators.mjs'");
    expect(playwrightConfig).toContain("url: 'http://127.0.0.1:9099'");
    expect(playwrightConfig.match(/reuseExistingServer: false/g)).toHaveLength(2);
    expect(playwrightConfig).toContain("globalTeardown: './scripts/teardown-e2e-servers.mjs'");
    expect(teardown).toContain("record.childPid ?? record.ownerPid");
    expect(teardown).toContain("spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F']");
  });
});
