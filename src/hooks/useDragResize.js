import { useCallback, useEffect, useRef, useState } from 'react';
import { LAYOUT_SIZE } from '../design-system/theme';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function useDragResize({
  initialValue,
  min,
  max,
  direction = 1,
  axis = 'x',
  storageKey,
  onDragEnd,
}) {
  const [value, setValue] = useState(() => {
    if (!storageKey) return initialValue;
    const storedValue = Number.parseFloat(window.localStorage.getItem(storageKey));
    return Number.isFinite(storedValue) ? clamp(storedValue, min, max) : initialValue;
  });
  const dragState = useRef(null);
  const valueRef = useRef(value);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => { valueRef.current = value; }, [value]);

  useEffect(() => {
    setValue((current) => clamp(current, min, max));
  }, [max, min]);

  useEffect(() => {
    if (storageKey) window.localStorage.setItem(storageKey, String(value));
  }, [storageKey, value]);

  const stopDragging = useCallback(() => {
    if (dragState.current) {
      onDragEnd?.(valueRef.current);
      try {
        dragState.current.captureTarget?.releasePointerCapture?.(dragState.current.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
    }
    dragState.current = null;
    setIsDragging(false);
    document.body.classList.remove('is-resizing');
  }, [onDragEnd]);

  const continueDragging = useCallback((event) => {
    if (!dragState.current || event.pointerId !== dragState.current.pointerId) return;
    const pointerPosition = axis === 'x' ? event.clientX : event.clientY;
    const delta = (pointerPosition - dragState.current.pointerStart) * direction;
    const nextValue = clamp(dragState.current.valueStart + delta, min, max);
    valueRef.current = nextValue;
    setValue(nextValue);
  }, [axis, direction, max, min]);

  useEffect(() => {
    if (!isDragging) return undefined;
    window.addEventListener('pointermove', continueDragging);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
    return () => {
      window.removeEventListener('pointermove', continueDragging);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [continueDragging, isDragging, stopDragging]);

  const startDragging = useCallback((event) => {
    event.preventDefault();
    dragState.current = {
      pointerId: event.pointerId,
      captureTarget: event.currentTarget,
      pointerStart: axis === 'x' ? event.clientX : event.clientY,
      valueStart: value,
    };
    document.body.classList.add('is-resizing');
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [axis, value]);

  const handleKeyDown = useCallback((event) => {
    const decreaseKey = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
    const increaseKey = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
    if (![decreaseKey, increaseKey].includes(event.key)) return;
    event.preventDefault();
    const keyboardDirection = event.key === increaseKey ? 1 : -1;
    setValue((current) => {
      const nextValue = clamp(current + keyboardDirection * LAYOUT_SIZE.resizeStep * direction, min, max);
      valueRef.current = nextValue;
      return nextValue;
    });
  }, [axis, direction, max, min]);

  useEffect(() => () => document.body.classList.remove('is-resizing'), []);

  return { value, setValue, startDragging, continueDragging, stopDragging, handleKeyDown };
}
