import { Timestamp } from 'firebase-admin/firestore';
import { CoinError } from '../../functions/src/coins/CoinError.js';
import { CoinLedgerService } from '../../functions/src/coins/CoinLedgerService.js';
import { firebaseAITutorAuthenticator } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import { createDefaultFirestore } from '../firestore/createDefaultFirestore.js';

const LOOPBACK = /^(?:127\.0\.0\.1|localhost)(?::\d+)?$/;
function assertDevelopmentEnvironment(environment) {
  if (environment.NODE_ENV === 'production'
    || environment.LOCAL_COIN_FULL_STACK !== 'true'
    || environment.VITE_FIREBASE_USE_EMULATORS !== 'true'
    || environment.FIREBASE_PROJECT_ID !== 'demo-mitutora-coins'
    || environment.VITE_FIREBASE_PROJECT_ID !== 'demo-mitutora-coins'
    || !LOOPBACK.test(String(environment.FIRESTORE_EMULATOR_HOST || ''))
    || !LOOPBACK.test(String(environment.FIREBASE_AUTH_EMULATOR_HOST || ''))) throw new Error('development-boundary-unavailable');
}

export function createDevelopmentCoinAdjustmentHandler({ environment = process.env, authenticator = firebaseAITutorAuthenticator, firestoreFactory = createDefaultFirestore } = {}) {
  return async function developmentCoinAdjustmentHandler(request, response) {
    let session;
    try {
      assertDevelopmentEnvironment(environment);
      const targetBalance = request.body?.targetBalance;
      if (!Number.isSafeInteger(targetBalance) || targetBalance < 0 || targetBalance > 100_000) {
        return response.status(400).json({ error: { code: 'coin/invalid-amount', message: 'Enter a whole-number balance from 0 to 100000.' } });
      }
      const credentials = Object.freeze({ mode: 'emulator', firebaseCredential: null, async preflight() {} });
      const authenticated = await authenticator.authenticate(request, { environment, googleCredentials: credentials });
      session = await firestoreFactory(environment, credentials);
      const ledger = new CoinLedgerService({ db: session.db, timestamp: () => Timestamp.now() });
      return response.status(200).json(await ledger.setDevelopmentBalance({ uid: authenticated.uid, targetBalance, idempotencyKey: request.body?.requestId }));
    } catch (error) {
      if (['ai/auth-required', 'ai/auth-invalid'].includes(error?.code)) return response.status(401).json({ error: { code: 'coin/unauthenticated', message: 'Sign in with the local emulator to adjust coins.' } });
      if (error instanceof CoinError) return response.status(400).json({ error: { code: error.code, message: error.message } });
      return response.status(404).json({ error: { code: 'coin/not-found', message: 'Not found.' } });
    } finally { await session?.close(); }
  };
}
