import { useEffect, useState } from 'react';
import { AssetPicker } from '../../publishing/AssetPicker.jsx';
import { CODE_LANGUAGES, CODE_MODES, EnumSelect, ExerciseInstructions, FORMAT_OPTIONS, QuizOptionsEditor, RepeatableFileEditor, RepeatableTextList, SELECTION_MODES, singleCorrectOptionId } from './StructuredBlockControls.jsx';
import { CANONICAL_LANGUAGE_IDS } from '../../../../../shared/content/constants.js';

const labelFor = (key) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
const multiline = new Set(['content', 'text', 'code', 'starterCode', 'expectedOutput', 'instructions', 'description', 'question', 'summary', 'caption']);

function StructuredValue({ label, value, readOnly, onChange }) {
  const serialized = JSON.stringify(value, null, 2) ?? 'null';
  const [text, setText] = useState(serialized);
  const [error, setError] = useState('');
  useEffect(() => { setText(serialized); setError(''); }, [serialized]);
  const apply = () => {
    if (text === serialized) return;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(value) !== Array.isArray(parsed) || (value && typeof value === 'object' && (!parsed || typeof parsed !== 'object'))) throw new Error('Keep the same structured value type.');
      onChange(parsed);
      setError('');
    } catch (cause) { setError(cause.message); }
  };
  return <label><span>{label}</span><textarea aria-label={label} value={text} readOnly={readOnly} rows={Math.min(10, Math.max(3, text.split('\n').length))} onChange={(event) => setText(event.target.value)} onBlur={readOnly ? undefined : apply} />{error ? <small role="alert">{error}</small> : null}</label>;
}

export function LegacyBlockInspector({ block, readOnly, onChange }) {
  if (!block) return <div className="studio-inspector-note">Select a block to edit its properties.</div>;
  return <div className="project-form studio-block-inspector"><h3 className="studio-inspector-heading">{labelFor(block.type)} properties</h3><p className="studio-inspector-note">Block ID: <code>{block.id}</code></p><div className="content-inspector-fields">
    {Object.entries(block).filter(([key]) => !['id', 'type'].includes(key)).map(([key, value]) => {
      const label = labelFor(key);
      if (key === 'format' && ['paragraph', 'note'].includes(block.type)) return <EnumSelect key={key} label={label} value={value} options={FORMAT_OPTIONS} disabled={readOnly} onChange={(format) => onChange({ format })} />;
      if (key === 'format' && ['callout', 'warning'].includes(block.type)) return null;
      if (key === 'language' && ['code', 'compiler', 'solution'].includes(block.type)) return <EnumSelect key={key} label={label} value={value} options={block.type === 'compiler' ? CANONICAL_LANGUAGE_IDS : CODE_LANGUAGES} disabled={readOnly} onChange={(language) => onChange(block.type === 'compiler' ? { language, runtime: language } : { language })} />;
      if (key === 'mode' && block.type === 'code') return <EnumSelect key={key} label={label} value={value} options={CODE_MODES} disabled={readOnly} onChange={(mode) => onChange({ mode })} />;
      if (key === 'runtime' && block.type === 'compiler') return <label key={key}><span>Runtime (managed by language)</span><input aria-label="Runtime" value={value ?? block.language ?? ''} readOnly /></label>;
      if (key === 'selectionMode' && block.type === 'quiz') return <EnumSelect key={key} label={label} value={value} options={SELECTION_MODES} disabled={readOnly} onChange={(selectionMode) => { const correctId = singleCorrectOptionId(block.options, block.correctOptionIds); onChange({ selectionMode, correctOptionIds: selectionMode === 'single' ? correctId ? [correctId] : [] : block.correctOptionIds }); }} />;
      if (key === 'options' && block.type === 'quiz') return <QuizOptionsEditor key={key} block={block} readOnly={readOnly} onChange={onChange} />;
      if (key === 'correctOptionIds' && block.type === 'quiz') return null;
      if (key === 'items' && block.type === 'list' && Array.isArray(value)) return <RepeatableTextList key={key} label="Items" items={value} objectItems readOnly={readOnly} onChange={(items) => onChange({ items })} />;
      if (key === 'instructions' && block.type === 'exercise' && (typeof value === 'string' || typeof value?.content === 'string')) return <ExerciseInstructions key={key} value={value} readOnly={readOnly} onChange={(instructions) => onChange({ instructions })} />;
      if (key === 'instructions' && block.type === 'exercise') return <StructuredValue key={`${block.id}-${key}`} label="Advanced instructions JSON (legacy)" value={value} readOnly={readOnly} onChange={(instructions) => onChange({ instructions })} />;
      if (['objectives', 'hints'].includes(key) && block.type === 'exercise' && Array.isArray(value)) return <RepeatableTextList key={key} label={label} items={value} readOnly={readOnly} onChange={(items) => onChange({ [key]: items })} />;
      if (key === 'starterFiles' && block.type === 'exercise' && Array.isArray(value)) return <RepeatableFileEditor key={key} files={value} readOnly={readOnly} onChange={(starterFiles) => onChange({ starterFiles })} />;
      if (typeof value === 'boolean') return <label key={key}><span>{label}</span><input type="checkbox" checked={value} disabled={readOnly} onChange={(event) => onChange({ [key]: event.target.checked })} /></label>;
      if (typeof value === 'number') return <label key={key}><span>{label}</span><input type="number" value={value} readOnly={readOnly} onChange={(event) => onChange({ [key]: Number(event.target.value) })} /></label>;
      if (value && typeof value === 'object') return <StructuredValue key={`${block.id}-${key}`} label={label} value={value} readOnly={readOnly} onChange={(next) => onChange({ [key]: next })} />;
      return <label key={key}><span>{label}</span>{multiline.has(key) ? <textarea aria-label={label} value={value ?? ''} readOnly={readOnly} rows={key === 'code' || key === 'starterCode' ? 9 : 4} onChange={(event) => onChange({ [key]: event.target.value })} /> : <input aria-label={label} value={value ?? ''} readOnly={readOnly} onChange={(event) => onChange({ [key]: event.target.value })} />}{key === 'assetId' && !readOnly ? <AssetPicker onSelect={(assetId) => onChange({ assetId, ...(block.type === 'image' ? { src: undefined } : {}) })} /> : null}</label>;
    })}
  </div></div>;
}
