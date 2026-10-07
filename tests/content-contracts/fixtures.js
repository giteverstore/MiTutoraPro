import { CONTENT_SCHEMA_VERSION, CONTENT_TYPES } from '../../shared/content/index.js';

const languages = ['python', 'java', 'cpp'];
const block = (blockId, type, extra) => ({ blockId, type, ...extra });
const validator = (validatorId, type, configuration = {}) => ({ validatorId, type, version: 1, severity: 'error', configuration, failureMessage: `${validatorId} must pass.` });

export function createBingoContractFixture() {
  let taskNumber = 0;
  const checkpoints = Array.from({ length: 8 }, (_, checkpointIndex) => {
    const taskCount = checkpointIndex === 0 ? 3 : 2;
    const tasks = Array.from({ length: taskCount }, (_, taskIndex) => {
      taskNumber += 1;
      const prefix = `cp-${checkpointIndex + 1}-task-${taskIndex + 1}`;
      return {
        taskId: `task-${taskNumber}`, order: taskIndex + 1, title: `Task ${taskNumber}`,
        objective: `Implement the bounded behavior for task ${taskNumber}.`, why: 'Each behavior contributes to the complete project.',
        blocks: [
          block(`${prefix}-concept`, 'concept', { conceptId: `concept-${taskNumber}`, title: 'Concept', text: 'A project concept explained as plain text.' }),
          block(`${prefix}-paragraph`, 'paragraph', { text: 'Implement this task without embedding presentation choices.' }),
          block(`${prefix}-code`, 'code', { code: { variants: { python: '# example', java: '// example', cpp: '// example' }, requiredLanguages: languages } }),
          block(`${prefix}-output`, 'expected-output', { output: 'Expected output' }),
          block(`${prefix}-mistakes`, 'common-mistakes', { items: ['Avoid duplicating state.', 'Keep indexes in range.'] }),
        ],
        implementationContractIds: taskNumber === 1 ? ['free-index'] : taskNumber === 2 ? ['win-lines'] : ['mark'],
        expectedBehavior: ['The behavior is deterministic.'],
        validators: [validator(`${prefix}-validator`, 'output_contains', { values: ['Expected output'] })],
        mentor: { conceptsIntroduced: [`concept-${taskNumber}`], hints: [{ hintId: `${prefix}-hint`, level: 'hint', text: 'Start from the contract.' }, { hintId: `${prefix}-reference`, level: 'reference', text: 'A fuller reference is available after explicit escalation.', requiresExplicitReveal: true }], revealPolicy: { referenceAllowed: true } },
      };
    });
    return {
      checkpointId: `checkpoint-${checkpointIndex + 1}`, order: checkpointIndex + 1, title: `Checkpoint ${checkpointIndex + 1}`,
      summary: `Checkpoint ${checkpointIndex + 1} learning goal.`, blocks: [block(`cp-${checkpointIndex + 1}-intro`, 'heading', { level: 2, text: `Checkpoint ${checkpointIndex + 1}` })], tasks,
      validators: [validator(`checkpoint-${checkpointIndex + 1}-validator`, 'execution_succeeds')],
      completionBlocks: [block(`cp-${checkpointIndex + 1}-complete`, 'paragraph', { text: 'Checkpoint complete.' })],
    };
  });
  return {
    contentId: 'schema-bingo-stress-test', contentType: CONTENT_TYPES.PROJECT, schemaVersion: CONTENT_SCHEMA_VERSION, version: 1, status: 'draft', locale: 'en', metadata: { fixture: true },
    content: {
      projectId: 'schema-bingo-stress-test', title: 'Schema stress test', description: 'A non-production fixture proving the contract can model a large multilingual project.', difficulty: 'Intermediate', estimatedMinutes: 600, category: 'Schema fixture', tags: ['fixture'], prerequisites: ['Programming fundamentals'], learningOutcomes: ['Build a complete structured program.'], supportedLanguages: languages,
      starterWorkspaces: Object.fromEntries(languages.map((language) => [language, { entrypoint: language === 'java' ? 'Main.java' : `main.${language === 'python' ? 'py' : 'cpp'}`, runtimeId: language, files: [{ path: language === 'java' ? 'Main.java' : `main.${language === 'python' ? 'py' : 'cpp'}`, content: language === 'python' ? '# starter' : '// starter' }] }])),
      projectFacts: ['The center card uses zero-based index 12.', 'Win patterns contain five indexes.'],
      implementationContracts: [
        { contractId: 'free-index', name: 'FREE_INDEX', kind: 'constant', semanticType: 'integer', purpose: 'Zero-based center card index.', requiredValue: 12, languageVariants: { python: { typeDisplay: 'int' }, java: { typeDisplay: 'int', modifiers: ['static', 'final'] }, cpp: { typeDisplay: 'int', modifiers: ['constexpr'] } } },
        { contractId: 'win-lines', name: 'WIN_LINES', kind: 'collection', semanticType: 'collection<collection<integer>>', purpose: 'Legal win patterns.', elementType: 'collection<integer>', shape: [12, 5] },
        { contractId: 'mark', name: 'mark', kind: 'method', semanticType: 'callable', purpose: 'Mark a matching cell.', parameters: [{ parameterId: 'number', name: 'number', semanticType: 'integer' }], returns: { semanticType: 'boolean', description: 'Whether a new mark occurred.' } },
      ], checkpoints, finalValidators: [validator('final-runtime', 'runtime_scenario', { stdin: '1\n', outputIncludes: ['Expected output'] })],
      completionBlocks: [block('completion-summary', 'paragraph', { text: 'You built a complete project.' }), block('completion-skills', 'list', { items: ['State modeling', 'Validation'] }), block('completion-extensions', 'callout', { variant: 'tip', title: 'Extension ideas', text: 'Add another presentation without changing the core model.' })],
    },
  };
}

