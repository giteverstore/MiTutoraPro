import { getApp, getApps, initializeApp } from 'firebase/app';

const environment = import.meta.env ?? {};

const firebaseConfig = Object.freeze({
  apiKey: environment.VITE_FIREBASE_API_KEY,
  authDomain: environment.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: environment.VITE_FIREBASE_PROJECT_ID,
  storageBucket: environment.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: environment.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: environment.VITE_FIREBASE_APP_ID,
});

const environmentVariables = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
};

const missingVariables = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => environmentVariables[key]);

if (missingVariables.length) {
  throw new Error(`Missing Firebase environment variables: ${missingVariables.join(', ')}`);
}

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const useFirebaseEmulators = (import.meta.env.DEV || import.meta.env.MODE === 'e2e')
  && environment.VITE_FIREBASE_USE_EMULATORS === 'true';
export const firebaseEnvironment = environment;
