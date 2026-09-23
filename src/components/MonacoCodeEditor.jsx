import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/editor/editor.api';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import {
  conf as pythonConfiguration,
  language as pythonLanguage,
} from 'monaco-editor/languages/definitions/python/python';
import {
  conf as javaConfiguration,
  language as javaLanguage,
} from 'monaco-editor/languages/definitions/java/java';
import 'monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching';
import 'monaco-editor/editor/contrib/comment/browser/comment';
import 'monaco-editor/editor/contrib/find/browser/findController';
import 'monaco-editor/editor/contrib/linesOperations/browser/linesOperations';
import { useRef } from 'react';
import { useSettings } from '../settings/useSettings';
import { dispatchCompilerRun } from '../compiler/core/compilerEvents';
import { EDITOR_THEME_CATALOG, editorThemeById } from '../theme/editorThemeCatalog';

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
  if (!monacoInstance.languages.getLanguages().some(({ id }) => id === 'java')) {
    monacoInstance.languages.register({
      id: 'java',
      extensions: ['.java'],
      aliases: ['Java', 'java'],
    });
  }
  monacoInstance.languages.setLanguageConfiguration('java', javaConfiguration);
  monacoInstance.languages.setMonarchTokensProvider('java', javaLanguage);
  EDITOR_THEME_CATALOG.forEach((theme) => {
    const { palette, syntax } = theme;
    monacoInstance.editor.defineTheme(theme.monacoTheme, {
      base: theme.dark ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: syntax.comment, fontStyle: 'italic' },
        { token: 'keyword', foreground: syntax.keyword },
        { token: 'string', foreground: syntax.string },
        { token: 'number', foreground: syntax.number },
        { token: 'type', foreground: syntax.type },
        { token: 'type.identifier', foreground: syntax.type },
        { token: 'function', foreground: syntax.function },
        { token: 'identifier', foreground: syntax.variable },
        { token: 'operator', foreground: syntax.operator },
      ],
      colors: {
        'editor.background': palette.background,
        'editor.foreground': palette.text,
        'editorLineNumber.foreground': palette.muted,
        'editorLineNumber.activeForeground': palette.text,
        'editorCursor.foreground': palette.accent,
        'editor.selectionBackground': `${palette.accent}44`,
        'editor.inactiveSelectionBackground': `${palette.accent}2B`,
        'editor.lineHighlightBackground': palette.surface,
        'editorIndentGuide.background1': palette.border,
        'editorIndentGuide.activeBackground1': palette.controlBorder,
        'editorBracketMatch.background': `${palette.accent}33`,
        'editorBracketMatch.border': palette.accent,
        'editorWidget.background': palette.surface,
        'editorWidget.border': palette.border,
        'input.background': palette.background,
        'list.hoverBackground': palette.panel,
      },
    });
  });
}

export default function MonacoCodeEditor({ editor, value, onChange, onSelectionChange, onAskSelection, instanceId }) {
  const settings = useSettings();
  const editorTheme = editorThemeById(settings.editor.theme).monacoTheme;
  const askSelectionRef = useRef(onAskSelection);
  askSelectionRef.current = onAskSelection;
  const handleMount = (instance, monacoInstance) => {
    let activeSelection = null;
    let editorFocused = false;
    const widgetNode = document.createElement('button');
    widgetNode.type = 'button';
    widgetNode.className = 'monaco-ask-ai-widget';
    widgetNode.textContent = '✨ Ask AI Tutor';
    widgetNode.setAttribute('aria-label', 'Ask AI Tutor about selection');
    const widget = {
      getId: () => `${instanceId}-ask-ai-selection`,
      getDomNode: () => widgetNode,
      getPosition: () => activeSelection && editorFocused ? {
        position: activeSelection.getEndPosition(),
        preference: [monacoInstance.editor.ContentWidgetPositionPreference.ABOVE, monacoInstance.editor.ContentWidgetPositionPreference.BELOW],
      } : null,
    };
    const selectionPayload = () => {
      const model = instance.getModel();
      if (!model || !activeSelection || activeSelection.isEmpty()) return null;
      const text = model.getValueInRange(activeSelection);
      if (!text.trim()) return null;
      const startLine = activeSelection.startLineNumber;
      const endLine = activeSelection.endLineNumber;
      const surroundingStart = Math.max(1, startLine - 2);
      const surroundingEnd = Math.min(model.getLineCount(), endLine + 2);
      return {
        text,
        source: model.getValue(),
        startOffset: model.getOffsetAt(activeSelection.getStartPosition()),
        endOffset: model.getOffsetAt(activeSelection.getEndPosition()),
        startLine,
        endLine,
        surroundingCode: model.getValueInRange(new monacoInstance.Range(surroundingStart, 1, surroundingEnd, model.getLineMaxColumn(surroundingEnd))),
      };
    };
    const askAboutSelection = () => {
      const payload = selectionPayload();
      if (!payload) return;
      activeSelection = null;
      instance.layoutContentWidget(widget);
      askSelectionRef.current?.(payload);
    };
    const preserveSelectionFocus = (event) => event.preventDefault();
    if (askSelectionRef.current) {
      widgetNode.addEventListener('pointerdown', preserveSelectionFocus);
      widgetNode.addEventListener('click', askAboutSelection);
      instance.addContentWidget(widget);
    }
    instance.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, () => {
      dispatchCompilerRun(instanceId, 'monaco-shortcut');
    });
    const selectionDisposable = instance.onDidChangeCursorSelection(({ selection }) => {
      const model = instance.getModel();
      const source = model?.getValue() ?? '';
      activeSelection = selection.isEmpty() || !model?.getValueInRange(selection).trim() ? null : selection;
      if (askSelectionRef.current) instance.layoutContentWidget(widget);
      onSelectionChange?.({
        text: model?.getValueInRange(selection) ?? '',
        source,
        startOffset: model?.getOffsetAt(selection.getStartPosition()) ?? 0,
        endOffset: model?.getOffsetAt(selection.getEndPosition()) ?? 0,
      });
    });
    const focusDisposable = instance.onDidFocusEditorText(() => { editorFocused = true; if (askSelectionRef.current) instance.layoutContentWidget(widget); });
    const blurDisposable = instance.onDidBlurEditorText(() => { editorFocused = false; if (askSelectionRef.current) instance.layoutContentWidget(widget); });
    const escapeDisposable = instance.onKeyDown((event) => {
      if (event.keyCode === monacoInstance.KeyCode.Escape && activeSelection) {
        activeSelection = null;
        instance.setSelection(instance.getPosition());
        if (askSelectionRef.current) instance.layoutContentWidget(widget);
      }
    });
    const actionDisposable = askSelectionRef.current ? instance.addAction({
      id: `${instanceId}-ask-ai-selection-action`,
      label: 'Ask AI Tutor about Selection',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      precondition: 'editorHasSelection',
      run: askAboutSelection,
    }) : null;
    instance.onDidDispose(() => {
      widgetNode.removeEventListener('pointerdown', preserveSelectionFocus);
      widgetNode.removeEventListener('click', askAboutSelection);
      selectionDisposable.dispose();
      focusDisposable.dispose();
      blurDisposable.dispose();
      escapeDisposable.dispose();
      actionDisposable?.dispose();
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
        language={editor.language || 'plaintext'}
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
