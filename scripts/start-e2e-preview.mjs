import { build, preview } from 'vite';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const port = Number(process.env.E2E_APP_PORT);
const ownershipDirectory = join(process.cwd(), '.tmp-firebase-config');
const ownershipFile = join(ownershipDirectory, 'playwright-preview-owner.json');
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('E2E_APP_PORT must contain the dynamically allocated Playwright preview port.');
}

if (process.env.E2E_SKIP_BUILD !== 'true') await build({ mode: 'e2e' });
const server = await preview({
  mode: 'e2e',
  preview: { host: '127.0.0.1', port, strictPort: true },
});
mkdirSync(ownershipDirectory, { recursive: true });
writeFileSync(ownershipFile, JSON.stringify({ ownerPid: process.pid, port }), 'utf8');

const close = async () => {
  await server.close();
  rmSync(ownershipFile, { force: true });
  process.exit(0);
};

process.once('SIGINT', close);
process.once('SIGTERM', close);
