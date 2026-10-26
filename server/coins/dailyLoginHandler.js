import { Timestamp } from 'firebase-admin/firestore';
import { CoinError } from '../../functions/src/coins/CoinError.js';
import { CoinLedgerService } from '../../functions/src/coins/CoinLedgerService.js';
import { DailyLoginRewardService } from '../../functions/src/coins/DailyLoginRewardService.js';
import { firebaseAITutorAuthenticator } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import { createVercelGoogleCredentialContext } from '../auth/VercelGoogleCredentialAdapter.js';
import { createDefaultFirestore } from '../firestore/createDefaultFirestore.js';
import { createServerTiming } from '../http/serverTiming.js';

function publicError(error) {
  if (error instanceof CoinError) {
    const status = error.code === 'coin/unauthenticated' ? 401 : 400;
    return { status, body: { error: { code: error.code, message: error.message } } };
  }
  if (['ai/auth-required', 'ai/auth-invalid'].includes(error?.code)) {
    return { status: 401, body: { error: { code: 'coin/unauthenticated', message: 'Sign in to claim the daily login reward.' } } };
  }
  return { status: 503, body: { error: { code: 'coin/service-unavailable', message: 'The daily login reward could not be claimed.' } } };
}

export function dailyLoginFailureCategory(error) {
  const code = String(error?.code ?? '').toLowerCase();
  if (code === '7' || code.includes('permission-denied') || code.includes('permission_denied')) return 'PERMISSION_DENIED';
  if (code === '16' || code.includes('unauthenticated')) return 'UNAUTHENTICATED';
  if (code === '5' || code.includes('not-found') || code.includes('not_found')) return 'DATABASE_NOT_FOUND';
  if (code.includes('invalid-credential')) return 'INVALID_CREDENTIAL';
  if (code.startsWith('ai/auth-')) return 'AUTH_TOKEN_VERIFY';
  if (error instanceof CoinError) return 'COIN_SERVICE';
  return 'RUNTIME_FAILURE';
}

export function createDailyLoginHandler({ environment = process.env, authenticator = firebaseAITutorAuthenticator, credentialFactory = createVercelGoogleCredentialContext, firestoreFactory = createDefaultFirestore, rewardServiceFactory = ({ ledger, timestamp }) => new DailyLoginRewardService({ ledger, timestamp }), logger = console } = {}) {
  return async function dailyLoginHandler(request, response) {
    const timing = createServerTiming();
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      timing.apply(response, { include: ['total'] });
      return response.status(405).json({ error: { code: 'coin/method-not-allowed', message: 'Use POST for the daily login reward.' } });
    }
    let session;
    let stage = 'OIDC_WIF_CONTEXT';
    try {
      const finishWif = timing.start('wif');
      const googleCredentials = credentialFactory({ request, environment });
      stage = 'WIF_PREFLIGHT';
      await googleCredentials.preflight();
      finishWif();
      stage = 'FIREBASE_AUTH';
      const finishAuth = timing.start('auth');
      const authenticated = await authenticator.authenticate(request, { environment, googleCredentials });
      finishAuth();
      stage = 'FIRESTORE_CONSTRUCTION';
      const finishClient = timing.start('client');
      session = await firestoreFactory(environment, googleCredentials);
      finishClient();
      const db = session.db;
      const timestamp = () => Timestamp.now();
      const ledger = new CoinLedgerService({ db, timestamp });
      const service = rewardServiceFactory({ ledger, timestamp });
      stage = 'DAILY_LOGIN_TRANSACTION';
      const finishClaim = timing.start('claim');
      const result = await service.claim({
        principal: { authenticated: true, uid: authenticated.uid },
        request: request.body,
      });
      finishClaim();
      timing.apply(response);
      return response.status(200).json(result);
    } catch (error) {
      logger?.error?.('daily-login-runtime-failure', { stage, category: dailyLoginFailureCategory(error) });
      const sanitized = publicError(error);
      timing.apply(response, { include: ['total'] });
      return response.status(sanitized.status).json(sanitized.body);
    } finally {
      await session?.close();
    }
  };
}
