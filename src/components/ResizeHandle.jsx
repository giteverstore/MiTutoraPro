export function ResizeHandle({
  className = '',
  label,
  onPointerDown,
  onKeyDown,
  value,
  min,
  max,
  orientation = 'vertical',
}) {
  return (
    <div
      className={`resize-handle resize-handle-${orientation} ${className}`.trim()}
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex="0"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span />
    </div>
  );
}
