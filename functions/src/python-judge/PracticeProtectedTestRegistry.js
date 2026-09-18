import { ProtectedTestRegistry } from './ProtectedTestRegistry.js';

// Server-only definitions. This module must never be imported by src/ or a Vite entry.
export function createInitialPracticeProtectedTestRegistry() {
  return new ProtectedTestRegistry()
    .register({
      suiteId: 'practice-fund-variables-001', suiteVersion: 'v1',
      activityId: 'fund-variables-001', activityVersion: 'v2',
      contentHash: 'f82864abec10ea3c150af37372e32011ca53fb87868b0d57114230821bc48524',
      language: 'python', entryPoint: 'create_user_label',
      tests: [{ arguments: ['Li', 150], expected: 'Li: 150' }, { arguments: ['Z', 1], expected: 'Z: 1' }],
    })
    .register({
      suiteId: 'practice-fund-variables-002', suiteVersion: 'v1',
      activityId: 'fund-variables-002', activityVersion: 'v2',
      contentHash: 'f0705f0c0468fd43cfb4f00c912140625b12cdc0bcbb46dc18f8115a238f65c3',
      language: 'python', entryPoint: 'final_inventory',
      tests: [{ arguments: [100, 100, 25], expected: 25 }, { arguments: [1, 0, 999], expected: 1000 }],
    });
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
