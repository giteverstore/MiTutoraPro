import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const sourceRoot = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Usage: node scripts/import-q250-practice.mjs <extracted-learner-archive>');

const outputRoot = resolve('firebase-content/practice/python/v3');
const catalogPath = resolve('src/practice/data/q250PracticeQuestions.json');
const metadataPath = resolve('firebase-content/firestore/practiceQuestions.json');
const languages = Object.freeze([
  ['Python', 'python'], ['Java', 'java'], ['JavaScript', 'javascript'],
  ['TypeScript', 'typescript'], ['C', 'c'], ['C++', 'cpp'],
  ['C#', 'csharp'], ['PHP', 'php'], ['R', 'r'],
]);
const languageIds = languages.map(([, id]) => id);
const categoryFiles = [
  'arrays-and-hashing.md', 'two-pointers.md', 'sliding-window.md', 'stack.md',
  'binary-search.md', 'linked-list.md', 'trees.md', 'heap-priority-queue.md',
  'backtracking.md', 'tries.md', 'graphs.md', 'advanced-graphs.md',
  '1-d-dynamic-programming.md', '2-d-dynamic-programming.md', 'greedy.md',
  'intervals.md', 'math-and-geometry.md', 'bit-manipulation.md',
];

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const slug = (value) => value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jsonEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(sourceRoot, relativePath), 'utf8'));
}

function field(section, name) {
  const match = section.match(new RegExp(`^-?\\s*\\*\\*${name}\\*\\*\\s*(?:â€”|—|-)?\\s*(.+)$`, 'mi'));
  return match?.[1]?.trim();
}

function sectionBody(section, names) {
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = section.match(new RegExp(`^###\\s+(?:${escaped})\\s*$([\\s\\S]*?)(?=^###\\s+|(?![\\s\\S]))`, 'mi'));
  return match?.[1]?.trim() ?? '';
}

