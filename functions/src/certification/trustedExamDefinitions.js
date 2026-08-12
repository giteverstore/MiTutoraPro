const pythonQuestions = [
  ['q1', 'Which keyword defines a function in Python?', [['a', 'func'], ['b', 'def'], ['c', 'function'], ['d', 'lambda']], 'b'],
  ['q2', 'Which value is a Python Boolean?', [['a', 'true'], ['b', 'TRUE'], ['c', 'True'], ['d', 'boolean']], 'c'],
  ['q3', 'Which collection stores key-value pairs?', [['a', 'List'], ['b', 'Tuple'], ['c', 'Set'], ['d', 'Dictionary']], 'd'],
  ['q4', 'What does len([1, 2, 3]) return?', [['a', '2'], ['b', '3'], ['c', '4'], ['d', 'An error']], 'b'],
  ['q5', 'Which operator performs exponentiation?', [['a', '^'], ['b', '*'], ['c', '**'], ['d', '//']], 'c'],
  ['q6', 'Which statement skips to the next loop iteration?', [['a', 'break'], ['b', 'continue'], ['c', 'pass'], ['d', 'return']], 'b'],
  ['q7', 'What is the result of 7 // 2?', [['a', '3'], ['b', '3.5'], ['c', '4'], ['d', '1']], 'a'],
  ['q8', 'Which type is immutable?', [['a', 'List'], ['b', 'Dictionary'], ['c', 'Set'], ['d', 'Tuple']], 'd'],
  ['q9', 'Which function converts text to an integer?', [['a', 'str()'], ['b', 'float()'], ['c', 'int()'], ['d', 'number()']], 'c'],
  ['q10', 'What begins a single-line comment in Python?', [['a', '//'], ['b', '#'], ['c', '--'], ['d', '/*']], 'b'],
];

const pythonDefinition = Object.freeze({
  id: 'python-foundations-certification',
  courseId: 'python',
  title: 'Python Foundations Certification',
  description: 'A certification assessment covering core Python concepts.',
  version: '1.0.0',
  durationMs: 15 * 60 * 1000,
  passingScore: 70,
  integrityPolicyId: 'standard-v1',
  questions: Object.freeze(pythonQuestions.map(([id, prompt, options, correctOptionId]) => Object.freeze({ id, prompt, options: Object.freeze(options.map(([optionId, label]) => Object.freeze({ id: optionId, label }))), correctOptionId }))),
});

const definitions = new Map([[pythonDefinition.id, pythonDefinition]]);

export function getTrustedExamDefinition(examId) {
  const definition = definitions.get(examId);
  if (!definition) throw new Error(`Trusted exam definition not found: ${examId}`);
  return definition;
}

export function candidateExam(definition) {
  return Object.freeze({
    schemaVersion: '1.0.0', id: definition.id, courseId: definition.courseId,
    title: definition.title, description: definition.description, version: definition.version,
    durationMs: definition.durationMs, passingScore: definition.passingScore,
    questions: Object.freeze(definition.questions.map(({ correctOptionId: _answer, ...question }) => question)),
  });
}
