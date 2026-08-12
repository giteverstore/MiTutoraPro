import { callFirebaseFunction } from '../firebase/functions';

export class TrustedCompletionService {
  recordLessonCompletion(courseId, lessonId, completionType) {
    return callFirebaseFunction('recordTrustedLessonCompletion', { courseId, lessonId, completionType });
  }
}

export const trustedCompletionService = new TrustedCompletionService();
