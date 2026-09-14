import { Timestamp } from 'firebase-admin/firestore';
import { CoinError } from '../../functions/src/coins/CoinError.js';
import { CoinRedemptionService } from '../../functions/src/coins/CoinRedemptionService.js';
import { firebaseAITutorAuthenticator } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import { createVercelGoogleCredentialContext } from '../auth/VercelGoogleCredentialAdapter.js';
import { createDefaultFirestore } from '../firestore/createDefaultFirestore.js';

const statusFor = (code) => code === 'coin/unauthenticated' ? 401 : code === 'coin/insufficient-balance' ? 409 : 400;

export function createCoinRedemptionHandler({ type, environment = process.env, authenticator = firebaseAITutorAuthenticator, credentialFactory = createVercelGoogleCredentialContext, firestoreFactory = createDefaultFirestore } = {}) {
  return async function handler(request, response) {
    if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ error: { code: 'coin/method-not-allowed', message: 'Use POST to redeem coins.' } }); }
    let session;
    try {
      const credentials = credentialFactory({ request, environment }); await credentials.preflight();
      const authenticated = await authenticator.authenticate(request, { environment, googleCredentials: credentials });
      session = await firestoreFactory(environment, credentials);
      const service = new CoinRedemptionService({ db: session.db, timestamp: Timestamp });
      const result = type === 'challenge-pass'
        ? await service.redeemChallengePass({ principal: { authenticated: true, uid: authenticated.uid }, request: request.body })
        : await service.redeemPremiumMonth({ principal: { authenticated: true, uid: authenticated.uid }, request: request.body });
      return response.status(200).json(result);
    } catch (error) {
      const safe = error instanceof CoinError
        ? { status: statusFor(error.code), body: { error: { code: error.code, message: error.message } } }
        : { status: 503, body: { error: { code: 'coin/service-unavailable', message: 'The redemption could not be completed.' } } };
      return response.status(safe.status).json(safe.body);
    } finally { await session?.close(); }
  };
}
