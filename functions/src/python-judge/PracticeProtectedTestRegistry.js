import { ProtectedTestRegistry } from './ProtectedTestRegistry.js';

// Server-only definitions. This module must never be imported by src/ or a Vite entry.
export function createInitialPracticeProtectedTestRegistry() {
  return new ProtectedTestRegistry();
}

export function createSyntheticPythonJudgeRegistry() {
  return new ProtectedTestRegistry().register({
    suiteId: 'synthetic-square-suite', suiteVersion: 'v1',
    activityId: 'synthetic-square', activityVersion: 'v1',
    contentHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    language: 'python', entryPoint: 'square',
    tests: [{ arguments: [0], expected: 0 }, { arguments: [-7], expected: 49 }, { arguments: [12], expected: 144 }],
  });
}
