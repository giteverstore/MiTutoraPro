import {
  GoogleAuthProvider,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged as observeAuthState,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { app, firebaseEnvironment, useFirebaseEmulators } from './firebase';

export const auth = getAuth(app);

if (useFirebaseEmulators && !globalThis.__MITUTORA_FIREBASE_AUTH_EMULATOR_CONNECTED__) {
  connectAuthEmulator(
    auth,
    firebaseEnvironment.VITE_FIREBASE_AUTH_EMULATOR_URL ?? 'http://127.0.0.1:9099',
    { disableWarnings: true },
  );
  globalThis.__MITUTORA_FIREBASE_AUTH_EMULATOR_CONNECTED__ = true;
}

export function signInWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signUpWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signOutUser() {
  return signOut(auth);
}

export function getCurrentUser() {
  return auth.currentUser;
}

export function onAuthStateChanged(next, error, completed) {
  return observeAuthState(auth, next, error, completed);
}
