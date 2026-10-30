import { AIServiceError } from '../AIServiceError.js';
import { CompositeTutorContentSource } from './CompositeTutorContentSource.js';

const SURFACES = new Set(['course', 'practice', 'project']);

function id(value, label) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > 160 || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(result)) throw invalid(label);
  return result;
}
function invalid(label = 'activity') { return new AIServiceError('ai/activity-invalid', `The requested ${label} is unavailable.`, { status: 400 }); }
function requestedVersion(value) {
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || value < 1) throw new AIServiceError('ai/content-version-invalid', 'The requested learning content version is unavailable.', { status: 409 });
  return value;
}
function lessons(course) { return (course.modules ?? []).flatMap((module) => module.sections?.flatMap((section) => section.lessons ?? []) ?? module.lessons ?? []); }
function compactCourse(course, lesson) { return { courseTitle: course.title, lessonTitle: lesson.title, lessonSummary: lesson.summary ?? '' }; }
function compactPractice(question) { return { questionTitle: question.title, questionSummary: question.summary ?? '', topic: question.topic ?? '', difficulty: question.difficulty }; }
function compactProject(project, checkpoint, task) { return { projectTitle: project.title, projectDescription: project.description ?? '', checkpointTitle: checkpoint.title, checkpointObjective: checkpoint.summary ?? '', task: task ? { title: task.title, objective: task.objective, expectedBehavior: task.expectedBehavior ?? [] } : null }; }

export function createTutorScopeResolver({ contentSource = new CompositeTutorContentSource() } = {}) {
  return async function resolveTutorScope({ body, signal, environment, credentials }) {
    const hint = body?.tutorScope ?? body?.context?.tutorScope;
    const surface = typeof hint?.surface === 'string' ? hint.surface.trim().toLowerCase() : '';
    if (!SURFACES.has(surface)) throw invalid();
    const scopeHint = id(hint.scopeId, surface);
    const activityHint = id(hint.activityId, 'activity');
    const version = requestedVersion(hint.contentVersion);
    const document = await contentSource.get({ surface, contentId: scopeHint, contentVersion: version, signal, environment, credentials });
    const adminDocument = document?.contentSource === 'admin' || document?.contentSource == null;
    const validVersion = adminDocument ? Number.isSafeInteger(document?.version) && document.version >= 1 : /^v[1-9]\d*$/u.test(document?.version);
    if (document?.contentId !== scopeHint || !validVersion || (version != null && document.version !== version)) {
      throw new AIServiceError(version == null ? 'ai/content-unavailable' : 'ai/content-version-invalid', 'The requested learning content is unavailable.', { status: version == null ? 503 : 409 });
    }
    const content = document.content;

    if (surface === 'course') {
      if (content?.courseId !== document.contentId) throw invalid('course');
      const lesson = lessons(content).find((entry) => entry.id === activityHint);
      if (!lesson) throw invalid('lesson');
      return Object.freeze({ surface, scopeId: document.contentId, activityId: lesson.id, contentSource: document.contentSource ?? 'admin', contentVersion: document.version, courseId: content.courseId, lessonId: lesson.id, canonicalContext: compactCourse(content, lesson) });
    }
    if (surface === 'practice') {
      if (content?.questionId !== document.contentId || content.questionId !== activityHint) throw invalid('practice question');
      return Object.freeze({ surface, scopeId: document.contentId, activityId: content.questionId, contentSource: document.contentSource ?? 'admin', contentVersion: document.version, practiceQuestionId: content.questionId, canonicalContext: compactPractice(content) });
    }
    if (content?.projectId !== document.contentId) throw invalid('project');
    const checkpointId = id(hint.checkpointId ?? activityHint, 'checkpoint');
    const checkpoint = (content.checkpoints ?? []).find((entry) => entry.checkpointId === checkpointId);
    if (!checkpoint) throw invalid('checkpoint');
    const taskId = hint.taskId == null ? null : id(hint.taskId, 'task');
    const task = taskId ? (checkpoint.tasks ?? []).find((entry) => entry.taskId === taskId) : null;
    if (taskId && !task) throw invalid('task');
    const canonicalActivityId = task?.taskId ?? checkpoint.checkpointId;
    if (activityHint !== canonicalActivityId) throw invalid('activity');
    return Object.freeze({ surface, scopeId: document.contentId, activityId: canonicalActivityId, contentSource: document.contentSource ?? 'admin', contentVersion: document.version, projectId: content.projectId, checkpointId: checkpoint.checkpointId, ...(task ? { taskId: task.taskId } : {}), canonicalContext: compactProject(content, checkpoint, task) });
  };
}
