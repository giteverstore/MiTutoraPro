export function SettingRow({ title, description, children, danger = false }) {
  return (
    <div className={`setting-row ${danger ? 'is-danger' : ''}`}>
      <div><strong>{title}</strong>{description ? <p>{description}</p> : null}</div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

export function SelectSetting({ value, onChange, label, children }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
      {children}
    </select>
  );
}

export function SwitchSetting({ checked, onChange, label }) {
  return (
    <button className={`settings-switch ${checked ? 'is-on' : ''}`} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}>
      <span aria-hidden="true" />
    </button>
  );
}
