export function ValidationPanel({ result, onSelectIssue }) {
  if (!result) return null;
  const issues = [...result.errors, ...result.warnings];
  return <section className="content-validation-panel" aria-live="polite" aria-label="Validation issues"><header><strong>{result.valid ? 'Document is valid' : `${result.errors.length} validation error${result.errors.length === 1 ? '' : 's'}`}</strong><span>{result.warnings.length} warnings</span></header>{issues.length ? <ul>{issues.map((entry, index) => <li key={`${entry.path}-${entry.code}-${index}`}><button type="button" onClick={() => entry.blockId && onSelectIssue(entry.blockId)} disabled={!entry.blockId}><span>{entry.severity}</span><code>{entry.path}</code><strong>{entry.message}</strong></button></li>)}</ul> : <p>The generated canonical document passed schema and content validation.</p>}</section>;
}
