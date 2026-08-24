import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const dialogStack = [];

export function Dialog({ open, title, titleHidden = false, description, role = 'dialog', onClose, children, className = '', backdropClassName = '' }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const priorFocus = document.activeElement;
    const dialog = dialogRef.current;
    const root = document.getElementById('root');
    dialogStack.push(dialog);
    if (root) root.inert = true;
    requestAnimationFrame(() => dialog?.querySelector('[data-autofocus], button:not([disabled])')?.focus());
    const onKeyDown = (event) => {
      if (dialogStack.at(-1) !== dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll(focusableSelector)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = dialogStack.lastIndexOf(dialog);
      if (index >= 0) dialogStack.splice(index, 1);
      if (root && dialogStack.length === 0) root.inert = false;
      if (priorFocus instanceof HTMLElement) priorFocus.focus();
    };
  }, [onClose, open]);

  if (!open) return null;
  return createPortal(
    <div className={`dialog-backdrop ${backdropClassName}`.trim()} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section ref={dialogRef} className={`dialog-surface ${className}`.trim()} role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
        <h2 id={titleId} className={titleHidden ? 'visually-hidden' : undefined}>{title}</h2>
        {description ? <p id={descriptionId}>{description}</p> : null}
        {children}
      </section>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = false, onConfirm, onCancel }) {
  return (
    <Dialog open={open} title={title} description={description} role="alertdialog" onClose={onCancel} className="confirm-dialog">
      <div className="confirm-dialog-actions">
        <button className="button button--secondary" type="button" onClick={onCancel} data-autofocus>{cancelLabel}</button>
        <button className={`button ${destructive ? 'button--danger' : 'button--primary'}`} type="button" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Dialog>
  );
}
