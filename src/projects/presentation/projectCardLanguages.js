// These are existing learner language icons, keyed by canonical Project language ID.
const languageIcons = Object.freeze({
  python: { label: 'Python', icon: '/assets/languages/python.svg' },
  java: { label: 'Java', icon: '/assets/languages/java.svg' },
  cpp: { label: 'C++', icon: '/assets/languages/cplusplus.svg' },
  javascript: { label: 'JavaScript', icon: '/assets/languages/javascript.svg' },
  typescript: { label: 'TypeScript', icon: '/assets/languages/typescript.svg' },
  sql: { label: 'SQL', icon: '/assets/languages/sql.svg' },
  go: { label: 'Go', icon: '/assets/languages/go.svg' },
  rust: { label: 'Rust', icon: '/assets/languages/rust.svg' },
  csharp: { label: 'C#', icon: '/assets/languages/csharp.svg' },
  kotlin: { label: 'Kotlin', icon: '/assets/languages/kotlin.svg' },
  swift: { label: 'Swift', icon: '/assets/languages/swift.svg' },
  dart: { label: 'Dart', icon: '/assets/languages/dart.svg' },
});

export function projectCardLanguages(supportedLanguages = []) {
  const mapped = supportedLanguages.flatMap((id) => languageIcons[id] ? [{ id, ...languageIcons[id] }] : []);
  const overflow = mapped.length > 7 ? mapped.length - 6 : 0;
  return { icons: overflow ? mapped.slice(0, 6) : mapped, overflow };
}

export function unmappedProjectCardLanguages(supportedLanguages = []) {
  return supportedLanguages.filter((id) => !languageIcons[id]);
}
