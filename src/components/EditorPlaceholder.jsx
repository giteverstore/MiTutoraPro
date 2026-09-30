import { lazy, Suspense } from 'react';

const MonacoCodeEditor = lazy(() => import('./MonacoCodeEditor'));

export function EditorPlaceholder({ editor, value, onChange, onSelectionChange, onCursorPositionChange, onAskSelection, instanceId, workspacePreferences, loadingTheme }) {
  return (
    <div className="editor-window">
      <Suspense fallback={<EditorLoadingState theme={loadingTheme} />}>
        <MonacoCodeEditor editor={editor} value={value} onChange={onChange} onSelectionChange={onSelectionChange} onCursorPositionChange={onCursorPositionChange} onAskSelection={onAskSelection} instanceId={instanceId} workspacePreferences={workspacePreferences} />
      </Suspense>
    </div>
  );
}

export function EditorLoadingState({ theme }) {
  return (
    <div className={`monaco-loading-state${theme ? ' project-monaco-loading-state' : ''}`} data-project-editor-theme={theme} role="status">
      <span className="skeleton-line skeleton-short" />
      <span className="skeleton-line skeleton-medium" />
      <span className="skeleton-line" />
      <span className="skeleton-line skeleton-medium" />
      <span>Loading code editor…</span>
    </div>
  );
}
