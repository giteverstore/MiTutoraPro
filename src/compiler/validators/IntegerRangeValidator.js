import { OutputValidator } from '../core/OutputValidator.js';

export class IntegerRangeValidator extends OutputValidator {
  validate(_expectedOutput, programOutput, { min, max } = {}) {
    const value = String(programOutput ?? '').trim();
    if (!/^-?\d+$/.test(value)) return false;
    const number = Number(value);
    return Number.isInteger(number) && number >= min && number <= max;
  }
}
