import { lazy, Suspense } from 'react';

const MonacoCodeEditor = lazy(() => import('./MonacoCodeEditor'));

export function EditorPlaceholder({ editor, value, onChange, onSelectionChange, instanceId }) {
  return (
    <div className="editor-window">
      <Suspense fallback={<EditorLoadingState />}>
        <MonacoCodeEditor editor={editor} value={value} onChange={onChange} onSelectionChange={onSelectionChange} instanceId={instanceId} />
      </Suspense>
    </div>
  );
}

function EditorLoadingState() {
  return (
    <div className="monaco-loading-state" role="status">
      <span className="skeleton-line skeleton-short" />
      <span className="skeleton-line skeleton-medium" />
      <span className="skeleton-line" />
      <span className="skeleton-line skeleton-medium" />
      <span>Loading code editor…</span>
    </div>
  );
}
