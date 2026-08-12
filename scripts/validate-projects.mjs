import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { ProjectCatalog } from '../src/projects/repositories/ProjectCatalog.js';
import { ProjectExporter, removeStarterArtifacts } from '../src/projects/export/ProjectExporter.js';
import { ProjectProgressService } from '../src/projects/services/ProjectProgressService.js';
import { semanticValuesEqual } from '../src/projects/validation/semanticComparison.js';
import { ProjectValidator } from '../src/projects/validation/ProjectValidator.js';

const equivalent = (actual, expected, tolerance) => assert.equal(semanticValuesEqual(actual, expected, tolerance), true);
const different = (actual, expected, tolerance) => assert.equal(semanticValuesEqual(actual, expected, tolerance), false);

equivalent(4, 4.0);
equivalent(0.3, 0.30000000000000004);
different(4, 5);
different(4, '4');
different(null, 0);
different(true, 1);
equivalent([4, { total: 0.3 }], [4.0, { total: 0.30000000000000004 }]);
different(1, 1.01, { relative: 1e-4, absolute: 1e-4 });

// Representative output shapes from projects that rely on numeric and nested comparison.
equivalent(1, 1.0); // Unit Converter
equivalent(7, 7.0); // Calculator
equivalent({ total: 10, by_category: { food: 10.8 } }, { total: 10.0, by_category: { food: 10.800000000000001 } }); // Expense Tracker
equivalent({ Avi: '9876543210' }, { Avi: '9876543210' }); // Contact Book

const validatorProject = {
  language: 'python', allowedImports: [], template: { sourcePath: 'main.py' },
  functionDefinition: { name: 'calculate' },
  validation: { numericTolerance: { relative: 1e-9, absolute: 1e-9 }, tests: [{ name: 'Numeric result', args: [], expected: 4, visible: true }] },
};
const compilerManager = {
  execute: async () => ({
    status: 'success', errors: [], executionTimeMs: 1,
    output: '__MITUTORA_PROJECT_RESULTS__' + JSON.stringify([{ name: 'Numeric result', executed: true, expected: 4, actual: 4.0, visible: true, message: '' }]),
  }),
};
const validationResult = await new ProjectValidator(compilerManager).validateProject(validatorProject, 'def calculate():\n    return 4.0');
assert.equal(validationResult.passed, true, 'Generic validator must accept numerically equivalent int/float results.');
assert.equal(validationResult.tests[0].message, 'Passed');

