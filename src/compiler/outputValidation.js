import {
  NormalizedOutputValidator,
  normalizeOutput,
} from './validators/NormalizedOutputValidator.js';

const compatibilityValidator = new NormalizedOutputValidator();

export const normalizeProgramOutput = normalizeOutput;

export function validateProgramOutput({ expectedOutput, programOutput }) {
  return compatibilityValidator.validate(expectedOutput, programOutput);
}
