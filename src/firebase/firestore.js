import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { app, firebaseEnvironment, useFirebaseEmulators } from './firebase';

export const db = getFirestore(app);

if (useFirebaseEmulators && !globalThis.__MITUTORA_FIREBASE_FIRESTORE_EMULATOR_CONNECTED__) {
  connectFirestoreEmulator(
    db,
    firebaseEnvironment.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST ?? '127.0.0.1',
    Number(firebaseEnvironment.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT ?? 8080),
  );
  globalThis.__MITUTORA_FIREBASE_FIRESTORE_EMULATOR_CONNECTED__ = true;
}
