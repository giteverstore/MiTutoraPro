import { memo, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, GripVertical, Trash2 } from 'lucide-react';
import { BLOCK_DEFINITION_BY_TYPE, createBlock } from './blockDefinitions.js';
import { SemanticBlockPreview } from './SemanticBlockPreview.jsx';

const PlainTextarea = ({ value, onChange, label, readOnly, rows = 3 }) => <textarea aria-label={label} rows={rows} value={value} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} />;

const CanvasBlock = memo(function CanvasBlock({ block, index, count, selected, readOnly, language, dispatch, create, renderPreview }) {
  const [dragOver, setDragOver] = useState(false);
  const content = (value) => typeof value === 'string' ? value : value?.variants?.[language] ?? value?.default ?? '';
  const update = (patch) => dispatch({ type: 'update', blockId: block.blockId, patch });
  const selectedClass = selected ? ' is-selected' : '';
  let preview;
  if (block.type === 'heading') preview = <input aria-label="Heading text" value={content(block.text)} readOnly={readOnly || typeof block.text !== 'string'} onChange={(event) => update({ text: event.target.value })} className={`content-heading-level-${block.level}`} />;
  else if (block.type === 'paragraph') preview = <PlainTextarea label="Paragraph text" value={content(block.text)} readOnly={readOnly || typeof block.text !== 'string'} onChange={(text) => update({ text })} />;
  else if (block.type === 'list') preview = <ol className={`content-inline-list is-${block.style ?? 'unordered'}`}>{block.items.map((item, itemIndex) => <li key={`${block.blockId}-${itemIndex}`}><input aria-label={`List item ${itemIndex + 1}`} value={item} readOnly={readOnly} onChange={(event) => update({ items: block.items.map((value, candidateIndex) => candidateIndex === itemIndex ? event.target.value : value) })} /></li>)}</ol>;
  else if (block.type === 'requirements' || block.type === 'common-mistakes') preview = <ul>{block.items.map((item, itemIndex) => <li key={`${block.blockId}-${itemIndex}`}>{item}</li>)}</ul>;
  else if (block.type === 'code') preview = <><div className="content-block-context"><span>{block.language ?? language}</span>{typeof block.code === 'object' ? <strong>Language variants</strong> : <strong>Shared</strong>}</div><pre><code>{content(block.code)}</code></pre></>;
  else if (block.type === 'callout') preview = <div className={`content-callout is-${block.variant}`}><strong>{block.title}</strong><p>{content(block.text)}</p></div>;
  else if (block.type === 'image') preview = <div className="content-image-placeholder"><span>Asset: {block.assetId}</span><strong>{block.alt}</strong>{block.caption ? <small>{block.caption}</small> : null}</div>;
  else if (block.type === 'table') preview = <div className="content-table-wrap"><table><thead><tr>{block.columns.map((column, columnIndex) => <th key={`${column}-${columnIndex}`}>{column}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
  else if (block.type === 'expected-output') preview = <pre className="content-output">{content(block.output)}</pre>;
  else if (block.type === 'terminal-command') preview = <div className="content-command"><code>{block.commandId}</code><span>{content(block.display)}</span></div>;
  else if (block.type === 'divider') preview = <hr />;
  else if (block.type === 'concept') preview = <div><strong>{block.title ?? block.conceptId}</strong><p>{block.text}</p></div>;
  else preview = <SemanticBlockPreview block={block} language={language} />;
  return <article className={`content-canvas-block${selectedClass}${dragOver ? ' is-drag-over' : ''}`} data-block-id={block.blockId} tabIndex="0" aria-label={`${block.type} block`} aria-current={selected ? 'true' : undefined} draggable={!readOnly} onClick={() => dispatch({ type: 'select', blockId: block.blockId })} onFocus={() => dispatch({ type: 'select', blockId: block.blockId })} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-ycoders-block-id', block.blockId); }} onDragEnter={() => setDragOver(true)} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragOver(false); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); setDragOver(false); const source = event.dataTransfer.getData('application/x-ycoders-block-id'); const type = event.dataTransfer.getData('application/x-ycoders-block-type'); if (source) dispatch({ type: 'move', blockId: source, toIndex: index }); else if (type) dispatch({ type: 'add', block: create(type), afterBlockId: block.blockId }); }}>
    <div className="content-canvas-block-toolbar"><GripVertical aria-hidden="true" /><span>{BLOCK_DEFINITION_BY_TYPE[block.type]?.label ?? block.type}</span><code>{block.blockId.slice(-8)}</code>{!readOnly ? <div><button type="button" aria-label="Move block up" disabled={index === 0} onClick={(event) => { event.stopPropagation(); dispatch({ type: 'move', blockId: block.blockId, toIndex: index - 1 }); }}><ArrowUp /></button><button type="button" aria-label="Move block down" disabled={index === count - 1} onClick={(event) => { event.stopPropagation(); dispatch({ type: 'move', blockId: block.blockId, toIndex: index + 1 }); }}><ArrowDown /></button><button type="button" aria-label="Duplicate block" onClick={(event) => { event.stopPropagation(); dispatch({ type: 'duplicate', blockId: block.blockId }); }}><Copy /></button><button type="button" aria-label="Delete block" onClick={(event) => { event.stopPropagation(); dispatch({ type: 'delete', blockId: block.blockId }); }}><Trash2 /></button></div> : null}</div>
    <div className="content-canvas-block-preview">{block.id ? <SemanticBlockPreview block={block} language={language} /> : renderPreview ? renderPreview(block) : preview}</div>
  </article>;
});

export function BlockCanvas({ blocks, selectedBlockId, readOnly, language, dispatch, create = createBlock, renderPreview }) {
  const [emptyDragOver, setEmptyDragOver] = useState(false);
  const canvasRef = useRef(null);
  const previousIds = useRef(new Set(blocks.map(({ blockId }) => blockId)));
  useEffect(() => {
    const isNew = selectedBlockId && !previousIds.current.has(selectedBlockId);
    previousIds.current = new Set(blocks.map(({ blockId }) => blockId));
    if (!isNew) return;
    const target = [...(canvasRef.current?.querySelectorAll('[data-block-id]') ?? [])].find((node) => node.dataset.blockId === selectedBlockId);
    target?.focus();
  }, [blocks, selectedBlockId]);
  return <section ref={canvasRef} className={`content-studio-canvas${!blocks.length && emptyDragOver ? ' is-empty-drag-over' : ''}`} aria-label="Document canvas" onDragEnter={() => { if (!blocks.length) setEmptyDragOver(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setEmptyDragOver(false); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setEmptyDragOver(false); const type = event.dataTransfer.getData('application/x-ycoders-block-type'); if (type) dispatch({ type: 'add', block: create(type) }); }}>
    {!blocks.length ? <div className="content-studio-empty" onDragOver={(event) => event.preventDefault()}><h2>Start building your content</h2><p>Choose a block or drag one into this canvas.</p></div> : blocks.map((block, index) => <CanvasBlock key={block.blockId} block={block} index={index} count={blocks.length} selected={block.blockId === selectedBlockId} readOnly={readOnly} language={language} dispatch={dispatch} create={create} renderPreview={renderPreview} />)}
  </section>;
}
