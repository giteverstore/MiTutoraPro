export const MAX_COMPOSER_SELECTION_CHARACTERS = 8_000;

export function quoteTutorSelection(value, maximum = MAX_COMPOSER_SELECTION_CHARACTERS) {
  const source = String(value ?? '').trim();
  if (!source) return '';
  const truncated = source.length > maximum;
  const visible = truncated ? source.slice(0, maximum) : source;
  const quoted = visible.split('\n').map((line) => `> ${line}`).join('\n');
  return truncated ? `${quoted}\n> [Selection truncated]` : quoted;
}

export function mergeTutorDraft(currentDraft, selectedText) {
  const quote = quoteTutorSelection(selectedText);
  if (!quote) return String(currentDraft ?? '');
  const current = String(currentDraft ?? '');
  return current.trim() ? `${current.trimEnd()}\n\n${quote}\n` : `${quote}\n\n`;
}
