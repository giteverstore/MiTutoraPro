import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { app, firebaseEnvironment, useFirebaseEmulators } from './firebase';

let instance = null;
let initializationError = null;

export function initializeFirebaseAppCheck() {
  if (instance || initializationError) return instance;
  const siteKey = firebaseEnvironment.VITE_FIREBASE_APP_CHECK_RECAPTCHA_ENTERPRISE_KEY;
  if (!siteKey) return null;

  try {
    if (import.meta.env.DEV && !useFirebaseEmulators) {
      const debugToken = firebaseEnvironment.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN;
      if (debugToken) globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }
    instance = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    return instance;
  } catch (error) {
    initializationError = error;
    return null;
  }
}

export const getAppCheckInitializationError = () => initializationError;
export const appCheck = initializeFirebaseAppCheck();
