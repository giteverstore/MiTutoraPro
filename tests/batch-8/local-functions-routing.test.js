import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('local Firebase callable routing', () => {
  it('routes all Firebase clients through the shared safe emulator switch', () => {
    const source = readFileSync('src/firebase/functions.js', 'utf8');
    expect(source).toContain("import { app, useFirebaseEmulators } from './firebase'");
    expect(source).toContain('if (useFirebaseEmulators');
    expect(source).toContain("connectFunctionsEmulator(functions, '127.0.0.1', 5001)");
    expect(source).not.toContain('VITE_FIREBASE_FUNCTIONS_EMULATOR');
    expect(source).not.toContain('cloudfunctions.net');
  });

  it('keeps trusted evidence and certification on the common callable authority', () => {
    const trusted = readFileSync('src/progress/TrustedCompletionService.js', 'utf8');
    const certification = readFileSync('src/certification/repositories/CertificationApiRepository.js', 'utf8');
    expect(trusted).toContain("callFirebaseFunction('beginTrustedLessonEvidence'");
    expect(certification).toContain("this.call('getCertificationStatus'");
    expect(trusted).not.toContain('cloudfunctions.net');
    expect(certification).not.toContain('cloudfunctions.net');
  });

  it('declares the Functions emulator explicitly beside the existing local services', () => {
    const firebase = JSON.parse(readFileSync('firebase.json', 'utf8'));
    expect(firebase.emulators).toMatchObject({
      auth: { port: 9099 }, firestore: { port: 8080 }, functions: { port: 5001 }, storage: { port: 9199 },
    });
  });

  it('preserves the unauthenticated callable classification instead of collapsing it to internal', () => {
    const source = readFileSync('functions/src/index.js', 'utf8');
    expect(source).toMatch(/supported = new Set\(\['unauthenticated'/);
  });
});
