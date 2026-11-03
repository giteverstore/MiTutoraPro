import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import '../styles/components/learner-select.css';

const OPEN_EVENT = 'ycoders:learner-select-open';

export function LearnerSelect({ value, options, onChange, ariaLabel, className = '' }) {
  const reactId = useId().replaceAll(':', '');
  const listboxId = `learner-select-${reactId}-listbox`;
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selected = options[selectedIndex] ?? options[0];

  useEffect(() => {
    if (!open) setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  useEffect(() => {
    const closeOther = (event) => {
      if (event.detail !== listboxId) setOpen(false);
    };
    document.addEventListener(OPEN_EVENT, closeOther);
    return () => document.removeEventListener(OPEN_EVENT, closeOther);
  }, [listboxId]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  const optionIds = useMemo(
    () => options.map((_, index) => `${listboxId}-option-${index}`),
    [listboxId, options],
  );

  const show = () => {
    document.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: listboxId }));
    setActiveIndex(selectedIndex);
    setOpen(true);
  };
  const close = () => setOpen(false);
  const choose = (index) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setActiveIndex(index);
    setOpen(false);
    buttonRef.current?.focus();
  };
  const move = (direction) => {
    if (!options.length) return;
    if (!open) {
      document.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: listboxId }));
      setActiveIndex((selectedIndex + direction + options.length) % options.length);
      setOpen(true);
      return;
    }
    setActiveIndex((current) => (current + direction + options.length) % options.length);
  };
  const onKeyDown = (event) => {
    if (event.key === 'Tab') {
      close();
      return;
    }
    if (event.key === 'Escape') {
      if (open) event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      if (!open) return;
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(activeIndex);
      else show();
    }
  };

  return (
    <div className={`learner-select${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`} ref={rootRef}>
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open ? optionIds[activeIndex] : undefined}
        onClick={() => open ? close() : show()}
        onKeyDown={onKeyDown}
        ref={buttonRef}
      >
        <span>{selected?.label ?? ''}</span>
        <ChevronDown className={open ? 'is-open' : ''} aria-hidden="true" />
      </button>
      {open ? (
        <div className="learner-select-menu" id={listboxId} role="listbox" aria-label={`${ariaLabel} options`}>
          {options.map((option, index) => (
            <button
              id={optionIds[index]}
              className={index === activeIndex ? 'is-active' : ''}
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={-1}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
              key={option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
