import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { CoinError } from '../../functions/src/coins/CoinError.js';
import { CoinLedgerService } from '../../functions/src/coins/CoinLedgerService.js';
import { DailyLoginRewardService } from '../../functions/src/coins/DailyLoginRewardService.js';
import { firebaseAITutorAuthenticator } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import { createVercelGoogleCredentialContext } from '../auth/VercelGoogleCredentialAdapter.js';
import { createRequestFirebaseApp } from '../firebaseAdminApp.js';

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

export function createDailyLoginHandler({ environment = process.env, authenticator = firebaseAITutorAuthenticator, credentialFactory = createVercelGoogleCredentialContext } = {}) {
  return async function dailyLoginHandler(request, response) {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ error: { code: 'coin/method-not-allowed', message: 'Use POST for the daily login reward.' } });
    }
    let session;
    try {
      const googleCredentials = credentialFactory({ request, environment });
      await googleCredentials.preflight();
      const authenticated = await authenticator.authenticate(request, { environment, googleCredentials });
      session = await createRequestFirebaseApp(environment, { firebaseCredential: googleCredentials.firebaseCredential });
      const db = getFirestore(session.app);
      const timestamp = () => Timestamp.now();
      const ledger = new CoinLedgerService({ db, timestamp });
      const service = new DailyLoginRewardService({ ledger, timestamp });
      return response.status(200).json(await service.claim({
        principal: { authenticated: true, uid: authenticated.uid },
        request: request.body,
      }));
    } catch (error) {
      const sanitized = publicError(error);
      return response.status(sanitized.status).json(sanitized.body);
    } finally {
      await session?.close();
    }
  };
}
