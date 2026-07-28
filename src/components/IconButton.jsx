export function IconButton({ label, children, className = '', ...props }) {
  return (
    <button
      className={`button button--icon icon-button ${className}`.trim()}
      type="button"
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
