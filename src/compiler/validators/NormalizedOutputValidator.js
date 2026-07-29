import { OutputValidator } from '../core/OutputValidator.js';

export function normalizeOutput(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .replace(/\s+/g, ' ');
}

export class NormalizedOutputValidator extends OutputValidator {
  validate(expectedOutput, programOutput) {
    return normalizeOutput(expectedOutput) === normalizeOutput(programOutput);
  }
}
