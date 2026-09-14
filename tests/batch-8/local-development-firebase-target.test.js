import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('normal local development Firebase boundary', () => {
  const launcher = readFileSync('scripts/run-vite-development.mjs', 'utf8');
  const firebase = readFileSync('src/firebase/firebase.js', 'utf8');
  const auth = readFileSync('src/firebase/auth.js', 'utf8');
  const firestore = readFileSync('src/firebase/firestore.js', 'utf8');
  const storage = readFileSync('src/firebase/storage.js', 'utf8');

  it('pins normal npm dev to the safe demo project and all three loopback emulators', () => {
    expect(launcher).toContain("const projectId = 'demo-mitutora-coins'");
    expect(launcher).toContain("LOCAL_COIN_FULL_STACK: 'true'");
    expect(launcher).toContain("FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080'");
    expect(launcher).toContain("FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099'");
    expect(launcher).toContain("STORAGE_EMULATOR_HOST: 'http://127.0.0.1:9199'");
    expect(launcher).toContain("VITE_FIREBASE_USE_EMULATORS: 'true'");
    expect(launcher).toContain("VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099'");
    expect(launcher).toContain("VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: '127.0.0.1'");
    expect(launcher).toContain("VITE_FIREBASE_FIRESTORE_EMULATOR_PORT: '8080'");
    expect(launcher).toContain("VITE_FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1'");
    expect(launcher).toContain("VITE_FIREBASE_STORAGE_EMULATOR_PORT: '9199'");
    expect(launcher).toContain("VITE_ENABLE_LOCAL_CHALLENGE_FALLBACK: 'false'");
  });

  it('keeps emulator binding development-only while each Firebase SDK uses its official connector', () => {
    expect(firebase).toMatch(/import\.meta\.env\.DEV[\s\S]*VITE_FIREBASE_USE_EMULATORS === 'true'/);
    expect(auth).toContain('connectAuthEmulator(');
    expect(firestore).toContain('connectFirestoreEmulator(');
    expect(storage).toContain('connectStorageEmulator(');
  });
});
