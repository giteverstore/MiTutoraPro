import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const suspiciousName = /(?:firebase-adminsdk|service[-_]?account|admin[-_]?credentials).*\.json$/i;
const privateKey = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const serviceAccount = /"type"\s*:\s*"service_account"[\s\S]{0,4000}"private_key"\s*:/;
const violations = [];

for (const file of tracked) {
  if (!existsSync(file)) continue;
  if (suspiciousName.test(basename(file))) violations.push(`${file}: credential-like filename`);
  if (!/\.(?:json|js|mjs|cjs|ts|tsx|jsx|env|txt)$/i.test(file)) continue;
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  if (privateKey.test(text) || serviceAccount.test(text)) violations.push(`${file}: credential material`);
}

if (violations.length) {
  console.error(`Secret hygiene validation failed (${violations.length} finding(s)):`);
  violations.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}
console.log(`Secret hygiene validation passed (${tracked.length} tracked files inspected; no secret values printed).`);
