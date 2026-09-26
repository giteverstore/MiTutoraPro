import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Dialog } from '../components/Dialog.jsx';
import { publicCompilerLanguages } from '../compiler/languages/supportedLanguages.js';

const ICONS = Object.freeze({
  python: '/assets/languages/python.svg', java: '/assets/languages/java.svg', javascript: '/assets/languages/javascript.svg',
  typescript: '/assets/languages/typescript.svg', go: '/assets/languages/go.svg', cpp: '/assets/languages/cplusplus.svg',
  rust: '/assets/languages/rust.svg', 'html-css': '/assets/languages/html5.svg', sql: '/assets/languages/sql.svg', csharp: '/assets/languages/csharp.svg',
});

function monogram(language) {
  if (language.id === 'visualbasic') return 'VB';
  if (language.id === 'assembly') return 'ASM';
  return language.label.replace(/[^A-Za-z+#]/g, '').slice(0, 3);
}

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
        <span className="standalone-language-icon">{ICONS[language.id] ? <img src={ICONS[language.id]} alt="" /> : <b>{monogram(language)}</b>}</span>
        <span>{language.label}</span><Check className="standalone-language-check" size={16} aria-hidden="true" />
      </button>)}
    </div>
  </Dialog>;
}
