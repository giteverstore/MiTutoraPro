import { getSupportedCompilerLanguage } from '../../compiler/languages/supportedLanguages.js';

const PROJECT_RUNTIME_DEFAULTS = Object.freeze({
  python: { fileExtension: '.py', runCommand: 'python main.py', filesystem: { multiFile: true, mutationCapture: true, persistentRuns: true }, defaultFiles: [{ path: 'main.py', content: 'print("CLI Task Manager")\n' }] },
  javascript: { fileExtension: '.js', runtime: 'Node.js', runCommand: 'node index.js', packageManager: 'npm', filesystem: { multiFile: true, mutationCapture: true, persistentRuns: true }, defaultFiles: [{ path: 'index.js', content: 'console.log("CLI Task Manager");\n' }] },
  java: { fileExtension: '.java', buildCommand: 'javac Main.java', runCommand: 'java Main', filesystem: { multiFile: true, mutationCapture: false, persistentRuns: false }, defaultFiles: [{ path: 'Main.java', content: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("CLI Task Manager");\n  }\n}\n' }] },
  cpp: { fileExtension: '.cpp', buildCommand: 'g++ main.cpp -o app', runCommand: './app', filesystem: { multiFile: true, mutationCapture: true, persistentRuns: true }, defaultFiles: [{ path: 'main.cpp', content: '#include <iostream>\nint main() {\n  std::cout << "CLI Task Manager" << std::endl;\n  return 0;\n}\n' }] },
});

const extensionFor = (fileName) => String(fileName ?? '').match(/(\.[^.]+)$/)?.[1] ?? '';

export function getProjectRuntime(languageId, override = {}) {
  const language = getSupportedCompilerLanguage(languageId);
  if (!language) throw new TypeError(`Unknown project language: ${languageId}`);
  const defaults = PROJECT_RUNTIME_DEFAULTS[language.id] ?? {};
  const entrypoint = override.entrypoint ?? defaults.defaultFiles?.[0]?.path ?? language.defaultFileName;
  return Object.freeze({
    id: language.id, displayName: language.label, editorLanguage: language.monacoLanguage,
    fileExtension: defaults.fileExtension ?? extensionFor(entrypoint), runtime: defaults.runtime ?? language.label,
    buildCommand: null, runCommand: null, packageManager: null, entrypoint,
    icon: language.icon ?? null, executionMode: language.executionMode,
    ...defaults, ...override,
    defaultFiles: Object.freeze([...(override.defaultFiles ?? defaults.defaultFiles ?? [{ path: entrypoint, content: language.defaultSource ?? '' }])]),
  });
}

export function resolveProjectRuntime(project, languageId) {
  if (!project.supportedLanguages.includes(languageId)) throw new TypeError(`${languageId} is not supported by ${project.id}.`);
  return getProjectRuntime(languageId, project.languageOverrides?.[languageId]);
}

export const listProjectRuntimes = (project) => project.supportedLanguages.map((languageId) => resolveProjectRuntime(project, languageId));
