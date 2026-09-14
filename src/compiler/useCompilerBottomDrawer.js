import { useCallback, useEffect, useState } from 'react';
import { useDragResize } from '../hooks/useDragResize';
import { LAYOUT_SIZE } from '../design-system/theme';

export const COMPILER_DRAWER_SIZE = Object.freeze({
  collapsed: 48,
  defaultExpanded: 300,
  minExpanded: 220,
  maxExpanded: 480,
  snapThreshold: 110,
});

export function shouldCollapseCompilerDrawer(height) {
  return height < COMPILER_DRAWER_SIZE.snapThreshold;
}

export function useCompilerBottomDrawer({ collapsible }) {
  const min = collapsible ? COMPILER_DRAWER_SIZE.minExpanded : LAYOUT_SIZE.output.min;
  const max = collapsible ? COMPILER_DRAWER_SIZE.maxExpanded : LAYOUT_SIZE.output.max;
  const [collapsed, setCollapsed] = useState(collapsible);
  const handleDragEnd = useCallback((height) => {
    if (!collapsible) return;
    if (shouldCollapseCompilerDrawer(height)) {
      setCollapsed(true);
      return;
    }
    setCollapsed(false);
  }, [collapsible]);
  const resize = useDragResize({
    initialValue: collapsible ? COMPILER_DRAWER_SIZE.defaultExpanded : LAYOUT_SIZE.output.initialValue,
    min: collapsible ? 0 : min,
    max,
    direction: -1,
    axis: 'y',
    onDragEnd: handleDragEnd,
  });
  const { setValue, value } = resize;
  const expand = useCallback(() => {
    if (!collapsible) return;
    if (value < COMPILER_DRAWER_SIZE.minExpanded) {
      setValue(COMPILER_DRAWER_SIZE.defaultExpanded);
    }
    setCollapsed(false);
  }, [collapsible, setValue, value]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    return () => window.cancelAnimationFrame(frame);
  }, [collapsed, value]);

  return {
    ...resize,
    collapsed,
    expand,
    min,
    max,
    renderedHeight: collapsed
      ? COMPILER_DRAWER_SIZE.collapsed
      : Math.max(resize.value, COMPILER_DRAWER_SIZE.minExpanded),
  };
}
