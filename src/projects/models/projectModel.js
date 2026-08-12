const required = ['id', 'slug', 'title', 'description', 'difficulty', 'language', 'category', 'starterCode', 'functionDefinition', 'validation', 'template', 'export'];
export function createProject(record) {
  required.forEach((field) => { if (!record?.[field]) throw new TypeError(`Project requires ${field}.`); });
  if (!Array.isArray(record.validation.tests) || !record.validation.tests.length) throw new TypeError('Project validation requires tests.');
  const numericTolerance = Object.freeze({ relative: 1e-9, absolute: 1e-9, ...record.validation.numericTolerance });
  return Object.freeze({ ...record, skills: Object.freeze([...(record.skills ?? [])]), learningObjectives: Object.freeze([...(record.learningObjectives ?? [])]), requirements: Object.freeze([...(record.requirements ?? [])]), validation: Object.freeze({ ...record.validation, numericTolerance, tests: Object.freeze(record.validation.tests.map((test) => Object.freeze({ ...test }))) }) });
}
