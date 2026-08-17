import { Circle, FileCode2, Play, RotateCcw } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { IconButton } from './IconButton';

export function EditorHeader({
  data,
  isRunning,
  executionStatus,
  verificationStatus,
  onRun,
  onReset,
}) {
  const state = isRunning ? 'running' : executionStatus;
  const stateLabel = {
    idle: 'Ready',
    running: 'Running',
    success: 'Completed',
    error: 'Failed',
  }[state] ?? 'Ready';
  const stateTone = verificationStatus === 'mismatched' ? 'mismatch' : state;

  return (
    <header className="ide-header">
      <div className="ide-file-context">
        <span className="ide-file-icon"><FileCode2 size={ICON_SIZE.md} aria-hidden="true" /></span>
        <span>
          <strong>{data.editor.fileName}</strong>
          <small>{data.language}</small>
        </span>
      </div>
      <span className={`ide-execution-state is-${stateTone}`} role="status">
        <Circle size={ICON_SIZE.status} fill="currentColor" aria-hidden="true" />
        {stateLabel}
      </span>
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
      </div>
    </header>
  );
}
