import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { requestAuthentication } from './publicAuthNavigation';

const links = [['/library', 'Courses'], ['/practice', 'Practice'], ['/projects', 'Project']];

const compilerLanguages = Object.freeze([
  ['python', 'Python', 'python'], ['java', 'Java', 'java'], ['javascript', 'JavaScript', 'javascript'],
  ['typescript', 'TypeScript', 'typescript'], ['html-css', 'HTML/CSS', 'html-css'], ['react', 'React', 'react'],
  ['sql', 'SQL', 'sql'], ['mysql', 'MySQL', 'mysql'], ['c', 'C', 'c'], ['cpp', 'C++', 'cpp'],
  ['php', 'PHP', 'php'], ['r', 'R', 'r'], ['csharp', 'C#', 'csharp'],
  ['visualbasic', 'Visual Basic', 'visual-basic'], ['assembly', 'Assembly', 'assembly'], ['go', 'Go', 'go'], ['rust', 'Rust', 'rust'],
]);

const compilerIcons = Object.freeze({
  python: '/assets/languages/python.svg', java: '/assets/languages/java.svg', javascript: '/assets/languages/javascript.svg',
  typescript: '/assets/languages/typescript.svg', go: '/assets/languages/go.svg', cpp: '/assets/languages/cplusplus.svg',
  rust: '/assets/languages/rust.svg', 'html-css': '/assets/languages/html5.svg', sql: '/assets/languages/sql.svg', csharp: '/assets/languages/csharp.svg',
});

function languageMonogram(id, label) {
  if (id === 'visualbasic') return 'VB';
  if (id === 'assembly') return 'ASM';
  return label.replace(/[^A-Za-z+#]/g, '').slice(0, 3);
}

export function PublicHeader({ activePath = window.location.pathname }) {
  const [open, setOpen] = useState(false);
  const [compilerOpen, setCompilerOpen] = useState(false);
  const compilerMenuRef = useRef(null);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!compilerMenuRef.current?.contains(event.target)) setCompilerOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setCompilerOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const closeNavigation = () => {
    setCompilerOpen(false);
    setOpen(false);
  };

  return <header className="marketing-header">
    <a className="marketing-brand" href="/" aria-label="Y Coders home"><img src="/ycoders-mark.svg" alt="" /><strong>Y CODERS</strong></a>
    <button className="marketing-menu-button" type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="marketing-navigation" onClick={() => setOpen((value) => !value)}>{open ? <X /> : <Menu />}</button>
    <div className={open ? 'marketing-navigation is-open' : 'marketing-navigation'} id="marketing-navigation">
      <nav aria-label="Public navigation">
        {links.map(([href, label]) => <a className="public-nav-link" href={href} aria-current={activePath === href ? 'page' : undefined} key={href}>{label}</a>)}
        <div className="online-compilers-menu" ref={compilerMenuRef}>
          <button className="online-compilers-trigger" type="button" aria-expanded={compilerOpen} aria-controls="online-compilers-panel" onClick={() => setCompilerOpen((value) => !value)}>Online Compilers <ChevronDown aria-hidden="true" /></button>
          <div className={compilerOpen ? 'online-compilers-panel is-open' : 'online-compilers-panel'} id="online-compilers-panel" aria-label="Online compilers" hidden={!compilerOpen}>
            {compilerLanguages.map(([id, label, slug]) => <a className="public-nav-link online-compiler-link" href={`https://compiler.ycoders.com/${slug}`} onClick={closeNavigation} key={id}>
              <span className="online-compiler-icon" aria-hidden="true">{compilerIcons[id] ? <img src={compilerIcons[id]} alt="" /> : <b>{languageMonogram(id, label)}</b>}</span>
              <span>{label}</span>
            </a>)}
          </div>
        </div>
      </nav>
      <div className="marketing-auth-actions"><button type="button" onClick={() => requestAuthentication(activePath, 'login')}>Login</button><button className="button button--primary" type="button" onClick={() => requestAuthentication(activePath, 'signup')}>Sign Up</button></div>
    </div>
  </header>;
}
