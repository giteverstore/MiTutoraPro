import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const server = await createServer({ mode: 'test', configFile: fileURLToPath(new URL('../../vite.config.js', import.meta.url)), server: { host: '127.0.0.1', port: 4176, strictPort: true } });
await writeFile(join(tmpdir(), 'ycoders-admin-browser-server.pid'), String(process.pid));
await server.listen();
const close = async () => { await server.close(); process.exit(0); };
process.once('SIGINT', close);
process.once('SIGTERM', close);
await new Promise(() => {});
