import { ChallengeService } from '../content/services/ChallengeService';
import { CONTENT_ERROR_CODES, ContentError } from '../content/utils/ContentError';
import { dailyChallenge as localDailyChallenge } from './challengeData';
import { kolkataDate } from '../home/challengeCalendar';

const LOCAL_FALLBACK_ENABLED = import.meta.env.DEV
  && import.meta.env.VITE_ENABLE_LOCAL_CHALLENGE_FALLBACK !== 'false';
const challengeService = new ChallengeService();

export function selectLatestPublishedChallenge(metadata) {
  if (!Array.isArray(metadata) || metadata.length === 0) return null;
  return [...metadata].sort((left, right) => right.date.localeCompare(left.date))[0] ?? null;
}

export function loadChallengeCalendarMetadata() {
  return challengeService.listMetadata({ query: { filters: [{ field: 'published', value: true }] } });
}

export async function loadDailyChallengeByDate(date) {
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new ContentError(CONTENT_ERROR_CODES.metadataMissing, 'This challenge date is invalid.');
  }
  if (date > kolkataDate()) {
    throw new ContentError(CONTENT_ERROR_CODES.metadataMissing, 'This daily challenge is unavailable.');
  }
  try {
    const metadata = await loadChallengeCalendarMetadata();
    const match = metadata.find((item) => item.date === date);
    if (!match) throw new ContentError(CONTENT_ERROR_CODES.metadataMissing, 'This daily challenge is unavailable.');
    return { ...(await challengeService.getChallengeFromMetadata(match)).content, activityId: match.id, version: match.version };
  } catch (error) {
    if (LOCAL_FALLBACK_ENABLED && localDailyChallenge.date === date) return localDailyChallenge;
    throw error;
  }
}

export async function loadPublishedChallengeCatalog(throughDate = kolkataDate()) {
  const metadata = await loadChallengeCalendarMetadata();
  return Promise.all(metadata.filter((item) => item.date <= throughDate).map(async (item) => ({
    metadata: item,
    content: (await challengeService.getChallengeFromMetadata(item)).content,
  })));
}

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
    const latest = selectLatestPublishedChallenge(metadata);
    return { ...(await challengeService.getChallengeFromMetadata(latest)).content, version: latest.version };
  } catch (error) {
    if (!LOCAL_FALLBACK_ENABLED) throw error;
    console.warn('[Challenges] Firebase content unavailable; using the development-only local fallback.', error);
    return localDailyChallenge;
  }
}
