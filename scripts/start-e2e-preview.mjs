import { build, preview } from 'vite';

await build({ mode: 'e2e' });
const server = await preview({
  mode: 'e2e',
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});

const close = async () => {
  await server.close();
  process.exit(0);
};

process.once('SIGINT', close);
process.once('SIGTERM', close);
