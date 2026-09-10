import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { CoinError } from '../../functions/src/coins/CoinError.js';
import { CoinLedgerService } from '../../functions/src/coins/CoinLedgerService.js';
import { FirestoreMvpActivityMetadataSource } from '../../functions/src/coins/FirestoreMvpActivityMetadataSource.js';
import { MvpCanonicalActivityResolver } from '../../functions/src/coins/MvpCanonicalActivityResolver.js';
import { MvpActivityRewardClaimService } from '../../functions/src/coins/MvpActivityRewardClaimService.js';
import { MvpActivityCompletionService } from '../../functions/src/coins/MvpActivityCompletionService.js';
import { firebaseAITutorAuthenticator } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import { createVercelGoogleCredentialContext } from '../auth/VercelGoogleCredentialAdapter.js';
import { createRequestFirebaseApp } from '../firebaseAdminApp.js';

const statusFor = (code) => ({
  'coin/unauthenticated': 401,
  'coin/activity-rate-limited': 429,
  'coin/activity-limit-reached': 429,
}[code] ?? 400);

export function publicActivityError(error) {
  if (error instanceof CoinError) return { status: statusFor(error.code), body: { error: { code: error.code, message: error.message } } };
  if (['ai/auth-required', 'ai/auth-invalid'].includes(error?.code)) {
    return { status: 401, body: { error: { code: 'coin/unauthenticated', message: 'Sign in to save this completion.' } } };
  }
  return { status: 503, body: { error: { code: 'coin/service-unavailable', message: 'Activity completion could not be recorded.' } } };
}

export function createActivityCompletionHandler({ environment = process.env, authenticator = firebaseAITutorAuthenticator, credentialFactory = createVercelGoogleCredentialContext } = {}) {
  return async function activityCompletionHandler(request, response) {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ error: { code: 'coin/method-not-allowed', message: 'Use POST for activity completion.' } });
    }
    let session;
    try {
      const googleCredentials = credentialFactory({ request, environment });
      await googleCredentials.preflight();
      const authenticated = await authenticator.authenticate(request, { environment, googleCredentials });
      session = await createRequestFirebaseApp(environment, { firebaseCredential: googleCredentials.firebaseCredential });
      const db = getFirestore(session.app);
      const source = new FirestoreMvpActivityMetadataSource({ db });
      const resolver = new MvpCanonicalActivityResolver({
        loadPracticeMetadata: source.loadPracticeMetadata.bind(source),
        loadDailyChallengeMetadata: source.loadDailyChallengeMetadata.bind(source),
      });
      const timestamp = () => Timestamp.now();
      const ledger = new CoinLedgerService({ db, timestamp });
      const rewardService = new MvpActivityRewardClaimService({ ledger, resolver, timestamp });
      const service = new MvpActivityCompletionService({ db, resolver, rewardService, timestamp });
      return response.status(200).json(await service.complete({ principal: { authenticated: true, uid: authenticated.uid }, request: request.body }));
    } catch (error) {
      const sanitized = publicActivityError(error);
      return response.status(sanitized.status).json(sanitized.body);
    } finally {
      await session?.close();
    }
  };
}
