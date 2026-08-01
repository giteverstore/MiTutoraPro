import { userDataService } from '../user-data/UserDataService';

export const progressRepository = {
  async load(userId, courseId) {
    const stored = await userDataService.loadProgress(userId, courseId);
    if (!stored) return null;
    return {
      ...stored,
      quizScores: stored.quizScores ?? stored.completedQuizzes ?? {},
      exerciseCompletion: stored.exerciseCompletion ?? stored.completedExercises ?? {},
      courseProgress: stored.courseProgress ?? stored.completion ?? 0,
    };
  },
  save(userId, courseId, progress) {
    return userDataService.saveProgress(userId, courseId, progress);
  },
  clear(userId, courseId) {
    return userDataService.clearProgress(userId, courseId);
  },
};
