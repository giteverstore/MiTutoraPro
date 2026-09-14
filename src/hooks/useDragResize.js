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

  useEffect(() => { valueRef.current = value; }, [value]);

  useEffect(() => {
    setValue((current) => clamp(current, min, max));
  }, [max, min]);

  useEffect(() => {
    if (storageKey) window.localStorage.setItem(storageKey, String(value));
  }, [storageKey, value]);

  const stopDragging = useCallback(() => {
    if (dragState.current) onDragEnd?.(valueRef.current);
    dragState.current = null;
    document.body.classList.remove('is-resizing');
  }, [onDragEnd]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!dragState.current) return;
      const pointerPosition = axis === 'x' ? event.clientX : event.clientY;
      const delta = (pointerPosition - dragState.current.pointerStart) * direction;
      const nextValue = clamp(dragState.current.valueStart + delta, min, max);
      valueRef.current = nextValue;
      setValue(nextValue);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [axis, direction, max, min, stopDragging]);

  const startDragging = useCallback((event) => {
    event.preventDefault();
    dragState.current = {
      pointerStart: axis === 'x' ? event.clientX : event.clientY,
      valueStart: value,
    };
    document.body.classList.add('is-resizing');
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

  return { value, setValue, startDragging, handleKeyDown };
}
