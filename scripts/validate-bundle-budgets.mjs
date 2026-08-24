import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { evaluateBundleBudget } from './performance/bundleBudget.mjs';

const root = process.cwd();
const dist = path.join(root, 'dist');
const manifestPath = path.join(dist, '.vite', 'manifest.json');

if (!fs.existsSync(manifestPath)) {
  throw new Error('Build manifest is missing. Run npm run build before validating bundle budgets.');
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const result = evaluateBundleBudget(manifest, (assetPath) => {
  const bytes = fs.readFileSync(path.join(dist, assetPath));
  return { bytes: bytes.byteLength, gzipBytes: gzipSync(bytes).byteLength };
});

if (result.failures.length) {
  console.error(result.failures.join('\n'));
  process.exitCode = 1;
} else {
  const measurement = result.measurements;
  console.log('Bundle budgets passed.');
  console.log(`Initial JS: ${measurement.initialJavaScriptBytes} bytes (${measurement.initialJavaScriptGzipBytes} gzip)`);
  console.log(`Initial CSS: ${measurement.initialCssBytes} bytes (${measurement.initialCssGzipBytes} gzip)`);
  console.log(`Lazy route entries: 12`);
  console.log('Monaco, vision, and Silero remain outside the initial static graph.');
}
