import { OutputValidator } from '../core/OutputValidator.js';

const numbers = (value) => String(value ?? '').match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)?.map(Number) ?? [];

export class NumericToleranceValidator extends OutputValidator {
  validate(expectedOutput, programOutput, { tolerance = 1e-9 } = {}) {
    const expected = numbers(expectedOutput);
    const actual = numbers(programOutput);
    if (!expected.length || expected.length !== actual.length) return false;
    return expected.every((value, index) => Number.isFinite(actual[index]) && Math.abs(value - actual[index]) <= tolerance);
  }
}
