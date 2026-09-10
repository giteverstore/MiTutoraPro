import { useEffect, useRef, useState } from 'react';
import { Bot, Code2 } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';

const NARROW_BREAKPOINT_REM = 44;
const VIEWS = ['editor', 'tutor'];

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '');
}

export function CompilerWorkspace({ editor, tutor, instanceId }) {
  const workspaceRef = useRef(null);
  const tabRefs = useRef({});
  const [isNarrow, setIsNarrow] = useState(false);
  const [activeView, setActiveView] = useState('editor');
  const idBase = `compiler-workspace-${safeId(instanceId)}`;

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return undefined;

    const updateMode = (width) => {
      if (!Number.isFinite(width) || width <= 0) return;
      const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      setIsNarrow(width <= NARROW_BREAKPOINT_REM * rootFontSize);
    };
    const updateFromElement = () => updateMode(workspace.getBoundingClientRect().width);

    updateFromElement();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateFromElement);
      return () => window.removeEventListener('resize', updateFromElement);
    }

    const observer = new ResizeObserver(([entry]) => {
      updateMode(entry?.contentRect?.width ?? workspace.getBoundingClientRect().width);
    });
    observer.observe(workspace);
    return () => observer.disconnect();
  }, []);

  const selectView = (view, { focus = false } = {}) => {
    setActiveView(view);
    if (focus) tabRefs.current[view]?.focus();
  };

  const handleTabKeyDown = (event) => {
    const currentIndex = VIEWS.indexOf(activeView);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % VIEWS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + VIEWS.length) % VIEWS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = VIEWS.length - 1;
    else return;
    event.preventDefault();
    selectView(VIEWS[nextIndex], { focus: true });
  };

  const panels = {
    editor: { label: 'Editor', icon: Code2, content: editor },
    tutor: { label: 'AI Tutor', icon: Bot, content: tutor },
  };

  return (
    <div
      className={`compiler-workspace${isNarrow ? ' is-narrow' : ' is-wide'}`}
      ref={workspaceRef}
      data-workspace-mode={isNarrow ? 'narrow' : 'wide'}
    >
      <div className="compiler-workspace-switcher" role="tablist" aria-label="Compiler workspace" hidden={!isNarrow}>
        {VIEWS.map((view) => {
          const { label, icon: Icon } = panels[view];
          const isActive = activeView === view;
          return (
            <button
              key={view}
              className={isActive ? 'is-active' : ''}
              id={`${idBase}-${view}-tab`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${idBase}-${view}-panel`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectView(view)}
              onKeyDown={handleTabKeyDown}
              ref={(node) => { tabRefs.current[view] = node; }}
            >
              <Icon size={ICON_SIZE.sm} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      <div className="compiler-main-row">
        {VIEWS.map((view) => {
          const isActive = activeView === view;
          return (
            <div
              className={`compiler-main-view compiler-${view}-view${isActive ? ' is-active' : ''}`}
              id={`${idBase}-${view}-panel`}
              role={isNarrow ? 'tabpanel' : 'region'}
              aria-labelledby={isNarrow ? `${idBase}-${view}-tab` : undefined}
              aria-label={isNarrow ? undefined : panels[view].label}
              hidden={isNarrow && !isActive}
              key={view}
            >
              {panels[view].content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