function parseExamples(section, id) {
  const body = sectionBody(section, ['Examples', 'Public examples']);
  const examples = [];
  const jsonBlocks = [...body.matchAll(/```json\s*([\s\S]*?)```\s*([^*#`][\s\S]*?)(?=\*\*Example|$)/gi)];
  for (const match of jsonBlocks) {
    const value = JSON.parse(match[1]);
    examples.push({ input: value.input, expected: value.expected, explanation: match[2].trim() });
  }
  if (examples.length) return examples;

  const entries = body.split(/^####\s+/m).slice(1);
  for (const entry of entries) {
    const input = entry.match(/^Input:\s*`([\s\S]*?)`\s*$/mi);
    const output = entry.match(/^Expected output:\s*`([\s\S]*?)`\s*$/mi);
    assert(input && output, `${id} has an unreadable public example.`);
    const afterOutput = entry.slice(entry.indexOf(output[0]) + output[0].length).trim();
    examples.push({ input: JSON.parse(input[1]), expected: JSON.parse(output[1]), explanation: afterOutput });
  }
  return examples;
}

function parseHints(section) {
  const body = sectionBody(section, ['Hints']);
  return [...body.matchAll(/^\d+\.\s+\*\*([^*]+)\*\*\s*(?:â€”|—|-)\s*(.+)$/gm)]
    .map(([, label, text]) => `${label.trim()}: ${text.trim()}`);
}

function parseStarters(section, id) {
  const body = sectionBody(section, ['Starter code']);
  const starters = {};
  for (const [label, languageId] of languages) {
    const escaped = label.replace(/[+#]/g, '\\$&');
    const match = body.match(new RegExp('^####\\s+' + escaped + '\\s*$\\s*```[^\\n]*\\n([\\s\\S]*?)\\n```', 'mi'));
    assert(match?.[1]?.trim(), `${id} is missing ${label} starter code.`);
    starters[languageId] = match[1];
  }
  return starters;
}

function parseContractDetails(section) {
  const body = sectionBody(section, ['Contract']);
  const details = {};
  for (const match of body.matchAll(/^-\s+\*\*([^*]+)\*\*\s*(?:â€”|—|-)\s*(.+)$/gm)) {
    details[slug(match[1])] = match[2].trim();
  }
  return details;
}

function extractEntryPoint(starter, execution) {
  if (execution?.entry) return execution.entry;
  return starter.match(/^def\s+([A-Za-z_]\w*)\s*\(/m)?.[1]
    ?? starter.match(/^class\s+([A-Za-z_]\w*)/m)?.[1]
    ?? 'Solution';
}

function complexityParts(raw) {
  const time = raw.match(/(O\([^\n.]+?\))[^.\n]*?time/i)?.[1] ?? raw.match(/time[^.\n]*?(O\([^\n.]+?\))/i)?.[1] ?? 'See complexity analysis';
  const space = raw.match(/(O\([^\n.]+?\))[^.\n]*?(?:auxiliary\s+)?space/i)?.[1] ?? raw.match(/space[^.\n]*?(O\([^\n.]+?\))/i)?.[1] ?? 'See complexity analysis';
  return { time, space };
}

function questionSections(markdown) {
  const matches = [...markdown.matchAll(/^##\s+((?:BLIND150|NC250)-\d{3})\s+(?:â€”|—|-)\s+(.+)$/gm)];
  return matches.map((match, index) => ({
    id: match[1], title: match[2].trim(),
    body: markdown.slice(match.index, matches[index + 1]?.index ?? markdown.length),
  }));
}

function createQuestion(raw, fixtureSet, execution) {
  const { id, title, body } = raw;
  const category = field(body, 'Category');
  const difficulty = field(body, 'Difficulty')?.toLowerCase();
  const topicList = field(body, 'Topics')?.split(',').map((item) => item.trim()).filter(Boolean) ?? [category];
  const statement = sectionBody(body, ['Problem', 'Problem statement']);
  const constraintsBody = sectionBody(body, ['Constraints']);
  const contractDetails = parseContractDetails(body);
  const constraints = [constraintsBody || contractDetails.constraints].filter(Boolean);
  const examples = parseExamples(body, id);
  const hints = parseHints(body);
  const complexityAnalysis = sectionBody(body, ['Expected complexity', 'Complexity']);
  const starterTemplates = parseStarters(body, id);
  const publicTests = fixtureSet.map((fixture, index) => ({
    name: fixture.id ?? `${id}-public-${index + 1}`,
    arguments: Object.values(fixture.input),
    input: fixture.input,
    expected: fixture.expected,
    validator: fixture.validator,
  }));
  assert(category && ['easy', 'medium', 'hard'].includes(difficulty), `${id} has invalid catalog metadata.`);
  assert(statement && constraints.length && complexityAnalysis, `${id} is missing required learner content.`);
  assert(examples.length === 3 && fixtureSet.length === 3 && hints.length === 3, `${id} must have exactly three examples, fixtures, and hints.`);
  examples.forEach((example, index) => {
    assert(jsonEqual(example.input, fixtureSet[index].input), `${id} example ${index + 1} input differs from its fixture.`);
    assert(jsonEqual(example.expected, fixtureSet[index].expected), `${id} example ${index + 1} output differs from its fixture.`);
  });

  const entryPoint = extractEntryPoint(starterTemplates.python, execution);
  const signature = starterTemplates.python.match(/^(?:def\s+[^:]+|class\s+[^:]+):?/m)?.[0] ?? entryPoint;
  const expectedOutput = JSON.stringify(examples[0].expected);
  const blocks = [
    { id: `${id.toLowerCase()}-heading`, type: 'heading', level: 2, text: 'Problem Statement' },
    { id: `${id.toLowerCase()}-statement`, type: 'paragraph', content: statement, format: 'markdown' },
    { id: `${id.toLowerCase()}-contract`, type: 'note', title: signature, content: `Input: ${contractDetails.input ?? 'See public examples.'}\n\nOutput: ${contractDetails.result ?? contractDetails.output ?? 'See public examples.'}`, format: 'plain' },
    { id: `${id.toLowerCase()}-constraints`, type: 'note', title: 'Constraints', content: constraints.join('\n'), format: 'plain' },
    ...languageIds.map((language) => ({ id: `${id.toLowerCase()}-compiler-${language}`, type: 'compiler', language, starterCode: starterTemplates[language], stdin: '', expectedOutput, validator: 'normalized', runLabel: 'Run Code', resetLabel: 'Reset' })),
  ];
  return {
    schemaVersion: '1.0.0', id, title,
    summary: statement.split(/(?<=[.!?])\s+/)[0],
    language: 'Python', difficulty, topic: category, category: 'dsa', subtopic: slug(category),
    questionType: 'implementation', estimatedMinutes: difficulty === 'easy' ? 20 : difficulty === 'medium' ? 35 : 50,
    xp: difficulty === 'easy' ? 30 : difficulty === 'medium' ? 50 : 80,
    contract: { functionName: entryPoint, signature, input: contractDetails.input ?? 'Structured arguments; see public examples.', output: contractDetails.result ?? contractDetails.output ?? 'Structured result; see public examples.' },
    contractDetails, statement, examples: examples.map(({ input, expected, explanation }) => ({ input: JSON.stringify(input), output: JSON.stringify(expected), explanation })),
    constraints, hints, concepts: topicList.map(slug), skills: topicList, prerequisites: [],
    expectedComplexity: complexityParts(complexityAnalysis), complexityAnalysis,
    publicTests, starterTemplates, ...(execution ? { executionMetadata: execution } : {}), blocks,
  };
}

const fixtures = { ...(await readJson('NeetCode-250/public-fixtures.json')), ...(await readJson('NeetCode-250-Continuation/public-fixtures.json')) };
const executionContracts = { ...(await readJson('NeetCode-250/mode-b-contracts.json')), ...(await readJson('NeetCode-250-Continuation/execution-contracts.json')) };
const roots = ['Blind-150', 'NeetCode-250', 'NeetCode-250-Continuation'];
const markdownFiles = [];
for (const root of roots) {
  const available = new Set(await readdir(join(sourceRoot, root)));
  for (const file of categoryFiles) if (available.has(file)) markdownFiles.push(join(root, file));
}
const rawQuestions = [];
for (const file of markdownFiles) rawQuestions.push(...questionSections(await readFile(join(sourceRoot, file), 'utf8')));
rawQuestions.sort((left, right) => Number(left.id.slice(-3)) - Number(right.id.slice(-3)));
assert(rawQuestions.length === 250, `Expected 250 question sections; found ${rawQuestions.length}.`);
assert(new Set(rawQuestions.map(({ id }) => id)).size === 250, 'Question IDs are not unique.');
const questions = rawQuestions.map((raw) => createQuestion(raw, fixtures[raw.id] ?? [], executionContracts[raw.id]));

await mkdir(resolve('src/practice/data'), { recursive: true });
await mkdir(outputRoot, { recursive: true });
await writeFile(catalogPath, `${JSON.stringify(questions, null, 2)}\n`);
const metadata = [];
for (const [index, question] of questions.entries()) {
  const bytes = Buffer.from(`${JSON.stringify(question, null, 2)}\n`);
  const fileName = `question-${index + 1}.json`;
  await writeFile(join(outputRoot, fileName), bytes);
  metadata.push({
    id: question.id, title: question.title, summary: question.summary, language: question.language,
    topic: question.topic, category: question.category, subtopic: question.subtopic,
    questionType: question.questionType, skills: question.skills, difficulty: question.difficulty,
    estimatedMinutes: question.estimatedMinutes, xp: question.xp, position: index + 1,
    published: true, version: 'v3', storagePath: `practice/python/${fileName}`, contentHash: sha256(bytes),
  });
}
await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
console.log(JSON.stringify({ questions: questions.length, examples: questions.reduce((sum, q) => sum + q.examples.length, 0), fixtures: questions.reduce((sum, q) => sum + q.publicTests.length, 0), starters: questions.reduce((sum, q) => sum + Object.keys(q.starterTemplates).length, 0), sourceFiles: markdownFiles.map((file) => basename(file)) }, null, 2));
