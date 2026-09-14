export function CompilerLanguageSelector({ value, options, disabled = false, onChange }) {
  return (
    <label className="compiler-language-selector">
      <span className="sr-only">Compiler language</span>
      <select
        aria-label="Compiler language"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option
            key={option.id}
            value={option.id}
            disabled={!option.available}
            title={option.available ? undefined : `${option.label} support is not available for this question yet.`}
          >
            {option.label}{option.available ? '' : ' — unavailable'}
          </option>
        ))}
      </select>
    </label>
  );
}
