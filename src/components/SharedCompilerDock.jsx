import { CompilerPanel } from './CompilerPanel';
import { ResizeHandle } from './ResizeHandle';
import { DomainErrorBoundary } from '../errors/ErrorBoundary';
import { LAYOUT_SIZE } from '../design-system/theme';

export function SharedCompilerDock({
  ariaLabel,
  className = '',
  compilerStatus = 'ready',
  minimized = false,
  panelRef,
  compiler,
  panelProps = {},
  unavailableContent = null,
  errorBoundary = {},
  resize,
}) {
  return <>
    <aside
      className={`desktop-compiler compiler-dock shared-compiler-dock coding-workspace__compiler ${className} ${minimized ? 'is-minimized' : 'is-expanded compiler-enter'} is-${compilerStatus}`}
      aria-label={ariaLabel}
    >
      <div className="compiler-dock-body">
        {unavailableContent ?? (
          <DomainErrorBoundary
            name={errorBoundary.name ?? 'shared-compiler'}
            title={errorBoundary.title ?? 'The code workspace could not be displayed.'}
            description={errorBoundary.description ?? 'Retry the compiler to continue.'}
            resetKeys={errorBoundary.resetKeys ?? [compiler?.id]}
            compact
          >
            <CompilerPanel ref={panelRef} compiler={compiler} {...panelProps} />
          </DomainErrorBoundary>
        )}
      </div>
    </aside>
    {!minimized && resize ? (
      <ResizeHandle
        className="compiler-resize-handle"
        label={resize.label}
        min={resize.min ?? LAYOUT_SIZE.compiler.min}
        max={resize.max}
        value={resize.value}
        onPointerDown={resize.onPointerDown}
        onKeyDown={resize.onKeyDown}
      />
    ) : null}
  </>;
}
