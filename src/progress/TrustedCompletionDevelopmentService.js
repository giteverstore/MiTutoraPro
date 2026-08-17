import { certificationService } from '../certification/services/CertificationService';
import { getModuleLessons } from '../course/courseStructure.js';
import { trustedCompletionService } from './TrustedCompletionService';

function requiredLessons(course) {
  if (!course?.id || !Array.isArray(course.modules)) {
    throw new TypeError('A loaded course manifest is required.');
  }

  return course.modules.flatMap(getModuleLessons)
    .filter((lesson) => lesson.required !== false);
}

export class TrustedCompletionDevelopmentService {
  constructor({ completionService = trustedCompletionService, statusService = certificationService } = {}) {
    this.completionService = completionService;
    this.statusService = statusService;
  }

  async completeCourse(course, onProgress = () => {}) {
    const lessons = requiredLessons(course);
    if (!lessons.length) throw new Error('The course manifest has no required lessons.');

    const startedAt = performance.now();
    onProgress({ completed: 0, total: lessons.length, lesson: null });

    for (let index = 0; index < lessons.length; index += 1) {
      const lesson = lessons[index];
      try {
        await this.completionService.recordLessonCompletion(course.id, lesson.id, 'reading');
      } catch (error) {
        const failure = new Error(`Trusted completion failed for "${lesson.title ?? lesson.id}" (${lesson.id}). ${error.message}`);
        failure.code = error.code;
        failure.lessonId = lesson.id;
        failure.cause = error;
        throw failure;
      }
      onProgress({ completed: index + 1, total: lessons.length, lesson });
    }

    const certification = await this.statusService.getStatus(course.id);
    return {
      certification,
      completed: lessons.length,
      total: lessons.length,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }
}

export const trustedCompletionDevelopmentService = new TrustedCompletionDevelopmentService();
