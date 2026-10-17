export function ContentTypeBadge({ type }) {
  const label = String(type ?? '').trim();
  const modifier = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return <span className={`difficulty-badge content-type-badge content-type-badge--${modifier}`}>{label}</span>;
}
