import { CompilerManager } from './core/CompilerManager.js';
import { RuntimeRegistry } from './core/RuntimeRegistry.js';
import { ValidatorRegistry } from './core/ValidatorRegistry.js';
import { supportedCompilerLanguages } from './languages/supportedLanguages.js';
import { NormalizedOutputValidator } from './validators/NormalizedOutputValidator.js';
import { NumericToleranceValidator } from './validators/NumericToleranceValidator.js';
import { IntegerRangeValidator } from './validators/IntegerRangeValidator.js';

export function createCompilerManager() {
  const runtimeRegistry = supportedCompilerLanguages.reduce(
    (registry, language) => registry.register(language.id, language.createRuntime),
    new RuntimeRegistry(),
  );
  const normalizedValidator = new NormalizedOutputValidator();
  const validatorRegistry = new ValidatorRegistry()
    .register('normalized', normalizedValidator)
    .register('normalized_output', normalizedValidator)
    .register('numeric_tolerance', new NumericToleranceValidator())
    .register('integer_range', new IntegerRangeValidator());

  return new CompilerManager({ runtimeRegistry, validatorRegistry });
}