export function createTaskProgressionFixture({ version = 1 } = {}) {
  const languages = ['python', 'javascript'];
  const text = (python, javascript) => ({ variants: { python, javascript }, requiredLanguages: languages });
  const makeTask = (taskId, order, title, pattern, output) => ({
    taskId, order, title, objective: `Implement ${title.toLowerCase()}.`, why: 'This small behavior contributes to the cumulative program.',
    blocks: [block(`${taskId}-guide`, 'paragraph', { text: `Implement ${title.toLowerCase()} using the selected language.` }), block(`${taskId}-code`, 'code', { code: text(`# ${title}`, `// ${title}`) })],
    expectedBehavior: [output], implementationContractIds: [],
    validators: [
      validator(`${taskId}-source`, 'source_pattern', { patternsByLanguage: { python: [pattern.python], javascript: [pattern.javascript] } }),
      ...(taskId === 'greeting' ? [validator(`${taskId}-execution`, 'execution_succeeds')] : []),
      validator(`${taskId}-output`, 'output_contains', { values: [output] }),
    ],
  });
  const checkpoints = [
    { checkpointId: 'foundation', order: 1, title: 'Foundation', summary: 'Build a greeting and reusable transform.', blocks: [], tasks: [makeTask('greeting', 1, 'Greeting', { python: 'Hello, Project', javascript: 'Hello, Project' }, 'Hello, Project'), makeTask('transform', 2, 'Transform function', { python: 'def\\s+transform', javascript: 'function\\s+transform' }, 'READY')], validators: [validator('foundation-output', 'output_contains', { values: ['Hello, Project', 'READY'] })], completionBlocks: [] },
    { checkpointId: 'interaction', order: 2, title: 'Interaction', summary: 'Accept and transform deterministic input.', blocks: [], tasks: [makeTask('input', 1, 'Input handling', { python: 'input\\s*\\(', javascript: 'process\\.argv' }, 'VALUE'), makeTask('result', 2, 'Final result', { python: 'upper\\s*\\(', javascript: 'toUpperCase\\s*\\(' }, 'VALUE')], validators: [validator('interaction-output', 'output_contains', { values: ['VALUE'] })], completionBlocks: [] },
  ];
  return { contentId: 'phase-7-task-progression-fixture', contentType: CONTENT_TYPES.PROJECT, schemaVersion: CONTENT_SCHEMA_VERSION, version, status: 'draft', locale: 'en', metadata: { fixture: true, testOnly: true }, content: { projectId: 'phase-7-task-progression-fixture', title: 'Task Progression Acceptance Fixture', description: 'Deterministic synthetic Project used only by acceptance tests.', difficulty: 'Beginner', estimatedMinutes: 15, category: 'Test fixture', tags: ['test-only'], prerequisites: [], learningOutcomes: ['Complete ordered tasks and cumulative validation.'], supportedLanguages: languages, starterWorkspaces: { python: { entrypoint: 'main.py', runtimeId: 'python', files: [{ path: 'main.py', content: 'print("start")\n' }] }, javascript: { entrypoint: 'index.js', runtimeId: 'javascript', files: [{ path: 'index.js', content: 'console.log("start");\n' }] } }, implementationContracts: [], checkpoints, finalValidators: [validator('final-output', 'output_contains', { values: ['Hello, Project', 'READY', 'VALUE'] })], completionBlocks: [block('done', 'paragraph', { text: 'Acceptance fixture complete.' })] } };
}

