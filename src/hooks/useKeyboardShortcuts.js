import { useEffect } from 'react';

export function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      const element = event.target;
      const isTyping = element instanceof HTMLElement
        && (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName));

      if (isTyping && event.key !== 'Escape') return;

      const shortcut = shortcuts.find((item) =>
        item.key.toLowerCase() === event.key.toLowerCase()
        && Boolean(item.ctrlOrMeta) === (event.ctrlKey || event.metaKey)
        && Boolean(item.alt) === event.altKey,
      );

      if (!shortcut) return;
      event.preventDefault();
      shortcut.action();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
