import { CompilerManager } from './core/CompilerManager.js';
import { RuntimeRegistry } from './core/RuntimeRegistry.js';
import { supportedCompilerLanguages } from './languages/supportedLanguages.js';
import { createOutputValidatorRegistry } from './validators/createOutputValidatorRegistry.js';

export function createCompilerManager() {
  const runtimeRegistry = supportedCompilerLanguages.reduce(
    (registry, language) => registry.register(language.id, language.createRuntime),
    new RuntimeRegistry(),
  );
  const validatorRegistry = createOutputValidatorRegistry();

  return new CompilerManager({ runtimeRegistry, validatorRegistry });
}
