import { ChallengeService } from '../content/services/ChallengeService';
import { CONTENT_ERROR_CODES, ContentError } from '../content/utils/ContentError';
import { dailyChallenge as localDailyChallenge } from './challengeData';

const LOCAL_FALLBACK_ENABLED = import.meta.env.DEV
  && import.meta.env.VITE_ENABLE_LOCAL_CHALLENGE_FALLBACK !== 'false';
const challengeService = new ChallengeService();

export async function loadDailyChallenge() {
  try {
    const metadata = await challengeService.listMetadata({
      query: {
        filters: [{ field: 'published', value: true }],
      },
    });
    if (!metadata.length) {
      throw new ContentError(CONTENT_ERROR_CODES.metadataMissing, 'Today’s challenge is not available yet.');
    }
    const latest = [...metadata].sort((left, right) => right.date.localeCompare(left.date))[0];
    return (await challengeService.getChallengeFromMetadata(latest)).content;
  } catch (error) {
    if (!LOCAL_FALLBACK_ENABLED) throw error;
    console.warn('[Challenges] Firebase content unavailable; using the development-only local fallback.', error);
    return localDailyChallenge;
  }
}
