import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Dialog } from '../components/Dialog';
import {
  dismissMobileLoginNotice,
  hasPendingMobileLoginNotice,
  isMobilePhoneViewport,
  isMobileRestrictedPath,
  useMobilePhoneViewport,
} from './mobileAccess';
import '../styles/components/mobile-access.css';

export function MobileAccessDialog({ title, description, onClose, continueLabel }) {
  return (
    <Dialog
      open
      title={title}
      description={description}
      onClose={onClose}
      className="mobile-access-dialog"
      backdropClassName="mobile-access-dialog-backdrop"
    >
      <button className="mobile-access-dialog-close" type="button" aria-label="Close" onClick={onClose} data-autofocus>
        <X aria-hidden="true" size={20} />
      </button>
      {continueLabel ? (
        <div className="mobile-access-dialog-actions">
          <button className="button button--primary" type="button" onClick={onClose}>{continueLabel}</button>
        </div>
      ) : null}
    </Dialog>
  );
}

export function MobileLoginNotice() {
  const isMobile = useMobilePhoneViewport({ snapshot: true });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hasPendingMobileLoginNotice()) return;
    if (!isMobile || isMobileRestrictedPath(window.location.pathname)) {
      dismissMobileLoginNotice();
      return;
    }
    setOpen(true);
  }, [isMobile]);

  if (!open) return null;
  const close = () => {
    dismissMobileLoginNotice();
    setOpen(false);
  };
  return (
    <MobileAccessDialog
      title="Better on a laptop or PC"
      description="Y Coders works best on a larger screen. Some learning and project tools are designed for desktop use. You can continue on mobile, but for the best experience we recommend using a laptop or PC."
      continueLabel="Continue anyway"
      onClose={close}
    />
  );
}

export function MobileWorkspaceGuard({ children, kind, onClose, restricted = true }) {
  const [blocked] = useState(isMobilePhoneViewport);
  if (!restricted || !blocked) return children;
  const course = kind === 'course';
  return (
    <div className="mobile-workspace-guard" data-mobile-workspace-guard={kind}>
      <MobileAccessDialog
        title={course ? 'Open this course on a laptop or PC' : 'Open this project on a laptop or PC'}
        description={course
          ? 'The interactive course workspace is designed for larger screens and is not available on mobile.'
          : 'The project workspace needs a larger screen for the editor, explorer, terminal, and guide.'}
        onClose={onClose}
      />
    </div>
  );
}
