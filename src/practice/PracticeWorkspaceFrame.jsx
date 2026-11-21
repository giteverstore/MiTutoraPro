export function PracticeWorkspaceFrame({ children, minimized = false, workspaceRef, compilerWidth, lessonPaneMin, className = '' }) {
  return <div className={`practice-immersive-workspace coding-workspace ${minimized ? 'is-compiler-minimized' : 'has-compiler'} ${className}`.trim()} data-immersive-coding-workspace="practice" ref={workspaceRef} style={{ '--compiler-width': `${compilerWidth}px`, '--lesson-pane-min': `${lessonPaneMin}px` }}>{children}</div>;
}
