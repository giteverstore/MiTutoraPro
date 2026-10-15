export function ListBlock({ items = [], style = 'unordered' }) {
  const Tag = style === 'ordered' ? 'ol' : 'ul';
  return <Tag className="content-section lesson-list">{items.map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.text ?? ''}</li>)}</Tag>;
}
