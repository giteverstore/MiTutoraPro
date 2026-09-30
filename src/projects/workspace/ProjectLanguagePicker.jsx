import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import { supportedCompilerLanguages } from '../../compiler/languages/supportedLanguages';

export function ProjectLanguagePicker({ open, activeLanguageId, allowedProjectLanguages, theme = 'light', onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const languages = useMemo(() => {
    const allowed = allowedProjectLanguages ? new Set(allowedProjectLanguages) : null;
    const normalized = query.trim().toLowerCase();
    return supportedCompilerLanguages.filter((language) => (!allowed || allowed.has(language.id))
      && (!normalized || `${language.label} ${language.id}`.toLowerCase().includes(normalized)));
  }, [allowedProjectLanguages, query]);
  return <Dialog open={open} title="Select project compiler" onClose={onClose} className="project-language-dialog" backdropClassName={`project-language-backdrop is-${theme}`}>
    <label className="project-language-search"><Search aria-hidden="true" /><span className="sr-only">Search compilers</span><input data-autofocus aria-label="Search compilers" placeholder="Search compilers" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <div className="project-language-options" role="radiogroup" aria-label="Project compiler languages">{languages.map((language) => <button type="button" role="radio" aria-checked={language.id === activeLanguageId} className={language.id === activeLanguageId ? 'is-selected' : ''} onClick={() => { onSelect(language.id); onClose(); }} key={language.id}><span>{language.label}</span>{language.id === activeLanguageId ? <Check aria-hidden="true" /> : null}</button>)}</div>
  </Dialog>;
}
