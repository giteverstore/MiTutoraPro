import { ChallengeService } from '../content/services/ChallengeService';
import { CONTENT_ERROR_CODES, ContentError } from '../content/utils/ContentError';
import { dailyChallenge as localDailyChallenge } from './challengeData';
import { kolkataDate } from '../home/challengeCalendar';

const LOCAL_FALLBACK_ENABLED = import.meta.env.DEV
  && import.meta.env.VITE_ENABLE_LOCAL_CHALLENGE_FALLBACK !== 'false';
const challengeService = new ChallengeService();

const DEFAULT_TITLE = 'Daily Coding Challenge';
const DEFAULT_SUMMARY = 'Practice your coding skills with this daily challenge.';
const DEFAULT_ESTIMATED_MINUTES = 15;

export function createChallengeSummary(metadata) {
  return Object.freeze({
    id: metadata.practiceQuestionId || metadata.id,
    title: metadata.title || DEFAULT_TITLE,
    summary: metadata.summary || DEFAULT_SUMMARY,
    language: metadata.language || '',
    difficulty: metadata.difficulty,
    topic: metadata.topic || '',
    category: metadata.category || '',
    estimatedMinutes: metadata.estimatedMinutes ?? DEFAULT_ESTIMATED_MINUTES,
    date: metadata.date,
    version: metadata.version,
    reward: Object.freeze({ coins: metadata.rewardCoins, streakIncrement: 1 }),
  });
}

export function selectLatestPublishedChallenge(metadata) {
  if (!Array.isArray(metadata) || metadata.length === 0) return null;
  return [...metadata].sort((left, right) => right.date.localeCompare(left.date))[0] ?? null;
}

export function loadChallengeCalendarMetadata() {
  return challengeService.listMetadata({ query: { filters: [{ field: 'published', value: true }] } });
}

export function createChallengeContentSource({ service = challengeService } = {}) {
  const listMetadata = () => service.listMetadata({ query: { filters: [{ field: 'published', value: true }] } });

  return Object.freeze({
    loadChallengeCalendarMetadata: listMetadata,
    async loadDailyChallengeByDate(date) {
      const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? new Date(`${date}T00:00:00Z`) : null;
      if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
        throw new ContentError(CONTENT_ERROR_CODES.metadataMissing, 'This challenge date is invalid.');
      }
      if (date > kolkataDate()) {
        throw new ContentError(CONTENT_ERROR_CODES.metadataMissing, 'This daily challenge is unavailable.');
      }
      const metadata = await listMetadata();
      const match = metadata.find((item) => item.date === date);
      if (!match) throw new ContentError(CONTENT_ERROR_CODES.metadataMissing, 'This daily challenge is unavailable.');
      return { ...(await service.getChallengeFromMetadata(match)).content, activityId: match.id, version: match.version };
    },
    async loadPublishedChallengeCatalog(throughDate = kolkataDate()) {
      const metadata = await listMetadata();
      return metadata
        .filter((item) => item.date <= throughDate)
        .map((item) => ({ metadata: item, content: createChallengeSummary(item) }));
    },
  });
}

const contentSource = createChallengeContentSource();

export async function loadDailyChallengeByDate(date) {
  try {
    return await contentSource.loadDailyChallengeByDate(date);
  } catch (error) {
    if (LOCAL_FALLBACK_ENABLED && localDailyChallenge.date === date) return localDailyChallenge;
    throw error;
  }
}

export async function loadPublishedChallengeCatalog(throughDate = kolkataDate()) {
  return contentSource.loadPublishedChallengeCatalog(throughDate);
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
