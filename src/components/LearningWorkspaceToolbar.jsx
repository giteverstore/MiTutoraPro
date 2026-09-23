import { Bot, Code2, BookOpen } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';

export function LearningWorkspaceToolbar({ activeView, onViewChange, compilerMinimized, onRestoreCompiler, primaryView = 'course', primaryLabel = 'Course', panelPrefix = 'learning', aiEnabled = true }) {
  const tabs = [
    { id: primaryView, label: primaryLabel, icon: BookOpen },
    ...(aiEnabled ? [{ id: 'ai', label: 'AI', accessibleLabel: 'AI Tutor', icon: Bot }] : []),
  ];
  if (!aiEnabled && !compilerMinimized) return null;
  return (
    <div className="learning-workspace-toolbar">
      {aiEnabled ? <div className="learning-workspace-tabs" role="tablist" aria-label="Learning workspace">
        {tabs.map(({ id, label, accessibleLabel, icon: Icon }) => (
          <button
            className={activeView === id ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-label={accessibleLabel ?? label}
            aria-selected={activeView === id}
            aria-controls={`${panelPrefix}-${id}-panel`}
            key={id}
            onClick={() => onViewChange(id)}
          >
            <Icon size={ICON_SIZE.sm} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div> : null}
      {compilerMinimized ? (
        <button className="learning-compiler-launcher" type="button" onClick={onRestoreCompiler}>
          <span className="learning-compiler-launcher-icon" aria-hidden="true">
            <Code2 size={ICON_SIZE.md} />
          </span>
          Compiler
        </button>
      ) : null}
    </div>
  );
}
