import { readFileSync } from 'node:fs';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { IdentityPoolClient } from 'google-auth-library';
import { describe, expect, it, vi } from 'vitest';
import { createVercelGoogleCredentialContext } from '../../server/auth/VercelGoogleCredentialAdapter.js';
import {
  COMPILER_PUBLIC_DATABASE_ID,
  closeCompilerPublicFirestore,
  createCompilerPublicFirestore,
} from '../../server/compiler-public/createCompilerPublicFirestore.js';

const environment = {
  NODE_ENV: 'production',
  VERCEL_ENV: 'production',
  FIREBASE_PROJECT_ID: 'mi-tutora-pro',
  GOOGLE_WIF_AUDIENCE: '//iam.googleapis.com/projects/196429461457/locations/global/workloadIdentityPools/ai-tutor-vercel/providers/vercel-production',
  GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL: 'ai-tutor-runtime@mi-tutora-pro.iam.gserviceaccount.com',
};

describe('compiler-public direct Firestore adapter', () => {
  it('injects the actual WIF IdentityPoolClient into the default-database Firestore client', async () => {
    const context = createVercelGoogleCredentialContext({
      request: { headers: {} },
      environment,
      tokenSource: async () => 'synthetic.header.signature',
    });
    expect(context.authClient).toBeInstanceOf(IdentityPoolClient);
    const firestore = createCompilerPublicFirestore(environment, { authClient: context.authClient });
    expect(firestore).toBeInstanceOf(Firestore);
    expect(firestore._settings).toMatchObject({
      projectId: 'mi-tutora-pro',
      databaseId: COMPILER_PUBLIC_DATABASE_ID,
      authClient: context.authClient,
    });
    await closeCompilerPublicFirestore(firestore);
  });

  it('uses the supported authClient constructor option without key material', () => {
    const authClient = { getAccessToken: vi.fn() };
    const FirestoreClient = vi.fn(function FirestoreClient(options) { this.options = options; });
    const firestore = createCompilerPublicFirestore(environment, { authClient, FirestoreClient });
    expect(firestore.options).toEqual({
      projectId: 'mi-tutora-pro',
      databaseId: '(default)',
      authClient,
    });
    expect(firestore.options).not.toHaveProperty('credentials');
    expect(firestore.options).not.toHaveProperty('keyFilename');
  });

  it('fails closed instead of falling back to ADC in deployed Production', () => {
    expect(() => createCompilerPublicFirestore(environment)).toThrow('A deployed WIF auth client is required.');
  });

  it('uses timestamp values compatible with the direct Firestore package', () => {
    const value = Timestamp.fromMillis(1_800_000_000_000);
    expect(value).toBeInstanceOf(Timestamp);
    expect(value.toMillis()).toBe(1_800_000_000_000);
  });

  it('removes the Firebase Admin Firestore materializer from compiler-public Production', () => {
    const source = readFileSync('server/compiler-public/compilerPublicService.js', 'utf8');
    expect(source).not.toMatch(/firebase-admin\/firestore|getFirestore\s*\(/);
    expect(source).toContain('createCompilerPublicFirestore');
  });
});
