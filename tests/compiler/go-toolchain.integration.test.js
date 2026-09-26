import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

async function runGo(source, input = '') {
  const directory = await mkdtemp(join(tmpdir(), 'ycoders-go-test-')); const file = join(directory, 'main.go'); await writeFile(file, source);
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn('go', ['run', file], { windowsHide: true, env: { ...process.env, GOPROXY: 'off', GOSUMDB: 'off' } }); let stdout = ''; let stderr = '';
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8'); child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
      const timer = setTimeout(() => child.kill('SIGKILL'), 20_000); child.once('error', reject); child.once('close', (code) => { clearTimeout(timer); if (code === 0) resolve({ stdout, stderr }); else reject(Object.assign(new Error(stderr || `go exited ${code}`), { stdout, stderr, code })); }); child.stdin.end(input);
    });
  }
  finally { await rm(directory, { recursive: true, force: true }); }
}

describe.skipIf(process.env.YCODERS_RUN_REAL_REMOTE_COMPILER_TESTS !== 'true')('official Go toolchain evidence', () => {
  it('executes stdout and standard input with normal Go semantics', async () => {
    const result = await runGo('package main\nimport("bufio";"fmt";"os")\nfunc main(){in:=bufio.NewReader(os.Stdin); var n int; fmt.Fscan(in,&n); fmt.Println(n*2)}', '5\n');
    expect(result.stdout).toBe('10\n');
  }, 30_000);
  it('returns genuine compiler diagnostics', async () => {
    await expect(runGo('package main\nfunc main(){ missing }')).rejects.toMatchObject({ stderr: expect.stringContaining('undefined: missing') });
  }, 30_000);
});
