import { AssetPreview } from '../../publishing/AssetsPage.jsx';

const text = (value, language) => typeof value === 'string' ? value : value?.variants?.[language] ?? value?.default ?? value?.content ?? '';
const rowsOf = (block) => block.rows ?? [];

export function SemanticBlockPreview({ block, language }) {
  const kind = block.type;
  if (kind === 'heading') { const Tag = `h${Math.max(2, Math.min(4, Number(block.level) || 2))}`; return <Tag>{text(block.text ?? block.content, language)}</Tag>; }
  if (kind === 'paragraph') return <p className="studio-semantic-paragraph">{text(block.text ?? block.content, language)}</p>;
  if (kind === 'divider') return <hr />;
  if (kind === 'list' || kind === 'requirements' || kind === 'common-mistakes') { const Tag = block.style === 'ordered' ? 'ol' : 'ul'; return <Tag className="content-inline-list">{(block.items ?? []).map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.text ?? ''}</li>)}</Tag>; }
  if (['callout', 'note', 'warning', 'concept'].includes(kind)) return <div className={`content-callout is-${kind === 'warning' ? 'warning' : block.variant ?? 'note'}`}><strong>{block.title ?? (kind === 'concept' ? 'Concept' : kind === 'warning' ? 'Warning' : 'Note')}</strong><p>{text(block.text ?? block.content, language)}</p></div>;
  if (kind === 'table') { const columns = block.columns ?? []; return <div className="content-table-wrap"><table><thead><tr>{columns.map((column, index) => <th key={index}>{typeof column === 'string' ? column : column.header ?? column.key}</th>)}</tr></thead><tbody>{rowsOf(block).map((row, index) => <tr key={index}>{columns.map((column, cell) => <td key={cell}>{Array.isArray(row) ? row[cell] : row[column.key]}</td>)}</tr>)}</tbody></table></div>; }
  if (kind === 'image') { const src = /^\/assets\/[a-zA-Z0-9/_-]+\.(png|jpe?g|webp|svg)$/.test(block.src ?? '') ? `https://ycoders.com${block.src}` : ''; return <figure className="studio-semantic-image">{src ? <img src={src} alt={block.alt ?? ''} /> : block.assetId ? <AssetPreview asset={{ assetId: block.assetId, path: block.path }} /> : <div className="content-image-placeholder">Choose an image asset</div>}{block.caption ? <figcaption>{block.caption}</figcaption> : null}</figure>; }
  if (kind === 'quiz') return <section className="studio-semantic-exercise"><strong>Quiz</strong><p>{block.question}</p><ul>{(block.options ?? []).map((option, index) => <li key={option.id ?? index}>{typeof option === 'string' ? option : option.text}</li>)}</ul></section>;
  if (kind === 'exercise') return <section className="studio-semantic-exercise"><strong>Exercise · {block.title}</strong><p>{text(block.instructions, language)}</p></section>;
  if (kind === 'compiler') return <section className="studio-semantic-exercise"><div className="content-block-context"><span>{block.language ?? language} · Compiler exercise</span></div><pre><code>{text(block.starterCode ?? block.code, language)}</code></pre>{block.expectedOutput != null ? <><strong>Expected output</strong><pre className="content-output">{text(block.expectedOutput, language)}</pre></> : null}</section>;
  if (kind === 'code' || kind === 'solution') return <section><div className="content-block-context"><span>{block.language ?? language ?? kind}</span>{kind === 'solution' ? <strong>Solution</strong> : null}</div><pre><code>{text(block.code ?? block.content, language)}</code></pre></section>;
  if (kind === 'expected-output') return <section><div className="content-block-context"><span>Expected output</span></div><pre className="content-output">{text(block.expectedOutput ?? block.output ?? block.content, language)}</pre></section>;
  if (kind === 'terminal-command') return <div className="content-command"><code>{block.commandId}</code><span>{text(block.display, language)}</span></div>;
  return <p className="studio-semantic-paragraph">{text(block.content ?? block.text ?? block.title, language)}</p>;
}
