export function DividerBlock({ label }) {
  return (
    <div className="content-section lesson-divider" role="separator">
      {label ? <span>{label}</span> : null}
    </div>
  );
}
