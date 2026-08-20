import { PracticeService } from '../content/services/PracticeService';
import { practiceQuestions as localPracticeQuestions } from './practiceData';
import {
  PRACTICE_CONTENT_SOURCES,
  resolvePracticeContentSource,
} from './practiceContentSourceConfig';

const LOCAL_FALLBACK_ENABLED = import.meta.env.DEV
  && import.meta.env.VITE_ENABLE_LOCAL_PRACTICE_FALLBACK !== 'false';
const PRACTICE_CONTENT_SOURCE = resolvePracticeContentSource({
  isDevelopment: import.meta.env.DEV,
  configuredSource: import.meta.env.VITE_PRACTICE_CONTENT_SOURCE,
});
const practiceService = new PracticeService();

export async function loadPracticeQuestions() {
  if (PRACTICE_CONTENT_SOURCE === PRACTICE_CONTENT_SOURCES.LOCAL) {
    return localPracticeQuestions;
  }

  try {
    const metadata = await practiceService.listMetadata({
      query: {
        filters: [{ field: 'published', value: true }],
      },
    });
    const orderedMetadata = [...metadata].sort((left, right) => left.storagePath.localeCompare(right.storagePath));
    const questions = await Promise.all(orderedMetadata.map((item) => practiceService.getQuestionFromMetadata(item)));
    return questions.map(({ content }) => content);
  } catch (error) {
    if (!LOCAL_FALLBACK_ENABLED) throw error;
    console.warn('[Practice] Firebase content unavailable; using the development-only local fallback.', error);
    return localPracticeQuestions;
  }
}
