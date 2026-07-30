import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/editor/editor.api';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import {
  conf as pythonConfiguration,
  language as pythonLanguage,
} from 'monaco-editor/languages/definitions/python/python';
import 'monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching';
import 'monaco-editor/editor/contrib/comment/browser/comment';
import 'monaco-editor/editor/contrib/find/browser/findController';
import 'monaco-editor/editor/contrib/linesOperations/browser/linesOperations';
import { useSettings } from '../settings/useSettings';

const EDITOR_THEME = 'mi-tutora-editor';

globalThis.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};
loader.config({ monaco });

function configureMonaco(monacoInstance) {
  if (!monacoInstance.languages.getLanguages().some(({ id }) => id === 'python')) {
    monacoInstance.languages.register({
      id: 'python',
      extensions: ['.py', '.rpy', '.pyw', '.cpy', '.gyp', '.gypi'],
      aliases: ['Python', 'py'],
      firstLine: '^#!/.*\\bpython[0-9.-]*\\b',
    });
  }
  monacoInstance.languages.setLanguageConfiguration('python', pythonConfiguration);
  monacoInstance.languages.setMonarchTokensProvider('python', pythonLanguage);
  monacoInstance.editor.defineTheme(EDITOR_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '78837C', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'B3CBBB' },
      { token: 'string', foreground: 'C2B4A4' },
      { token: 'number', foreground: 'D6B887' },
    ],
    colors: {
      'editor.background': '#1D211F',
      'editor.foreground': '#D7DDD8',
      'editorLineNumber.foreground': '#59615A',
      'editorLineNumber.activeForeground': '#AEB8B1',
      'editorCursor.foreground': '#A9C3B7',
      'editor.selectionBackground': '#3A504766',
      'editor.inactiveSelectionBackground': '#34433D55',
      'editor.lineHighlightBackground': '#252A27',
      'editorIndentGuide.background1': '#313632',
      'editorIndentGuide.activeBackground1': '#536058',
      'editorBracketMatch.background': '#425D5344',
      'editorBracketMatch.border': '#8EAFA1',
      'editorWidget.background': '#242925',
      'editorWidget.border': '#373D39',
      'input.background': '#1D211F',
      'list.hoverBackground': '#303632',
    },
  });
}

export default function MonacoCodeEditor({ editor, value, onChange }) {
  const settings = useSettings();
  const editorTheme = {
    'mitutora-dark': EDITOR_THEME,
    'vs-dark': 'vs-dark',
    light: 'vs',
  }[settings.editor.theme] ?? EDITOR_THEME;
  const handleMount = (instance, monacoInstance) => {
    instance.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, () => {
      window.dispatchEvent(new CustomEvent('learning-platform:run'));
    });
    window.requestAnimationFrame(() => {
      const editorNode = instance.getDomNode();
      const bounds = editorNode?.getBoundingClientRect();
      const isVisible = bounds
        && bounds.width > 0
        && bounds.height > 0
        && bounds.bottom > 0
        && bounds.top < window.innerHeight;
      if (isVisible) instance.focus();
    });
  };

  return (
    <div className="monaco-editor-shell" onKeyDown={(event) => event.stopPropagation()}>
      <Editor
        height="100%"
        language="python"
        theme={editorTheme}
        value={value}
        beforeMount={configureMonaco}
        onMount={handleMount}
        onChange={(nextValue) => onChange(nextValue ?? '')}
        loading={<div className="monaco-loading-state">Loading Monaco…</div>}
        options={{
          ariaLabel: editor.ariaLabel,
          automaticLayout: true,
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          autoIndent: 'full',
          autoSurround: 'languageDefined',
          bracketPairColorization: { enabled: true },
          cursorSmoothCaretAnimation: 'on',
          detectIndentation: false,
          folding: true,
          fontFamily: "'DM Mono', monospace",
          fontSize: settings.editor.fontSize,
          glyphMargin: false,
          guides: { bracketPairs: true, indentation: true },
          insertSpaces: true,
          lineHeight: 24,
          lineNumbers: settings.editor.lineNumbers ? 'on' : 'off',
          lineNumbersMinChars: 3,
          matchBrackets: 'always',
          minimap: { enabled: settings.editor.minimap },
          padding: { top: 18, bottom: 18 },
          renderLineHighlight: 'line',
          renderWhitespace: 'selection',
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          stickyScroll: { enabled: false },
          tabFocusMode: false,
          tabSize: settings.editor.tabSize,
          wordWrap: settings.editor.wordWrap ? 'on' : 'off',
        }}
      />
    </div>
  );
}