export function createMiniCourseFixture({ version = 1 } = {}) {
  const lesson = (id, order, title, blocks) => ({ id, order, number: String(order), title, summary: `${title} lesson.`, status: 'available', estimatedMinutes: 5, tags: ['fixture'], blocks });
  const paragraph = (id, content) => ({ id, type: 'paragraph', content, format: 'plain' });
  return { contentId: 'python-mini-fundamentals', contentType: CONTENT_TYPES.COURSE, schemaVersion: CONTENT_SCHEMA_VERSION, version, status: 'draft', locale: 'en', metadata: { fixture: true, testOnly: true, editor: 'course-studio-v1' }, content: {
    courseId: 'python-mini-fundamentals', slug: 'python-mini-fundamentals', title: 'Python Mini Fundamentals', description: 'A deterministic canonical Course acceptance fixture.', language: 'python', difficulty: 'Beginner', estimatedMinutes: 20, prerequisites: [], learningOutcomes: ['Print values and add two numbers.'], tags: ['fixture'], defaultLessonId: 'hello', comingSoon: false,
    modules: [
      { id: 'getting-started', order: 1, title: 'Getting started', description: 'First programs.', initiallyExpanded: true, lessons: [lesson('hello', 1, 'Hello', [paragraph('hello-problem', 'Print a greeting.'), { id: 'hello-code', type: 'code', language: 'python', code: 'print("Hello")', mode: 'runnable' }, { id: 'hello-output', type: 'expected-output', content: 'Hello' }]), lesson('quiz', 2, 'Quick quiz', [paragraph('quiz-intro', 'Check your understanding.'), { id: 'quiz-one', type: 'quiz', question: 'Which function prints output?', selectionMode: 'single', options: [{ id: 'print', text: 'print()' }, { id: 'read', text: 'read()' }], correctOptionIds: ['print'], submitLabel: 'Check answer' }])] },
      { id: 'practice', order: 2, title: 'Practice', description: 'Apply the basics.', initiallyExpanded: false, lessons: [lesson('addition', 1, 'Add values', [paragraph('addition-problem', 'Add two values.'), { id: 'addition-compiler', type: 'compiler', language: 'python', runtime: 'python', starterCode: 'print(10 + 20)', expectedOutput: '30', runLabel: 'Run', resetLabel: 'Reset' }])] },
    ],
  } };
}

export function createPracticeFixture(index = 0, { version = 1 } = {}) {
  const variants = [
    ['print-greeting', 'Print a greeting', 'Easy', 'Output', 'print("Hello")', 'Hello'],
    ['sum-values', 'Sum two values', 'Medium', 'Arithmetic', 'print(10 + 20)', '30'],
    ['transform-string', 'Transform a string', 'Medium', 'Strings', 'print("hello".upper())', 'HELLO'],
  ];
  const [questionId, title, difficulty, topic, starterCode, expectedOutput] = variants[index];
  return { contentId: questionId, contentType: CONTENT_TYPES.PRACTICE, schemaVersion: CONTENT_SCHEMA_VERSION, version, status: 'draft', locale: 'en', metadata: { fixture: true, testOnly: true, editor: 'practice-studio-v1' }, content: { questionId, title, summary: `${title} using deterministic output.`, language: 'python', difficulty, topic, category: 'Programming', subtopic: topic, questionType: 'coding', estimatedMinutes: 5, xp: 10, position: index, tags: ['fixture'], skills: [topic.toLowerCase()], prerequisites: [], blocks: [{ id: `${questionId}-problem`, type: 'paragraph', content: `${title}.`, format: 'plain' }], starterCode, stdin: '', verification: { type: 'expected-output', expectedOutput, comparison: 'normalized-lines' }, examples: [], constraints: [], hints: [], publicTests: [{ input: '', expectedOutput }] } };
}
