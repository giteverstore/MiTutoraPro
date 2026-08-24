import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { app, firebaseEnvironment, useFirebaseEmulators } from './firebase';

export const storage = getStorage(app);

if (
  useFirebaseEmulators
  && firebaseEnvironment.VITE_FIREBASE_STORAGE_EMULATOR === 'true'
  && !globalThis.__MITUTORA_FIREBASE_STORAGE_EMULATOR_CONNECTED__
) {
  connectStorageEmulator(
    storage,
    firebaseEnvironment.VITE_FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1',
    Number(firebaseEnvironment.VITE_FIREBASE_STORAGE_EMULATOR_PORT ?? 9199),
  );
  globalThis.__MITUTORA_FIREBASE_STORAGE_EMULATOR_CONNECTED__ = true;
}
