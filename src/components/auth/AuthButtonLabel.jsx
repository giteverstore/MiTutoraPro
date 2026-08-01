import { LoaderCircle } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';

export function AuthButtonLabel({ loading, loadingLabel, children }) {
  if (!loading) return children;
  return (
    <>
      <LoaderCircle className="auth-button-spinner" size={ICON_SIZE.base} aria-hidden="true" />
      {loadingLabel}
    </>
  );
}
