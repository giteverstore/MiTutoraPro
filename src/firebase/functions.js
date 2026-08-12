import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

export const functions = getFunctions(app);

if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export async function callFirebaseFunction(name, data) {
  const result = await httpsCallable(functions, name)(data);
  return result.data;
}
