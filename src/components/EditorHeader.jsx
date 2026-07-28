import { Circle, Play, RotateCcw, TerminalSquare } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { IconButton } from './IconButton';

export function EditorHeader({ data, isRunning, onRun, onReset }) {
  return (
    <>
      <div className="compiler-header">
        <div>
          <span className="eyebrow">{data.eyebrow}</span>
          <h2><TerminalSquare size={ICON_SIZE.md} /> {data.title}</h2>
        </div>
        <span className="status-label"><Circle size={ICON_SIZE.status} fill="currentColor" /> {data.status}</span>
      </div>
      <div className="compiler-toolbar">
        <label className="input-control language-select">
          <span>{data.languageLabel}</span>
          <select aria-label={data.languageLabel} value={data.language} onChange={() => {}}>
            <option>{data.language}</option>
          </select>
        </label>
        <IconButton label={data.resetLabel} onClick={onReset}>
          <RotateCcw size={ICON_SIZE.md} />
        </IconButton>
        <button
          className="button button--primary run-button"
          type="button"
          title={`${data.runLabel} (${data.runShortcut})`}
          onClick={onRun}
          disabled={isRunning}
        >
          <Play size={ICON_SIZE.sm} fill="currentColor" />
          {isRunning ? data.runningLabel : data.runLabel}
        </button>
      </div>
    </>
  );
}
