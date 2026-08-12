export const EXAM_RESULT_SCHEMA_VERSION = '1.0.0';

export function createExamResult(record) {
  const numeric = ['score', 'totalQuestions', 'correctAnswers', 'incorrectAnswers', 'unanswered', 'passingScore'];
  if (!record || numeric.some((field) => !Number.isFinite(record[field]))) {
    throw new TypeError('ExamResult requires complete numeric scoring fields.');
  }
  return Object.freeze({
    schemaVersion: EXAM_RESULT_SCHEMA_VERSION,
    scoringVersion: record.scoringVersion ?? '1.0.0',
    score: record.score,
    totalQuestions: record.totalQuestions,
    correctAnswers: record.correctAnswers,
    incorrectAnswers: record.incorrectAnswers,
    unanswered: record.unanswered,
    passingScore: record.passingScore,
    passed: Boolean(record.passed),
  });
}
