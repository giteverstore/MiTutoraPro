import { CONTENT_SCHEMA_VERSION, CONTENT_TYPES, validateContent } from '../../../../../shared/content/index.js';

const slug = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `course-${Date.now()}`;
export const courseUid = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
export const reindexCourse = (items) => items.map((item, index) => ({ ...item, order: index + 1 }));
export const courseLessons = (module) => module.sections?.flatMap((section) => section.lessons) ?? module.lessons ?? [];
export const countCourseLessons = (course) => course.modules.reduce((total, module) => total + courseLessons(module).length, 0);

export function newCourseLesson(order = 1) {
  return { id: courseUid('lesson'), order, number: String(order), title: 'Untitled lesson', summary: '', status: 'available', estimatedMinutes: 5, tags: [], blocks: [{ id: courseUid('paragraph'), type: 'paragraph', content: 'Write the lesson introduction.', format: 'plain' }] };
}
export function newCourseModule(order = 1) {
  return { id: courseUid('module'), order, title: `Module ${order}`, description: '', initiallyExpanded: order === 1, lessons: [newCourseLesson(1)] };
}
export function createCourseDraft(id) {
  const courseId = slug(id);
  const first = newCourseModule(1);
  return { documentId: courseId, contentId: courseId, contentType: CONTENT_TYPES.COURSE, schemaVersion: CONTENT_SCHEMA_VERSION, version: 1, status: 'draft', locale: 'en', metadata: { editor: 'course-studio-v1' }, content: { courseId, slug: courseId, title: 'Untitled Course', subtitle: '', description: 'Describe what learners will build and understand.', language: 'python', difficulty: 'Beginner', estimatedMinutes: 30, prerequisites: [], learningOutcomes: ['Complete the course learning goal.'], tags: [], defaultLessonId: first.lessons[0].id, comingSoon: false, modules: [first] } };
}
export const validateCourseDraft = (draft) => { const { documentId, draftRevision, lifecycleState, validationSummary, ...canonical } = draft; return validateContent(canonical); };

export function adaptLegacyCourse(course) {
  let lessonOrder = 0;
  const modules = (course.modules ?? []).map((module, moduleIndex) => ({ ...module, order: moduleIndex + 1,
    ...(module.sections ? { sections: module.sections.map((section, sectionIndex) => ({ ...section, order: sectionIndex + 1, lessons: (section.lessons ?? []).map((lesson) => ({ ...lesson, order: ++lessonOrder })) })) }
      : { lessons: (module.lessons ?? []).map((lesson) => ({ ...lesson, order: ++lessonOrder })) }),
  }));
  return {
    ...createCourseDraft(course.id ?? course.slug), content: { courseId: course.id, slug: course.slug ?? course.id, title: course.title, subtitle: '', description: course.description, language: course.metadata?.tags?.[0] ?? course.slug ?? 'python', difficulty: course.metadata?.level ?? 'beginner', estimatedMinutes: course.metadata?.estimatedMinutes ?? 1, prerequisites: [], learningOutcomes: ['Complete the published course.'], tags: course.metadata?.tags ?? [], defaultLessonId: course.navigation?.defaultLessonId, comingSoon: course.status === 'coming-soon', modules },
  };
}
