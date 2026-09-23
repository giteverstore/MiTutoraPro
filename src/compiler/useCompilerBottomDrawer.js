import { useCallback, useEffect, useRef, useState } from 'react';
import { useDragResize } from '../hooks/useDragResize';
import { LAYOUT_SIZE } from '../design-system/theme';

export const COMPILER_DRAWER_SIZE = Object.freeze({
  collapsed: 48,
  defaultExpanded: 300,
  minExpanded: 140,
  maxExpanded: 480,
  minimumEditor: 160,
  fixedChrome: 56,
});

export function useCompilerBottomDrawer({ collapsible, containerRef }) {
  const min = collapsible ? COMPILER_DRAWER_SIZE.minExpanded : LAYOUT_SIZE.output.min;
  const configuredMax = collapsible ? COMPILER_DRAWER_SIZE.maxExpanded : LAYOUT_SIZE.output.max;
  const [max, setMax] = useState(configuredMax);
  const [collapsed, setCollapsed] = useState(collapsible);
  const previousExpandedHeightRef = useRef(COMPILER_DRAWER_SIZE.defaultExpanded);
  const resize = useDragResize({
    initialValue: collapsible ? COMPILER_DRAWER_SIZE.defaultExpanded : LAYOUT_SIZE.output.initialValue,
    min,
    max,
    direction: -1,
    axis: 'y',
  });
  const { setValue, value } = resize;

  useEffect(() => {
    const container = containerRef?.current;
    if (!container || typeof ResizeObserver === 'undefined') return undefined;
    const updateMaximum = () => {
      const available = Math.floor(
        container.getBoundingClientRect().height
        - COMPILER_DRAWER_SIZE.fixedChrome
        - COMPILER_DRAWER_SIZE.minimumEditor,
      );
      setMax(Math.max(min, Math.min(configuredMax, available)));
    };
    updateMaximum();
    const observer = new ResizeObserver(updateMaximum);
    observer.observe(container);
    return () => observer.disconnect();
  }, [configuredMax, containerRef, min]);

  useEffect(() => {
    if (!collapsed) previousExpandedHeightRef.current = value;
  }, [collapsed, value]);

  const expand = useCallback(() => {
    if (!collapsible) return;
    setValue(Math.min(max, Math.max(min, previousExpandedHeightRef.current)));
    setCollapsed(false);
  }, [collapsible, max, min, setValue]);

  const collapse = useCallback(() => {
    if (!collapsible) return;
    previousExpandedHeightRef.current = value;
    setCollapsed(true);
  }, [collapsible, value]);

  const toggle = useCallback(() => {
    if (collapsed) expand();
    else collapse();
  }, [collapse, collapsed, expand]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    return () => window.cancelAnimationFrame(frame);
  }, [collapsed, value]);

  return {
    ...resize,
    collapsed,
    expand,
    collapse,
    toggle,
    min,
    max,
    renderedHeight: collapsed
      ? COMPILER_DRAWER_SIZE.collapsed
      : resize.value,
  };
}
