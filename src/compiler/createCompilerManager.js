import { CompilerManager } from './core/CompilerManager.js';
import { RuntimeRegistry } from './core/RuntimeRegistry.js';
import { ValidatorRegistry } from './core/ValidatorRegistry.js';
import { pythonLanguage } from './languages/python.js';
import { NormalizedOutputValidator } from './validators/NormalizedOutputValidator.js';

export function createCompilerManager() {
  const runtimeRegistry = new RuntimeRegistry()
    .register(pythonLanguage.id, pythonLanguage.createRuntime);
  const normalizedValidator = new NormalizedOutputValidator();
  const validatorRegistry = new ValidatorRegistry()
    .register('normalized', normalizedValidator)
    .register('normalized_output', normalizedValidator);

  return new CompilerManager({ runtimeRegistry, validatorRegistry });
}
