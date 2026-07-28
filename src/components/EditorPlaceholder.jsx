export function EditorPlaceholder({ editor, value, onChange }) {
  return (
    <div className="editor-window">
      <div className="editor-tabs">
        <span className="active">{editor.fileName}</span>
        <span className="unsaved-dot" aria-label={editor.unsavedLabel} />
      </div>
      <textarea
        className="editor-input"
        aria-label={editor.ariaLabel}
        spellCheck="false"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
