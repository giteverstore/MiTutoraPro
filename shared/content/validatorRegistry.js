import { VALIDATOR_TYPES } from './constants.js';

const descriptor = (id, implementation, description) => Object.freeze({
  id,
  version: 1,
  implementation,
  description,
});

export const TRUSTED_VALIDATOR_REGISTRY = Object.freeze({
  execution_succeeds: descriptor('execution_succeeds', 'compiler-execution', 'Requires a successful compile and execution.'),
  output_contains: descriptor('output_contains', 'normalized-output', 'Matches required text in normalized output.'),
  file_exists: descriptor('file_exists', 'virtual-project-files', 'Checks a path in the isolated project filesystem.'),
  source_pattern: descriptor('source_pattern', 'bounded-source-matcher', 'Applies bounded, platform-reviewed source patterns.'),
  function_behavior: descriptor('function_behavior', 'trusted-function-harness', 'Runs declared cases through a generated trusted harness.'),
  runtime_scenario: descriptor('runtime_scenario', 'project-runtime-scenario', 'Runs bounded stdin/filesystem scenarios in the project runtime.'),
});

export function getTrustedValidator(type, version = 1) {
  const entry = TRUSTED_VALIDATOR_REGISTRY[type];
  return entry?.version === version ? entry : null;
}

export function isTrustedValidatorType(type) {
  return VALIDATOR_TYPES.includes(type) && Boolean(TRUSTED_VALIDATOR_REGISTRY[type]);
}
