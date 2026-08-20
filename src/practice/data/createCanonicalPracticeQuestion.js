const blockId = (questionId, suffix) => `${questionId}-${suffix}`;

export function createCanonicalPracticeQuestion(spec) {
  const example = spec.publicTests[0];
  return Object.freeze({
    schemaVersion: '1.0.0',
    id: spec.id,
    title: spec.title,
    summary: spec.summary,
    language: 'Python',
    difficulty: spec.difficulty,
    topic: spec.topic,
    category: spec.category,
    subtopic: spec.subtopic,
    questionType: spec.questionType,
    estimatedMinutes: spec.estimatedMinutes,
    xp: spec.xp,
    contract: spec.contract,
    examples: [{ input: example.displayInput, output: String(example.expected), explanation: example.explanation }],
    constraints: spec.constraints,
    concepts: spec.concepts,
    skills: spec.skills,
    prerequisites: spec.prerequisites,
    commonMistakes: spec.commonMistakes,
    expectedComplexity: spec.expectedComplexity ?? { time: 'O(1)', space: 'O(1)' },
    publicTests: spec.publicTests.map(({ displayInput, explanation, ...test }) => test),
    implementations: {
      python: {
        languageId: 'python',
        signature: spec.contract.signature,
        entryPoint: spec.contract.functionName,
      },
    },
    blocks: [
      { id: blockId(spec.id, 'heading'), type: 'heading', level: 2, text: 'Problem Statement' },
      { id: blockId(spec.id, 'statement'), type: 'paragraph', content: spec.statement, format: 'markdown' },
      { id: blockId(spec.id, 'contract-heading'), type: 'heading', level: 3, text: 'Function Contract' },
      {
        id: blockId(spec.id, 'contract'), type: 'note', title: spec.contract.signature,
        content: `Input: ${spec.contract.input}\n\nOutput: ${spec.contract.output}`, format: 'plain',
      },
      { id: blockId(spec.id, 'example-heading'), type: 'heading', level: 3, text: 'Example' },
      {
        id: blockId(spec.id, 'example'), type: 'code', language: 'text',
        code: `Input\n${example.displayInput}\n\nOutput\n${String(example.expected)}`,
        caption: example.explanation,
      },
      {
        id: blockId(spec.id, 'constraints'), type: 'note', title: 'Constraints',
        content: spec.constraints.join('\n'), format: 'plain',
      },
      {
        id: blockId(spec.id, 'compiler'), type: 'compiler', language: 'python',
        starterCode: spec.starterCode, stdin: '', expectedOutput: String(example.expected),
        validator: 'normalized', runLabel: 'Run Code', resetLabel: 'Reset',
      },
    ],
  });
}
