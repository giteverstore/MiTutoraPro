import { Minus, Play, RotateCcw } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { IconButton } from './IconButton';

export function EditorHeader({
  data,
  isRunning,
  executionStatus,
  verificationStatus,
  onRun,
  onReset,
  languageSelector,
  isCompilerMinimized = false,
  onToggleCompiler,
}) {
  const isSelectable = Boolean(languageSelector);
  const state = isRunning ? 'running' : executionStatus;
  const stateLabel = {
    idle: 'Ready',
    running: 'Running',
    success: 'Completed',
    error: 'Failed',
  }[state] ?? 'Ready';
  const languageLabel = data.language.charAt(0).toUpperCase() + data.language.slice(1);

  return (
    <header className={`ide-header ${isSelectable ? 'is-selectable' : 'is-locked'}`}>
      {isSelectable ? languageSelector : <strong className="compiler-language-label">{languageLabel}</strong>}
      <span className="sr-only" role="status" aria-live="polite">{stateLabel}</span>
      <div className="ide-header-actions">
        <IconButton label="Reset code" onClick={onReset}>
          <RotateCcw size={ICON_SIZE.md} aria-hidden="true" />
        </IconButton>
        <IconButton
          className="compiler-run-button"
          label="Run code"
          onClick={onRun}
          disabled={isRunning}
        >
          <Play size={ICON_SIZE.sm} fill="currentColor" aria-hidden="true" />
        </IconButton>
        {onToggleCompiler && !isCompilerMinimized ? (
          <IconButton
            className="compiler-collapse-button"
            label="Minimize compiler"
            onClick={onToggleCompiler}
          >
            <Minus size={ICON_SIZE.md} aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>
    </header>
  );
}
