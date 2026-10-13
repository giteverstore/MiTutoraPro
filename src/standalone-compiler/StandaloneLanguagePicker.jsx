import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Dialog } from '../components/Dialog.jsx';
import { publicCompilerLanguages } from '../compiler/languages/supportedLanguages.js';
import { STANDALONE_LANGUAGE_ICONS, standaloneLanguageMonogram } from './standaloneLanguagePresentation.js';

export function StandaloneLanguagePicker({ open, activeLanguage, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const languages = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return publicCompilerLanguages;
    return publicCompilerLanguages.filter((language) => [language.label, language.id, language.publicSlug, ...language.aliases]
      .some((value) => String(value).toLowerCase().includes(normalized)));
  }, [query]);
  return <Dialog open={open} title="Choose a Language" onClose={onClose} className="standalone-language-dialog">
    <label className="standalone-language-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search languages</span><input data-autofocus aria-label="Search languages" placeholder="Search languages..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <div className="standalone-language-grid" role="radiogroup" aria-label="Compiler languages">
      {languages.map((language) => <button type="button" role="radio" aria-checked={language.id === activeLanguage.id} className={language.id === activeLanguage.id ? 'is-selected' : ''} onClick={() => onSelect(language)} key={language.id}>
        <span className="standalone-language-icon">{STANDALONE_LANGUAGE_ICONS[language.id] ? <img src={STANDALONE_LANGUAGE_ICONS[language.id]} alt="" /> : <b className="standalone-language-monogram">{standaloneLanguageMonogram(language)}</b>}</span>
        <span className="standalone-language-label">{language.label}</span><Check className="standalone-language-check" size={16} aria-hidden="true" />
      </button>)}
    </div>
  </Dialog>;
}
