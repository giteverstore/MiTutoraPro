const required = ['id', 'slug', 'title', 'description', 'difficulty', 'category', 'export'];
const executionModes = new Set(['terminal_only', 'run_or_terminal']);
const guideBlockTypes = new Set(['heading', 'paragraph', 'note', 'list', 'code', 'expected-output', 'runtime-command', 'language-hint', 'language-section']);
const validationTypes = new Set(['execution', 'source_matches']);
const legacyCheckpoint = (record) => ({
  id: 'implementation', title: 'Implementation', objective: record.instructions,
  executionMode: 'run_or_terminal', guide: [{ type: 'paragraph', text: record.instructions }],
  requirements: record.requirements ?? [], expectedOutput: record.example?.output,
  completionMessage: `${record.title} is complete.`, validation: record.validation,
});
export function createProject(record) {
  required.forEach((field) => { if (!record?.[field]) throw new TypeError(`Project requires ${field}.`); });
  const supportedLanguages = record.supportedLanguages ?? (record.language ? [record.language] : []);
  if (!supportedLanguages.length) throw new TypeError('Project requires at least one supported language.');
  const checkpoints = record.checkpoints ?? [legacyCheckpoint(record)];
  if (!checkpoints.length) throw new TypeError('Project requires checkpoints.');
  checkpoints.forEach((checkpoint) => {
    if (!checkpoint.id || !checkpoint.title || !checkpoint.objective) throw new TypeError('Every project checkpoint requires id, title, and objective.');
    if (!executionModes.has(checkpoint.executionMode)) throw new TypeError(`Unsupported checkpoint execution mode: ${checkpoint.executionMode}.`);
    if (!checkpoint.guide?.length || checkpoint.guide.some(({ type }) => !guideBlockTypes.has(type))) throw new TypeError(`Checkpoint ${checkpoint.id} requires supported guide content.`);
    if (checkpoint.validation?.type === 'project-checks' && (!checkpoint.validation.checks?.length || checkpoint.validation.checks.some(({ type }) => !validationTypes.has(type)))) throw new TypeError(`Checkpoint ${checkpoint.id} requires supported validation checks.`);
  });
  if (record.validation && (!Array.isArray(record.validation.tests) || !record.validation.tests.length)) throw new TypeError('Project validation requires tests.');
  const validation = record.validation ? Object.freeze({ ...record.validation, numericTolerance: Object.freeze({ relative: 1e-9, absolute: 1e-9, ...record.validation.numericTolerance }), tests: Object.freeze(record.validation.tests.map((test) => Object.freeze({ ...test }))) }) : null;
  return Object.freeze({
    ...record, language: record.language ?? supportedLanguages[0], supportedLanguages: Object.freeze([...supportedLanguages]),
    languageOverrides: Object.freeze({ ...(record.languageOverrides ?? {}) }), languageContent: Object.freeze({ ...(record.languageContent ?? {}) }),
    skills: Object.freeze([...(record.skills ?? [])]), learningObjectives: Object.freeze([...(record.learningObjectives ?? [])]),
    prerequisites: Object.freeze([...(record.prerequisites ?? [])]), requirements: Object.freeze([...(record.requirements ?? [])]), validation,
    checkpoints: Object.freeze(checkpoints.map((checkpoint) => Object.freeze({ ...checkpoint, requirements: Object.freeze([...(checkpoint.requirements ?? [])]), guide: Object.freeze([...(checkpoint.guide ?? [])]) }))),
  });
}
