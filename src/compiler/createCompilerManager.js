import { CompilerManager } from './core/CompilerManager.js';
import { RuntimeRegistry } from './core/RuntimeRegistry.js';
import { ValidatorRegistry } from './core/ValidatorRegistry.js';
import { pythonLanguage } from './languages/python.js';
import { javaLanguage } from './languages/java.js';
import { NormalizedOutputValidator } from './validators/NormalizedOutputValidator.js';
import { NumericToleranceValidator } from './validators/NumericToleranceValidator.js';
import { IntegerRangeValidator } from './validators/IntegerRangeValidator.js';

export function createCompilerManager() {
  const runtimeRegistry = new RuntimeRegistry()
    .register(pythonLanguage.id, pythonLanguage.createRuntime)
    .register(javaLanguage.id, javaLanguage.createRuntime);
  const normalizedValidator = new NormalizedOutputValidator();
  const validatorRegistry = new ValidatorRegistry()
    .register('normalized', normalizedValidator)
    .register('normalized_output', normalizedValidator)
    .register('numeric_tolerance', new NumericToleranceValidator())
    .register('integer_range', new IntegerRangeValidator());

  return new CompilerManager({ runtimeRegistry, validatorRegistry });
}
