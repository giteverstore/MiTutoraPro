import { semanticValuesEqual } from './semanticComparison.js';

const RESULT_MARKER = '__MITUTORA_PROJECT_RESULTS__';

export function createValidationHarness(project) {
  const tests = project.validation.tests.map(({ name, args, expected, visible }) => ({ name, args, expected, visible }));
  return `\n# MiTutora controlled validation harness\nimport json\n_tests = json.loads(${JSON.stringify(JSON.stringify(tests))})\n_results = []\nfor _test in _tests:\n    try:\n        _actual = ${project.functionDefinition.name}(*_test["args"])\n        _results.append({"name": _test["name"], "executed": True, "expected": _test["expected"], "actual": _actual, "visible": _test["visible"], "message": ""})\n    except Exception as _error:\n        _results.append({"name": _test["name"], "executed": False, "expected": _test["expected"], "actual": None, "visible": _test["visible"], "message": str(_error)})\nprint("${RESULT_MARKER}" + json.dumps(_results, default=str))\n`;
}
export class ProjectValidator {
  constructor(compilerManager) { this.compilerManager = compilerManager; }
  async validateProject(project, submission, { signal } = {}) {
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
