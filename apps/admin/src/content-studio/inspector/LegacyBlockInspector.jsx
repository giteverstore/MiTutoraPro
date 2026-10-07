import { useEffect, useState } from 'react';
import { AssetPicker } from '../../publishing/AssetPicker.jsx';

const labelFor = (key) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
const multiline = new Set(['content', 'text', 'code', 'starterCode', 'expectedOutput', 'instructions', 'description', 'question', 'summary', 'caption']);

function StructuredValue({ label, value, readOnly, onChange }) {
  const serialized = JSON.stringify(value, null, 2);
  const [text, setText] = useState(serialized);
  const [error, setError] = useState('');
  useEffect(() => { setText(serialized); setError(''); }, [serialized]);
  const apply = () => {
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
      if (typeof value === 'boolean') return <label key={key}><span>{label}</span><input type="checkbox" checked={value} disabled={readOnly} onChange={(event) => onChange({ [key]: event.target.checked })} /></label>;
      if (typeof value === 'number') return <label key={key}><span>{label}</span><input type="number" value={value} readOnly={readOnly} onChange={(event) => onChange({ [key]: Number(event.target.value) })} /></label>;
      if (value && typeof value === 'object') return <StructuredValue key={`${block.id}-${key}`} label={label} value={value} readOnly={readOnly} onChange={(next) => onChange({ [key]: next })} />;
      return <label key={key}><span>{label}</span>{multiline.has(key) ? <textarea aria-label={label} value={value ?? ''} readOnly={readOnly} rows={key === 'code' || key === 'starterCode' ? 9 : 4} onChange={(event) => onChange({ [key]: event.target.value })} /> : <input aria-label={label} value={value ?? ''} readOnly={readOnly} onChange={(event) => onChange({ [key]: event.target.value })} />}{key === 'assetId' && !readOnly ? <AssetPicker onSelect={(assetId) => onChange({ assetId })} /> : null}</label>;
    })}
  </div></div>;
}
