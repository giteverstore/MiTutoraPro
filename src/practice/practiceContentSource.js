import { PracticeService } from '../content/services/PracticeService';
import { practiceQuestions as localPracticeQuestions } from './practiceData';
import { PRACTICE_CONTENT_SOURCES } from './practiceContentSourceConfig';
import { createPracticeSourceAdapter } from './practiceContentSourceCore';

export { PRACTICE_PAGE_SIZE } from './practiceContentSourceCore';
const environment = import.meta.env ?? {};
export const PRACTICE_BANK_EMPTY = false;
const isDevelopmentRuntime = environment.DEV || environment.MODE === 'e2e';
const configuredSource = environment.VITE_PRACTICE_CONTENT_SOURCE;
// Q250 is bundled until its separately reviewed Firebase publication is activated.
// This also prevents deleted legacy Production records from becoming active again.
export const PRACTICE_RUNTIME_SOURCE = PRACTICE_CONTENT_SOURCES.LOCAL;
const implicitFallbackEnabled = isDevelopmentRuntime && !configuredSource
  && environment.VITE_ENABLE_LOCAL_PRACTICE_FALLBACK === 'true';

export function createPracticeContentSource({ source = PRACTICE_RUNTIME_SOURCE, service = new PracticeService(), localQuestions = localPracticeQuestions, fallbackEnabled = implicitFallbackEnabled } = {}) {
  return createPracticeSourceAdapter({ source, firebaseService: service, localQuestions, fallbackEnabled });
}

export const practiceContentSource = createPracticeContentSource();
export const loadPracticeQuestions = async () => (await practiceContentSource.listPage()).items;
