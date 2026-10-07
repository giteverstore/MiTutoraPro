import { AssetPicker } from '../../publishing/AssetPicker.jsx';

const TextField = ({ label, value = '', onChange, readOnly, multiline = false, rows = 4 }) => <label><span>{label}</span>{multiline ? <textarea rows={rows} value={value} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} /> : <input value={value} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} />}</label>;

function contentProperty(block) {
  if (['heading', 'paragraph', 'callout'].includes(block.type)) return 'text';
  if (block.type === 'code') return 'code';
  if (block.type === 'expected-output') return 'output';
  if (block.type === 'terminal-command') return 'display';
  return null;
}

function VariantEditor({ block, property, languages, readOnly, update }) {
  const value = block[property];
  const variantMode = value && typeof value === 'object';
  const sharedValue = typeof value === 'string' ? value : value?.default ?? '';
  const setMode = (enabled) => {
    if (enabled) update({ [property]: { variants: Object.fromEntries(languages.map((language) => [language, sharedValue])), requiredLanguages: [...languages] } });
    else update({ [property]: value?.default ?? value?.variants?.[languages[0]] ?? '' });
  };
  return <fieldset><legend>Content mode</legend><div className="content-inspector-mode"><label><input type="radio" checked={!variantMode} disabled={readOnly} onChange={() => setMode(false)} /> Shared</label><label><input type="radio" checked={variantMode} disabled={readOnly} onChange={() => setMode(true)} /> Language variants</label></div>{variantMode ? languages.map((language) => <TextField key={language} label={language} multiline rows={block.type === 'code' ? 8 : 4} readOnly={readOnly} value={value.variants?.[language] ?? ''} onChange={(next) => update({ [property]: { ...value, variants: { ...value.variants, [language]: next }, requiredLanguages: [...languages] } })} />) : <TextField label={block.type === 'code' ? 'Code' : 'Content'} multiline rows={block.type === 'code' ? 10 : 5} readOnly={readOnly} value={sharedValue} onChange={(next) => update({ [property]: next })} />}</fieldset>;
}

export function BlockInspector({ block, supportedLanguages, readOnly, dispatch, hidden = false }) {
  if (!block) return <aside id="content-properties-inspector" className="content-studio-inspector" aria-label="Properties inspector" hidden={hidden}><header><span>Properties</span><p>Select a block to edit its structured properties.</p></header></aside>;
  const update = (patch) => dispatch({ type: 'update', blockId: block.blockId, patch });
  const property = contentProperty(block);
  return <aside id="content-properties-inspector" className="content-studio-inspector" aria-label="Properties inspector" hidden={hidden}><header><span>Properties</span><p>{block.type} · {block.blockId.slice(-12)}</p></header><div className="content-inspector-fields">
    {block.type === 'heading' ? <label><span>Heading level</span><select value={block.level} disabled={readOnly} onChange={(event) => update({ level: Number(event.target.value) })}><option value="2">H2</option><option value="3">H3</option><option value="4">H4</option></select></label> : null}
    {block.type === 'code' && typeof block.code === 'string' ? <label><span>Syntax language</span><select value={block.language ?? supportedLanguages[0]} disabled={readOnly} onChange={(event) => update({ language: event.target.value })}>{supportedLanguages.map((language) => <option key={language}>{language}</option>)}</select></label> : null}
    {block.type === 'callout' ? <><label><span>Callout type</span><select value={block.variant} disabled={readOnly} onChange={(event) => update({ variant: event.target.value })}><option value="note">Note</option><option value="warning">Warning</option><option value="tip">Tip</option></select></label><TextField label="Title" value={block.title ?? ''} readOnly={readOnly} onChange={(title) => update({ title })} /></> : null}
    {property ? <VariantEditor block={block} property={property} languages={supportedLanguages} readOnly={readOnly} update={update} /> : null}
    {['list', 'requirements', 'common-mistakes'].includes(block.type) ? <TextField label="Items (one per line)" multiline rows={8} value={block.items.join('\n')} readOnly={readOnly} onChange={(value) => update({ items: value.split('\n').filter((item) => item.length) })} /> : null}
    {block.type === 'image' ? <><TextField label="Asset ID" value={block.assetId} readOnly={readOnly} onChange={(assetId) => update({ assetId })} />{!readOnly ? <AssetPicker onSelect={(assetId) => update({ assetId })} /> : null}<TextField label="Alternative text" value={block.alt} readOnly={readOnly} onChange={(alt) => update({ alt })} /><TextField label="Caption" value={block.caption ?? ''} readOnly={readOnly} onChange={(caption) => update({ caption })} /></> : null}
    {block.type === 'table' ? <><TextField label="Columns (tab separated)" value={block.columns.join('\t')} readOnly={readOnly} onChange={(value) => update({ columns: value.split('\t') })} /><TextField label="Rows (one row per line, tab separated)" multiline rows={8} value={block.rows.map((row) => row.join('\t')).join('\n')} readOnly={readOnly} onChange={(value) => update({ rows: value.split('\n').filter(Boolean).map((row) => row.split('\t')) })} /></> : null}
    {block.type === 'terminal-command' ? <TextField label="Trusted command ID" value={block.commandId} readOnly={readOnly} onChange={(commandId) => update({ commandId })} /> : null}
    {block.type === 'concept' ? <><TextField label="Concept ID" value={block.conceptId} readOnly={readOnly} onChange={(conceptId) => update({ conceptId })} /><TextField label="Title" value={block.title ?? ''} readOnly={readOnly} onChange={(title) => update({ title })} /><TextField label="Explanation" multiline value={block.text} readOnly={readOnly} onChange={(text) => update({ text })} /></> : null}
    {block.type === 'divider' ? <p className="content-inspector-note">Divider has no author-controlled presentation properties.</p> : null}
  </div></aside>;
}
