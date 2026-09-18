const supportedDifficulties = new Set(['easy', 'medium', 'hard']);

export function DifficultyBadge({ difficulty, className = '' }) {
  const normalized = String(difficulty ?? '').trim().toLowerCase();
  const modifier = supportedDifficulties.has(normalized) ? ` difficulty-badge--${normalized}` : '';
  const label = normalized
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return <span className={`difficulty-badge${modifier}${className ? ` ${className}` : ''}`}>{label}</span>;
}
