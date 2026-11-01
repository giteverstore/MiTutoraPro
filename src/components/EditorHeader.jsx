import { Minus, Play, RotateCcw } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { IconButton } from './IconButton';
import { getSupportedCompilerLanguage } from '../compiler/languages/supportedLanguages';
import submitIcon from '../../Logo/upload.png';

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
  runDisabled = false,
  onSubmit,
  submitStatus = 'idle',
  submitDisabled = false,
}) {
  const isSelectable = Boolean(languageSelector);
  const state = isRunning ? 'running' : executionStatus;
  const stateLabel = {
    idle: 'Ready',
    running: 'Running',
    success: 'Completed',
    error: 'Failed',
  }[state] ?? 'Ready';
  const languageLabel = getSupportedCompilerLanguage(data.language)?.label
    ?? `${data.language.charAt(0).toUpperCase()}${data.language.slice(1)}`;

  return (
    <header className={`ide-header ${isSelectable ? 'is-selectable' : 'is-locked'}`}>
      {isSelectable ? languageSelector : <strong className="compiler-language-label">{languageLabel}</strong>}
      <span className="sr-only" role="status" aria-live="polite">{stateLabel}</span>
      <div className="ide-header-actions">
        <IconButton label="Reset code" onClick={onReset}>
          <RotateCcw size={ICON_SIZE.md} aria-hidden="true" />
        </IconButton>
        <IconButton className="compiler-run-button" label="Run code" onClick={onRun} disabled={isRunning || submitStatus !== 'idle' || runDisabled}>
          <Play size={ICON_SIZE.sm} fill="currentColor" aria-hidden="true" />
        </IconButton>
        {onSubmit ? (
          <button
            className="button compiler-submit-button"
            type="button"
            aria-label="Submit"
            title="Submit"
            onClick={onSubmit}
            disabled={isRunning || submitDisabled || submitStatus !== 'idle'}
          >
            <img className="compiler-submit-icon" src={submitIcon} alt="" aria-hidden="true" />
            {{ running: 'Running…', checking: 'Checking…', saving: 'Saving…' }[submitStatus] ?? 'Submit'}
          </button>
        ) : null}
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
