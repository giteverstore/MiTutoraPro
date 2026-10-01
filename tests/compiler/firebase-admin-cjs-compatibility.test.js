import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('Firebase Admin CommonJS dependency compatibility', () => {
  it('keeps the jwks-rsa jose edge on the temporary CommonJS-compatible resolution', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));

    expect(manifest.overrides?.['jwks-rsa']?.jose).toBe('5.10.0');
    expect(lock.packages['node_modules/jwks-rsa']?.version).toBe('4.1.0');
    expect(lock.packages['node_modules/jwks-rsa/node_modules/jose']?.version).toBe('5.10.0');
    expect(readFileSync('node_modules/jwks-rsa/src/utils.js', 'utf8')).toContain("require('jose')");
  });

  it('loads Firebase Admin Auth with the require(ESM) bridge explicitly disabled', () => {
    const environment = { ...process.env };
    delete environment.NODE_OPTIONS;
    const probe = [
      "const jose = require('./node_modules/jwks-rsa/node_modules/jose');",
      "if (typeof jose.importJWK !== 'function' || typeof jose.exportSPKI !== 'function') process.exit(2);",
      "require('firebase-admin/auth');",
      "process.stdout.write(JSON.stringify({ jose: require('./node_modules/jwks-rsa/node_modules/jose/package.json').version, nodeOptions: process.env.NODE_OPTIONS || null }));",
    ].join('');
    const result = spawnSync(process.execPath, ['--no-experimental-require-module', '-e', probe], {
      cwd: process.cwd(),
      env: environment,
      encoding: 'utf8',
      timeout: 15_000,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ jose: '5.10.0', nodeOptions: null });
  });

  it('retains jwks-rsa signing-key conversion semantics with jose v5', async () => {
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'compatibility-probe', use: 'sig', alg: 'RS256' };
    const { retrieveSigningKeys } = require('../../node_modules/jwks-rsa/src/utils.js');

    const keys = await retrieveSigningKeys([jwk]);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatchObject({ kid: 'compatibility-probe', alg: 'RS256' });
    expect(keys[0].getPublicKey()).toContain('BEGIN PUBLIC KEY');
  });
});
