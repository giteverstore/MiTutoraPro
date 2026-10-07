import { ValidatorRegistry } from '../core/ValidatorRegistry.js';
import { NormalizedOutputValidator } from './NormalizedOutputValidator.js';
import { NumericToleranceValidator } from './NumericToleranceValidator.js';
import { IntegerRangeValidator } from './IntegerRangeValidator.js';

const normalizeLines = (value) => String(value ?? '').replace(/\r\n?/g, '\n').trim().split('\n').map((line) => line.trimEnd()).join('\n');

export function createOutputValidatorRegistry() {
  const normalized = new NormalizedOutputValidator();
  return new ValidatorRegistry()
    .register('normalized', normalized)
    .register('normalized_output', normalized)
    .register('normalized-lines', { validate: (expected, actual) => normalizeLines(expected) === normalizeLines(actual) })
    .register('trimmed', { validate: (expected, actual) => String(expected ?? '').trim() === String(actual ?? '').trim() })
    .register('exact', { validate: (expected, actual) => String(expected ?? '') === String(actual ?? '') })
    .register('numeric_tolerance', new NumericToleranceValidator())
    .register('integer_range', new IntegerRangeValidator());
}
