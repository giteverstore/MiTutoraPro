import { semanticValuesEqual } from './semanticComparison.js';
import { ProjectExecutionService } from '../execution/ProjectExecutionService.js';

const RESULT_MARKER = '__MITUTORA_PROJECT_RESULTS__';

function publicCheck(check, passed, message = '') {
  return check.visible === false
    ? { name: check.name, passed, visible: false, message: passed ? 'Protected check passed' : 'Protected check failed' }
    : { name: check.name, passed, visible: true, message };
}

function patternsFor(check, language) {
  return check.patternsByLanguage?.[language] ?? check.patterns ?? [];
}

async function validateProjectChecks(compilerManager, project, submission, { signal, files, entrypoint, runtime } = {}) {
  const tests = [];
  const errors = [];
  let output = '';
  let executionTimeMs = 0;
  let projectFiles = files;
  const executionService = files ? new ProjectExecutionService(compilerManager) : null;
  for (const check of project.validation.checks) {
    if (check.requiresFilesystem && runtime?.filesystem?.persistentRuns === false) {
      tests.push({ name: check.name, passed: true, visible: check.visible !== false, notApplicable: true, message: `Automated filesystem verification is not supported by the ${runtime.displayName ?? project.language} browser runtime.` });
      continue;
    }
    if (check.type === 'source_matches') {
      const patterns = patternsFor(check, project.language);
      const passed = patterns.length > 0 && patterns.every((pattern) => new RegExp(pattern, 'im').test(submission));
      tests.push(publicCheck(check, passed, passed ? 'Passed' : 'Required behavior was not found yet.'));
      continue;
    }
    if (check.type === 'execution') {
      if (projectFiles?.[entrypoint]) projectFiles = { ...projectFiles, [entrypoint]: { ...projectFiles[entrypoint], content: submission } };
      const execution = executionService
        ? await executionService.execute({ projectId: project.id, languageId: project.language, files: projectFiles, entrypoint, runCommand: runtime?.runCommand, buildCommand: runtime?.buildCommand, stdin: check.stdin ?? '', signal })
        : await compilerManager.execute({ language: project.language, source: submission, filename: project.template.sourcePath, stdin: check.stdin ?? '', signal });
      if (execution.projectFiles) projectFiles = execution.projectFiles;
      executionTimeMs += execution.executionTimeMs ?? 0;
      output = execution.output ?? execution.stdout ?? '';
      const expected = check.outputIncludes ?? [];
      const expectedFile = check.filePathByLanguage?.[project.language] ?? check.filePath;
      const filesystemReady = !check.requiresFilesystem || execution.filesystemSupported === true;
      const fileReady = !expectedFile || Boolean(execution.projectFiles?.[expectedFile]);
      const passed = execution.status === 'success' && filesystemReady && fileReady && expected.every((value) => output.toLowerCase().includes(String(value).toLowerCase()));
      const failure = !filesystemReady ? 'This runtime does not expose project filesystem mutations.'
        : !fileReady ? `Expected the run to create ${expectedFile}.`
          : `Expected successful output containing: ${expected.join(', ')}`;
      tests.push(publicCheck(check, passed, passed ? 'Passed' : failure));
      if (execution.status !== 'success') errors.push(...(execution.errors ?? [execution.stderr ?? 'Execution did not complete successfully.']));
      continue;
    }
    tests.push(publicCheck(check, false, `Unsupported project check: ${check.type}`));
  }
  const passedCount = tests.filter(({ passed }) => passed).length;
  return { passed: tests.length > 0 && passedCount === tests.length, tests, score: tests.length ? Math.round((passedCount / tests.length) * 100) : 0, errors, output, executionTimeMs, ...(projectFiles ? { projectFiles } : {}) };
}

export function createValidationHarness(project) {
  const tests = project.validation.tests.map(({ name, args, expected, visible }) => ({ name, args, expected, visible }));
  return `\n# ycoders controlled validation harness\nimport json\n_tests = json.loads(${JSON.stringify(JSON.stringify(tests))})\n_results = []\nfor _test in _tests:\n    try:\n        _actual = ${project.functionDefinition.name}(*_test["args"])\n        _results.append({"name": _test["name"], "executed": True, "expected": _test["expected"], "actual": _actual, "visible": _test["visible"], "message": ""})\n    except Exception as _error:\n        _results.append({"name": _test["name"], "executed": False, "expected": _test["expected"], "actual": None, "visible": _test["visible"], "message": str(_error)})\nprint("${RESULT_MARKER}" + json.dumps(_results, default=str))\n`;
}
export class ProjectValidator {
  constructor(compilerManager) { this.compilerManager = compilerManager; }
  async validateProject(project, submission, options = {}) {
    const { signal } = options;
    if (project.validation?.type === 'project-checks') return validateProjectChecks(this.compilerManager, project, submission, options);
    if (!project.validation) {
      const execution = await this.compilerManager.execute({ language: project.language, source: submission, filename: project.template.sourcePath, signal });
      const expected = project.expectedOutput;
      const output = execution.output ?? execution.stdout ?? '';
      const passed = execution.status === 'success' && (!expected || output.trim().includes(String(expected).trim()));
      return { passed, tests: [{ name: 'Checkpoint execution', passed, visible: true }], score: passed ? 100 : 0, errors: execution.errors ?? (passed ? [] : [expected ? `Expected output containing: ${expected}` : 'Execution did not complete successfully.']), output, executionTimeMs: execution.executionTimeMs };
    }
    const imports = [...submission.matchAll(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm)].map((match) => (match[1] ?? match[2]).split('.')[0]);
    const disallowed = imports.filter((name) => !(project.allowedImports ?? []).includes(name));
    if (disallowed.length) return { passed: false, tests: [], score: 0, errors: [`Import not allowed: ${[...new Set(disallowed)].join(', ')}`], executionTimeMs: 0 };
    const execution = await this.compilerManager.execute({ language: project.language, source: submission + createValidationHarness(project), filename: project.template.sourcePath, signal });
    if (execution.status !== 'success') return { passed: false, tests: [], score: 0, errors: execution.errors, executionTimeMs: execution.executionTimeMs };
    const markerIndex = execution.output.lastIndexOf(RESULT_MARKER);
    if (markerIndex < 0) return { passed: false, tests: [], score: 0, errors: ['Validation results were not produced.'], executionTimeMs: execution.executionTimeMs };
    try {
      const raw = JSON.parse(execution.output.slice(markerIndex + RESULT_MARKER.length).trim()).map((test) => {
        const passed = test.executed && semanticValuesEqual(test.actual, test.expected, project.validation.numericTolerance);
        return { ...test, passed, message: test.executed ? (passed ? 'Passed' : 'Result did not match') : test.message };
      });
      const tests = raw.map((test) => test.visible ? test : { name: test.name, passed: test.passed, expected: null, actual: null, visible: false, message: test.passed ? 'Protected test passed' : 'Protected test failed' });
      const passedCount = tests.filter(({ passed }) => passed).length;
      return { passed: passedCount === tests.length, tests, score: Math.round((passedCount / tests.length) * 100), errors: [], executionTimeMs: execution.executionTimeMs };
    } catch { return { passed: false, tests: [], score: 0, errors: ['Validation returned malformed results.'], executionTimeMs: execution.executionTimeMs }; }
  }
}
