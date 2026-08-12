export const SCORING_VERSION = '1.0.0';

export class ExamScoringEngine {
  evaluate(definition, answers = {}) {
    if (!definition?.questions?.length) throw new Error('A trusted exam definition is required for scoring.');
    let correctAnswers = 0;
    let unanswered = 0;
    definition.questions.forEach((question) => {
      const selected = answers[question.id];
      if (!selected) unanswered += 1;
      else if (selected === question.correctOptionId) correctAnswers += 1;
    });
    const totalQuestions = definition.questions.length;
    const incorrectAnswers = totalQuestions - correctAnswers - unanswered;
    const score = Math.round((correctAnswers / totalQuestions) * 100);
    return Object.freeze({
      schemaVersion: '1.0.0',
      scoringVersion: SCORING_VERSION,
      score,
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      unanswered,
      passingScore: definition.passingScore,
      passed: score >= definition.passingScore,
    });
  }
}