const expectedIds = ['simple-calculator', 'number-guessing-game', 'unit-converter', 'expense-tracker', 'contact-book'];
const obsoleteIds = ['reverse-string', 'word-counter', 'temperature-converter', 'palindrome-checker', 'number-frequency', 'password-strength-checker', 'shopping-cart-total', 'duplicate-remover', 'log-message-parser'];
const catalog = new ProjectCatalog(); const projects = catalog.getProjects();
assert.deepEqual(projects.map(({ id }) => id), expectedIds);
assert.deepEqual(projects.map(({ slug }) => slug), expectedIds);
assert.equal(new Set(projects.map(({ id }) => id)).size, projects.length);
assert.equal(catalog.getProjectsByDifficulty('easy').length, 5);
assert.equal(catalog.getProjectsByLanguage('python').length, 5);
assert.equal(catalog.getProjectsByCategory('Python Fundamentals').length, 5);
obsoleteIds.forEach((id) => assert.equal(catalog.getProjectById(id), null, `${id} must not remain registered.`));
for (const project of projects) {
  assert.equal(project.language, 'python');
  assert.equal(project.difficulty, 'Easy');
  assert.ok(project.description && project.why && project.instructions && project.estimatedMinutes > 0);
  assert.ok(project.starterCode.includes(`def ${project.functionDefinition.name}`));
  assert.ok(!/^\s*pass\s*$/m.test(project.starterCode), `${project.id} starter code must not contain pass.`);
  assert.ok(/^def [a-z_][a-z0-9_]*\([^\n]*\):\n {4}"""[^\n]+"""\n {4}# TODO: [^\n]+\n$/i.test(project.starterCode), `${project.id} starter code must be a valid learner-oriented function template.`);
  assert.ok(project.functionDefinition.parameters.length && project.functionDefinition.returns);
  assert.ok(project.validation.tests.some(({ visible }) => visible));
  assert.ok(project.validation.tests.some(({ visible }) => !visible));
  assert.ok(project.requirements.length && project.skills.length && project.learningObjectives.length);
  assert.equal(project.validation.type, 'python-function');
  assert.equal(project.export.repositoryName, project.slug);
  assert.equal(project.template.sourcePath, `src/${project.moduleName}.py`);
  assert.equal(project.template.testPath, `tests/test_${project.moduleName}.py`);
  assert.ok(!/\b(random|input)\s*\(/.test(project.starterCode), `${project.id} validation must remain deterministic.`);
  project.validation.tests.forEach((test) => {
    assert.ok(test.name && Array.isArray(test.args) && Object.hasOwn(test, 'expected'));
    assert.doesNotThrow(() => JSON.stringify(test));
  });
}

const storage = new Map(); globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
const progress = new ProjectProgressService(); progress.start('simple-calculator');
assert.equal(progress.get('simple-calculator').status, 'started');
progress.recordValidation('simple-calculator', { passed: false, score: 50 }, 'failed source'); assert.equal(progress.get('simple-calculator').attempts, 1);
progress.recordValidation('simple-calculator', { passed: true, score: 100 }, 'completed source'); assert.equal(progress.get('simple-calculator').status, 'completed');
assert.equal(progress.get('simple-calculator').submission, 'completed source');

for (const project of projects) {
  const starterMarker = project.starterCode.split('\n').find((line) => line.includes('# TODO:'));
  const learnerBody = '    # Keep this learner-authored comment\n    return None\n';
  const submittedCode = project.starterCode.replace(starterMarker, `${learnerBody}${starterMarker}`);
  const expectedImplementation = submittedCode.replace(`${starterMarker}\n`, '');
  assert.equal(removeStarterArtifacts(project, submittedCode), expectedImplementation, `${project.id} must remove only its starter marker.`);
  assert.ok(removeStarterArtifacts(project, `${submittedCode}    # TODO: learner follow-up\n`).includes('# TODO: learner follow-up'), `${project.id} must preserve learner comments.`);
  const archive = await new ProjectExporter().createArchive(project, submittedCode, 'uint8array');
  const zip = await JSZip.loadAsync(archive); const names = Object.keys(zip.files); const root = project.export.repositoryName;
  assert.ok(names.includes(`${root}/README.md`) && names.includes(`${root}/${project.template.sourcePath}`));
  assert.ok(names.includes(`${root}/${project.template.testPath}`) && names.includes(`${root}/requirements.txt`) && names.includes(`${root}/.gitignore`));
  const exportedImplementation = await zip.file(`${root}/${project.template.sourcePath}`).async('string');
  assert.equal(exportedImplementation, expectedImplementation, `${project.id} export must preserve learner code and remove the starter artifact.`);
  assert.ok(exportedImplementation.includes('# Keep this learner-authored comment'));
  assert.ok(!/\bTODO:\s*implement\b/i.test(exportedImplementation));
  assert.ok(!/^\s*pass\s*$/m.test(exportedImplementation));
  const exportedTests = await zip.file(`${root}/${project.template.testPath}`).async('string');
  const exportedMethods = [...exportedTests.matchAll(/^    def (test_[a-z][a-z0-9_]*?)\(self\):$/gm)].map((match) => match[1]);
  const publicTests = project.validation.tests.filter(({ visible }) => visible);
  assert.equal(exportedMethods.length, publicTests.length, `${project.id} must export every public test with a valid method name.`);
  assert.equal(new Set(exportedMethods).size, exportedMethods.length, `${project.id} exported test names must be unique.`);
  assert.ok(exportedMethods.every((name) => !/^test_(?:case_)?\d+$/.test(name)), `${project.id} must not use generic test method names.`);
  publicTests.forEach(({ name }) => {
    const behaviorWords = name.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    assert.ok(behaviorWords.some((word) => exportedMethods.some((method) => method.includes(word))), `${project.id} exported names must describe public behavior.`);
  });
  project.validation.tests.filter(({ visible }) => !visible).forEach(({ name }) => assert.ok(!exportedTests.includes(name), `Protected test leaked from ${project.id}.`));
  assert.ok(!(await zip.file(`${root}/README.md`).async('string')).includes('hidden'));
}
process.stdout.write('Project validation passed: five-project catalog, metadata, deterministic contracts, completion, exports, and protected-test isolation.\n');
