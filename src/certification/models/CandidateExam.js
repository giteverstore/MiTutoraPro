export const CANDIDATE_EXAM_SCHEMA_VERSION = '1.0.0';

export function sanitizeCandidateExam(definition) {
  if (!definition?.id || !Array.isArray(definition.questions)) throw new TypeError('CandidateExam requires id and questions.');
  return Object.freeze({
    schemaVersion: CANDIDATE_EXAM_SCHEMA_VERSION,
    id: definition.id,
    courseId: definition.courseId,
    title: definition.title,
    description: definition.description ?? '',
    version: definition.version,
    durationMs: definition.durationMs,
    passingScore: definition.passingScore,
    questions: Object.freeze(definition.questions.map(({ correctOptionId: _answer, ...question }) => Object.freeze({
      ...question,
      options: Object.freeze(question.options.map((option) => Object.freeze({ ...option }))),
    }))),
  });
}
