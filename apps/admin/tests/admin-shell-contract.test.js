import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_DOCUMENT_SECURITY_HEADERS, ADMIN_LOCAL_SECURITY_HEADERS } from '../../../config/adminSecurityHeaderPolicy.mjs';

const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const authSource = readFileSync(resolve(process.cwd(), 'src/adminAuthClient.js'), 'utf8');
const sharedAuthSource = readFileSync(resolve(process.cwd(), '../../src/firebase/auth.js'), 'utf8');
const viteConfigSource = readFileSync(resolve(process.cwd(), 'vite.config.js'), 'utf8');
const vercelConfig = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));

describe('Admin shell and security contracts', () => {
  it('has desktop, tablet, focus, and reduced-motion behavior', () => {
    expect(css).toContain('.admin-shell {');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('.admin-sidebar.is-open');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('uses restrictive Admin document headers', () => {
    const productionCsp = ADMIN_DOCUMENT_SECURITY_HEADERS['Content-Security-Policy'];
    const developmentCsp = ADMIN_LOCAL_SECURITY_HEADERS['Content-Security-Policy'];

    expect(productionCsp).toContain("frame-ancestors 'none'");
    expect(ADMIN_DOCUMENT_SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
    expect(ADMIN_DOCUMENT_SECURITY_HEADERS['Referrer-Policy']).toBe('no-referrer');
    expect(ADMIN_DOCUMENT_SECURITY_HEADERS['Permissions-Policy']).toContain('camera=()');
    expect(productionCsp).toContain("script-src 'self' 'wasm-unsafe-eval' https://apis.google.com");
    expect(productionCsp).toContain('frame-src https://*.firebaseapp.com https://accounts.google.com');
    expect(productionCsp).not.toContain("'unsafe-eval'");
    expect(productionCsp).not.toContain("'unsafe-inline'");

    expect(developmentCsp).toContain("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://apis.google.com");
    expect(developmentCsp).toContain("style-src 'self' 'unsafe-inline'");
    expect(developmentCsp).toContain('frame-src https://*.firebaseapp.com https://accounts.google.com');
    expect(developmentCsp).not.toContain("'unsafe-eval'");
    expect(developmentCsp).not.toContain('file:');

    const deployedCsp = vercelConfig.headers[0].headers.find(
      ({ key }) => key === 'Content-Security-Policy',
    )?.value;
    expect(deployedCsp).toBe(productionCsp);
  });

  it('derives roles only from token claims and does not trust local storage', () => {
    expect(authSource).toContain('getIdTokenResult');
    expect(authSource).toContain('adminRoleFromClaims');
    expect(authSource).not.toMatch(/localStorage|sessionStorage|queryString|searchParams/);
  });

  it('uses the Admin-local environment and the shared Firebase Auth client', () => {
    expect(viteConfigSource).toContain('loadEnv(mode, import.meta.dirname');
    expect(viteConfigSource).toContain('envDir: import.meta.dirname');
    expect(viteConfigSource).toContain('fs: { allow: [repositoryRoot] }');
    expect(authSource).toContain("../../../src/firebase/auth.js");
    expect(sharedAuthSource).toContain('signInWithEmailAndPassword');
    expect(sharedAuthSource).not.toContain('tenantId');
  });
});
