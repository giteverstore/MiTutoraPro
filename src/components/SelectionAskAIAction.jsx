import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

export function useSelectionAskAI({ sourceType, onAskAI }) {
  const containerRef = useRef(null);
  const [selection, setSelection] = useState(null);

  const captureSelection = () => {
    const current = window.getSelection();
    const text = current?.toString() ?? '';
    const container = containerRef.current;
    if (!text.trim() || !current?.rangeCount || !container?.contains(current.anchorNode) || !container.contains(current.focusNode)) {
      setSelection(null);
      return;
    }
    const bounds = current.getRangeAt(0).getBoundingClientRect();
    setSelection({ text, sourceType, bounds });
  };

  useEffect(() => {
    const dismissOnSelectionClear = () => {
      if (!window.getSelection()?.toString().trim()) setSelection(null);
    };
    const dismissOnEscape = (event) => { if (event.key === 'Escape') setSelection(null); };
    const dismissOnPointerDown = (event) => {
      if (!event.target.closest('.learning-selection-ai-action') && !containerRef.current?.contains(event.target)) setSelection(null);
    };
    document.addEventListener('selectionchange', dismissOnSelectionClear);
    document.addEventListener('keydown', dismissOnEscape);
    document.addEventListener('pointerdown', dismissOnPointerDown);
    return () => {
      document.removeEventListener('selectionchange', dismissOnSelectionClear);
      document.removeEventListener('keydown', dismissOnEscape);
      document.removeEventListener('pointerdown', dismissOnPointerDown);
    };
  }, []);

  const action = selection ? (
    <button
      className="learning-selection-ai-action"
      type="button"
      style={{
        left: `${clamp(selection.bounds.left, 8, window.innerWidth - 112)}px`,
        top: `${clamp(selection.bounds.bottom + 8, 8, window.innerHeight - 44)}px`,
      }}
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => { onAskAI?.({ sourceType: selection.sourceType, text: selection.text }); setSelection(null); }}
    >
      <Sparkles aria-hidden="true" /> Ask AI
    </button>
  ) : null;

  return { containerRef, captureSelection, action };
}
