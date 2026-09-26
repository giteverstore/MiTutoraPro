import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { sortCompilerLanguageOptions } from '../compiler/languages/supportedLanguages.js';

export function CompilerLanguageSelector({ value, options, disabled = false, onChange, label, ariaLabel = 'Compiler language' }) {
  const [open, setOpen] = useState(false);
  const selectorRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  const [menuStyle, setMenuStyle] = useState(null);
  const availableOptions = useMemo(() => sortCompilerLanguageOptions(options), [options]);
  const selected = availableOptions.find((option) => option.id === value);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!selectorRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const positionMenu = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(450, viewportWidth - 32);
      let top = trigger.bottom + 8;
      let maxHeight = Math.min(300, viewportHeight - top - 16);
      if (maxHeight < 180 && trigger.top > viewportHeight - trigger.bottom) {
        maxHeight = Math.min(300, trigger.top - 24);
        top = Math.max(16, trigger.top - maxHeight - 8);
      }
      setMenuStyle({ left: Math.max(16, Math.min(trigger.left, viewportWidth - width - 16)), top, width, maxHeight: Math.max(160, maxHeight) });
    };
    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      const selectedItem = menuRef.current?.querySelector('[aria-checked="true"]');
      (selectedItem ?? menuRef.current?.querySelector('[role="menuitemradio"]'))?.focus();
    });
  }, [open]);

  const closeAndFocusTrigger = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleMenuKeyDown = (event) => {
    const items = [...menuRef.current.querySelectorAll('[role="menuitemradio"]')];
    const currentIndex = items.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndFocusTrigger();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      items[(currentIndex + 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items.at(-1)?.focus();
    }
  };

  return (
    <div ref={selectorRef} className={`compiler-language-selector ${label ? 'has-visible-label' : ''}`}>
      <span className={label ? 'compiler-language-selector-label' : 'sr-only'} id={`${menuId}-label`}>{label ?? ariaLabel}</span>
      <button
        ref={triggerRef}
        type="button"
        className="compiler-language-trigger"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{selected?.label ?? 'Select language'}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && menuStyle ? createPortal((
        <div ref={menuRef} id={menuId} className="compiler-language-menu" style={menuStyle} role="menu" aria-labelledby={`${menuId}-label`} onKeyDown={handleMenuKeyDown}>
          <div className="compiler-language-list">
            {availableOptions.map((option) => {
              const isSelected = option.id === value;
              return (
                <button type="button" role="menuitemradio" aria-checked={isSelected} className={isSelected ? 'is-selected' : undefined} key={option.id} onClick={() => { onChange(option.id); setOpen(false); }}>
                  <span>{option.label}</span>
                  <Check size={14} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      ), document.body) : null}
    </div>
  );
}
