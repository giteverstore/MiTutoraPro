import { courseBlockSchema } from '../../../../../shared/content/schemas.js';
import { CANONICAL_LANGUAGE_IDS } from '../../../../../shared/content/constants.js';

export const FORMAT_OPTIONS = courseBlockSchema.properties.format.enum;
export const SELECTION_MODES = courseBlockSchema.properties.selectionMode.enum;
export const CODE_LANGUAGES = [...CANONICAL_LANGUAGE_IDS, ...courseBlockSchema.properties.language.anyOf[1].enum];
// The learner CodeBlock explicitly handles runnable and defaults to display.
// Legacy values remain visible in EnumSelect, but cannot be newly selected.
export const CODE_MODES = ['display', 'runnable'];

export function singleCorrectOptionId(options = [], selected = []) {
  return options.find((option) => selected.includes(option.id))?.id ?? options[0]?.id ?? null;
}

const newOptionId = () => `option-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;

export function EnumSelect({ label, value, options, disabled, onChange, allowExisting = false }) {
  const legacyValue = value && !options.includes(value);
  return <label><span>{label}</span><select aria-label={label} value={value ?? ''} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{!value && <option value="">Select {label.toLowerCase()}</option>}{legacyValue && <option value={value} disabled={!allowExisting}>Existing: {value}</option>}{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

export function RepeatableTextList({ label, items = [], readOnly, onChange, objectItems = false }) {
  const textOf = (item) => objectItems && typeof item === 'object' ? item?.text ?? '' : item ?? '';
  const update = (index, text) => onChange(items.map((item, itemIndex) => itemIndex === index ? objectItems && typeof item === 'object' ? { ...item, text } : text : item));
  return <fieldset className="studio-repeatable"><legend>{label}</legend>{items.map((item, index) => <div className="studio-repeatable-row" key={index}><label><span>{label} {index + 1}</span><input aria-label={`${label} ${index + 1}`} value={textOf(item)} readOnly={readOnly} onChange={(event) => update(index, event.target.value)} /></label><button type="button" aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} disabled={readOnly} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}{!readOnly && <button type="button" onClick={() => onChange([...items, ''])}>+ Add {label.toLowerCase().replace(/s$/, '')}</button>}{items.some((item) => !String(textOf(item)).trim()) && <small>Fill blank entries before publishing.</small>}</fieldset>;
}

export function QuizOptionsEditor({ block, readOnly, onChange }) {
  const options = Array.isArray(block.options) ? block.options : [];
  const selected = Array.isArray(block.correctOptionIds) ? block.correctOptionIds : [];
  const multiple = block.selectionMode === 'multiple';
  const setOptions = (nextOptions, nextSelected = selected) => onChange({ options: nextOptions, correctOptionIds: nextSelected });
  const remove = (id) => {
    const nextOptions = options.filter((option) => option.id !== id);
    let nextSelected = selected.filter((selectedId) => selectedId !== id);
    if (!nextSelected.length && nextOptions.length) nextSelected = [nextOptions[0].id];
    setOptions(nextOptions, nextSelected);
  };
  return <fieldset className="studio-repeatable"><legend>Options</legend>{options.map((option, index) => <div className="studio-repeatable-row" key={option.id}><label><span>Option {index + 1}</span><input aria-label={`Option ${index + 1}`} value={option.text} readOnly={readOnly} onChange={(event) => setOptions(options.map((item) => item.id === option.id ? { ...item, text: event.target.value } : item))} /></label><button type="button" aria-label={`Remove option ${index + 1}`} disabled={readOnly || options.length <= 2} onClick={() => remove(option.id)}>Remove</button></div>)}{!readOnly && <button type="button" disabled={options.length >= 12} onClick={() => setOptions([...options, { id: newOptionId(), text: '' }])}>+ Add option</button>}{options.length < 2 && <small>At least two options are required.</small>}{options.some((option) => !option.text.trim()) && <small>Fill blank options before publishing.</small>}
    <div className="studio-correct-options"><strong>Correct answer</strong>{multiple ? options.map((option, index) => <label key={option.id}><input type="checkbox" checked={selected.includes(option.id)} disabled={readOnly || (selected.length === 1 && selected.includes(option.id))} onChange={(event) => { const next = event.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id); onChange({ correctOptionIds: next }); }} />{String.fromCharCode(65 + index)}. {option.text || '(blank)'}</label>) : <label><span>Correct option</span><select aria-label="Correct option" value={selected[0] ?? ''} disabled={readOnly || !options.length} onChange={(event) => onChange({ correctOptionIds: [event.target.value] })}><option value="" disabled>Select an option</option>{options.map((option, index) => <option key={option.id} value={option.id}>{String.fromCharCode(65 + index)}. {option.text || '(blank)'}</option>)}</select></label>}{!selected.length && <small>Select at least one correct option before publishing.</small>}</div>
  </fieldset>;
}

export function ExerciseInstructions({ value, readOnly, onChange }) {
  if (typeof value === 'string' || value == null) return <label><span>Instructions</span><textarea aria-label="Instructions" value={value ?? ''} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} /></label>;
  if (typeof value.content !== 'string') return null;
  return <fieldset className="studio-repeatable"><legend>Instructions</legend><label><span>Content</span><textarea aria-label="Instructions content" value={value.content} readOnly={readOnly} onChange={(event) => onChange({ ...value, content: event.target.value })} /></label>{typeof value.format === 'string' && <EnumSelect label="Instructions format" value={value.format} options={FORMAT_OPTIONS} disabled={readOnly} onChange={(format) => onChange({ ...value, format })} />}</fieldset>;
}

export function RepeatableFileEditor({ files = [], readOnly, onChange }) {
  return <fieldset className="studio-repeatable"><legend>Starter files</legend>{files.map((file, index) => <div className="studio-repeatable-file" key={index}><label><span>File name {index + 1}</span><input aria-label={`File name ${index + 1}`} value={file.name ?? ''} readOnly={readOnly} onChange={(event) => onChange(files.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /></label><label><span>Content {index + 1}</span><textarea aria-label={`File content ${index + 1}`} value={file.content ?? ''} readOnly={readOnly} onChange={(event) => onChange(files.map((item, itemIndex) => itemIndex === index ? { ...item, content: event.target.value } : item))} /></label><button type="button" disabled={readOnly} onClick={() => onChange(files.filter((_, itemIndex) => itemIndex !== index))}>Remove file {index + 1}</button></div>)}{!readOnly && <button type="button" onClick={() => onChange([...files, { name: '', content: '' }])}>+ Add file</button>}{files.some((file) => !file.name?.trim()) && <small>File names are required before publishing.</small>}</fieldset>;
}
