export const COURSE_COMPLETION_SCHEMA_VERSION = '2.0.0';
const TRUSTED_EVIDENCE_ASSURANCE = new Set(['PROTOCOL_OBSERVED', 'SERVER_GRADED', 'SERVER_VALIDATED_CLIENT_EXECUTION']);

const moduleLessons = (module) => Array.isArray(module.sections)
  ? module.sections.flatMap((section) => section.lessons ?? [])
  : module.lessons ?? [];

export class CourseCompletionEngine {
  requirements(manifest) {
    if (!manifest?.id || !Array.isArray(manifest.modules)) throw new TypeError('A valid published course manifest is required.');
    const lessons = manifest.modules.flatMap((module) => moduleLessons(module).map((lesson) => ({
      id: lesson.id,
      moduleId: module.id,
      required: lesson.required !== false,
    })));
    if (!lessons.length || lessons.some(({ id }) => !id)) throw new TypeError('The course manifest must define lesson IDs.');
    return Object.freeze({
      courseId: manifest.id,
      courseProgressVersion: manifest.metadata?.version ?? manifest.schemaVersion,
      requiredLessonIds: Object.freeze(lessons.filter(({ required }) => required).map(({ id }) => id)),
      lessonIds: Object.freeze(lessons.map(({ id }) => id)),
      moduleCount: manifest.modules.length,
    });
  }

  evaluate(manifest, completion = {}) {
    const requirements = this.requirements(manifest);
    const completed = new Set((completion.completedLessons ?? []).filter((id) => {
      const evidence = completion.lessonEvidence?.[id];
      return completion.schemaVersion === '2.0.0'
        && requirements.lessonIds.includes(id)
        && evidence?.sessionId
        && TRUSTED_EVIDENCE_ASSURANCE.has(evidence.assurance);
    }));
    const completedRequired = requirements.requiredLessonIds.filter((id) => completed.has(id));
    const requiredLessons = requirements.requiredLessonIds.length;
    const completionPercentage = requiredLessons ? Math.floor((completedRequired.length / requiredLessons) * 100) : 0;
    return Object.freeze({
      schemaVersion: COURSE_COMPLETION_SCHEMA_VERSION,
      courseId: requirements.courseId,
      courseProgressVersion: requirements.courseProgressVersion,
      eligibilityStatus: completedRequired.length === requiredLessons ? 'ELIGIBLE' : 'LOCKED',
      completionPercentage,
      requiredLessons,
      completedLessons: completedRequired.length,
      requiredLessonIds: requirements.requiredLessonIds,
    });
  }
}
