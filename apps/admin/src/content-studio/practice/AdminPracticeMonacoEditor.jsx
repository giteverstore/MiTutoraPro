import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/editor/editor.api';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import { conf as pythonConfiguration, language as pythonLanguage } from 'monaco-editor/languages/definitions/python/python';
import { conf as javaConfiguration, language as javaLanguage } from 'monaco-editor/languages/definitions/java/java';
import { conf as cppConfiguration, language as cppLanguage } from 'monaco-editor/languages/definitions/cpp/cpp';

globalThis.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

let languagesConfigured = false;
function configureLanguages(instance) {
  if (languagesConfigured) return;
  languagesConfigured = true;
  for (const [id, extensions, configuration, language] of [
    ['python', ['.py'], pythonConfiguration, pythonLanguage],
    ['java', ['.java'], javaConfiguration, javaLanguage],
    ['cpp', ['.cpp'], cppConfiguration, cppLanguage],
  ]) {
    if (!instance.languages.getLanguages().some((entry) => entry.id === id)) {
      instance.languages.register({ id, extensions });
    }
    instance.languages.setLanguageConfiguration(id, configuration);
    instance.languages.setMonarchTokensProvider(id, language);
  }
}

export default function AdminPracticeMonacoEditor({ questionId, language, value, onChange }) {
  const extension = { python: 'py', java: 'java', cpp: 'cpp' }[language] ?? 'txt';
  return <Editor
    path={`file:///admin-practice-preview/${questionId}/main.${extension}`}
    language={language}
    value={value}
    onChange={(nextValue) => onChange(nextValue ?? '')}
    beforeMount={configureLanguages}
    options={{ ariaLabel: 'Code for preview run', automaticLayout: true, minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false }}
  />;
}
