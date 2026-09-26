import { RemoteRunnerClient } from '../server/remote-compiler/RemoteRunnerClient.js';

const requiredTrue = ['REMOTE_COMPILER_RUNTIME_ENABLED', 'REMOTE_COMPILER_DISTRIBUTED_QUOTA_ENABLED'];
const issues = [];
for (const name of requiredTrue) if (process.env[name] !== 'true') issues.push(`${name} must be exactly true.`);
if (process.env.GO_RUNTIME_ENABLED !== 'true' && process.env.RUST_RUNTIME_ENABLED !== 'true') issues.push('At least one language gate must be exactly true.');
const runnerUrl = String(process.env.REMOTE_COMPILER_RUNNER_URL ?? '');
const insecureLocalValidation = process.env.REMOTE_COMPILER_ALLOW_INSECURE_LOCALHOST === 'true' && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(runnerUrl);
if (!/^https:\/\//.test(runnerUrl) && !insecureLocalValidation) issues.push('REMOTE_COMPILER_RUNNER_URL must use HTTPS (except explicit localhost validation).');
if (String(process.env.REMOTE_COMPILER_RUNNER_SECRET ?? '').length < 32) issues.push('REMOTE_COMPILER_RUNNER_SECRET must contain at least 32 characters.');
if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_STORAGE_BUCKET) issues.push('Firebase project and Storage content authority must be configured.');

if (issues.length) { console.error(`Remote compiler production preflight failed:\n- ${issues.join('\n- ')}`); process.exitCode = 1; }
else if (!process.argv.includes('--live')) console.log('Remote compiler static production preflight passed. Use --live only against the isolated runner.');
else {
  const client = new RemoteRunnerClient();
  const probes = [];
  if (process.env.GO_RUNTIME_ENABLED === 'true') probes.push(client.execute({ language: 'go', fileName: 'main.go', source: 'package main\nimport "fmt"\nfunc main(){fmt.Println("ycoders-go-ready")}', stdin: '' }));
  if (process.env.RUST_RUNTIME_ENABLED === 'true') probes.push(client.execute({ language: 'rust', fileName: 'main.rs', source: 'fn main(){println!("ycoders-rust-ready");}', stdin: '' }));
  const results = await Promise.all(probes); if (results.some((result) => result.status !== 'success')) throw new Error('A live compiler readiness probe failed.');
  console.log(`Remote compiler live preflight passed (${results.map((result) => result.toolchainVersion).join(', ')}).`);
}
