export function FormField({ label, hint, ...inputProps }) {
  const inputId = inputProps.id ?? inputProps.name;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <label className="form-field" htmlFor={inputId}>
      <span>{label}</span>
      <input
        className="input-control"
        id={inputId}
        aria-describedby={hintId}
        {...inputProps}
      />
      {hint ? <small id={hintId}>{hint}</small> : null}
    </label>
  );
}
