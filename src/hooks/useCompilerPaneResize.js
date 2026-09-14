import { useEffect, useRef, useState } from 'react';
import { LAYOUT_SIZE } from '../design-system/theme';
import { useDragResize } from './useDragResize';

export function useCompilerPaneResize({ reservedWidth = 0 } = {}) {
  const workspaceRef = useRef(null);
  const [workspaceWidth, setWorkspaceWidth] = useState(() => window.innerWidth);
  const max = Math.max(
    LAYOUT_SIZE.compiler.min,
    Math.floor(workspaceWidth - reservedWidth - LAYOUT_SIZE.lesson.min),
  );
  const resize = useDragResize({
    ...LAYOUT_SIZE.compiler,
    max,
    direction: -1,
    storageKey: 'mi-tutora:compiler-width',
  });

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return undefined;
    const updateWidth = () => setWorkspaceWidth(workspace.getBoundingClientRect().width);
    const observer = new ResizeObserver(updateWidth);
    observer.observe(workspace);
    updateWidth();
    return () => observer.disconnect();
  }, []);

  return { workspaceRef, max, ...resize };
}
