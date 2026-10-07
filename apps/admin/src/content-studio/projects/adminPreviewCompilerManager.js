import { CompilerManager } from '../../../../../src/compiler/core/CompilerManager.js';
import { RuntimeRegistry } from '../../../../../src/compiler/core/RuntimeRegistry.js';
import { createOutputValidatorRegistry } from '../../../../../src/compiler/validators/createOutputValidatorRegistry.js';
import { pythonLanguage } from '../../../../../src/compiler/languages/python.js';
import { PythonRuntime } from '../../../../../src/compiler/runtimes/python/PythonRuntime.js';
import { PythonWorkerClient } from '../../../../../src/compiler/runtimes/python/PythonWorkerClient.js';
import { javaLanguage } from '../../../../../src/compiler/languages/java.js';
import { cppLanguage } from '../../../../../src/compiler/languages/cpp.js';
export function createAdminPreviewCompilerManager(){
  const registry=new RuntimeRegistry();
  registry.register(pythonLanguage.id, () => new PythonRuntime({ client: new PythonWorkerClient({ runtimeBaseUrl: new URL('/admin-pyodide/', globalThis.location.href).href }) }));
  [javaLanguage,cppLanguage].forEach((language)=>registry.register(language.id,language.createRuntime));
  return new CompilerManager({runtimeRegistry:registry,validatorRegistry:createOutputValidatorRegistry()});
}
