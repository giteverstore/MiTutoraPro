import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { app, useFirebaseEmulators } from './firebase';

export const functions = getFunctions(app);

if (useFirebaseEmulators && !globalThis.__MITUTORA_FIREBASE_FUNCTIONS_EMULATOR_CONNECTED__) {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  globalThis.__MITUTORA_FIREBASE_FUNCTIONS_EMULATOR_CONNECTED__ = true;
}

export async function callFirebaseFunction(name, data) {
  const result = await httpsCallable(functions, name)(data);
  return result.data;
}
