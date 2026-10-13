import { publicCompilerLanguages } from '../compiler/languages/supportedLanguages.js';
import { standaloneCompilerPath } from './standaloneCompilerRouting.js';
import { STANDALONE_LANGUAGE_ICONS, standaloneLanguageMonogram } from './standaloneLanguagePresentation.js';
import { useStandaloneCompilerPreferences } from './useStandaloneCompilerPreferences.js';
import { brandAssets } from '../branding/brandAssets.js';

export function StandaloneCompilerLanding({ onNavigate }) {
  const { resolvedTheme } = useStandaloneCompilerPreferences();
  return <main className="standalone-compiler-index" data-theme={resolvedTheme}>
    <div className="standalone-compiler-index__inner">
      <header className="standalone-compiler-index__hero">
        <img src={brandAssets.mark} alt="" width="486" height="513" />
        <h1>YCoders Online Compiler</h1>
        <p>Choose a language to start coding.</p>
      </header>
      <div className="standalone-compiler-index__grid" aria-label="Compiler languages">
        {publicCompilerLanguages.map((language) => <button className="standalone-compiler-index__language" type="button" onClick={() => onNavigate(standaloneCompilerPath(language))} key={language.id}>
          <span className="standalone-compiler-index__language-icon" aria-hidden="true">{STANDALONE_LANGUAGE_ICONS[language.id]
            ? <img src={STANDALONE_LANGUAGE_ICONS[language.id]} alt="" />
            : standaloneLanguageMonogram(language)}</span>
          <span>{language.label}</span>
        </button>)}
      </div>
    </div>
  </main>;
}
