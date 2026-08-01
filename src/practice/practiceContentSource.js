import { PracticeService } from '../content/services/PracticeService';
import { practiceQuestions as localPracticeQuestions } from './practiceData';

const LOCAL_FALLBACK_ENABLED = import.meta.env.DEV
  && import.meta.env.VITE_ENABLE_LOCAL_PRACTICE_FALLBACK !== 'false';
const practiceService = new PracticeService();

export async function loadPracticeQuestions() {
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
