import { useEffect, useId, useRef } from 'react';
import { AlertTriangle, CircleHelp, LockKeyhole, RefreshCcw, WifiOff } from 'lucide-react';
import '../styles/components/error-state.css';

const ICONS = {
  failure: AlertTriangle,
  unavailable: CircleHelp,
  'not-found': CircleHelp,
  permission: LockKeyhole,
  network: WifiOff,
};

export function ErrorState({
  title,
  description,
  referenceId,
  primaryAction,
  secondaryAction,
  variant = 'full',
  kind = 'failure',
  alert = false,
  focusOnMount = false,
  className = '',
  ...sectionProps
}) {
  const headingId = useId();
  const sectionRef = useRef(null);
  const Icon = ICONS[kind] ?? AlertTriangle;
  const Heading = variant === 'full' ? 'h1' : 'h2';

  useEffect(() => { if (focusOnMount) sectionRef.current?.focus(); }, [focusOnMount]);

  return (
    <section
      className={`error-state error-state--${variant} error-state--${kind} ${className}`.trim()}
      aria-labelledby={headingId}
      role={alert ? 'alert' : undefined}
      tabIndex={focusOnMount ? -1 : undefined}
      ref={sectionRef}
      {...sectionProps}
    >
      <div className="error-state__content">
        <span className="error-state__icon" aria-hidden="true"><Icon /></span>
        <Heading id={headingId}>{title}</Heading>
        {description ? <p className="error-state__description">{description}</p> : null}
        {referenceId ? <p className="error-state__reference">Reference: {referenceId}</p> : null}
        {primaryAction || secondaryAction ? <div className="error-state__actions">
          {primaryAction?.href ? <a className="button button--primary" href={primaryAction.href}>{primaryAction.label}</a> : primaryAction ? <button className="button button--primary" type="button" onClick={primaryAction.onClick}>{primaryAction.icon === 'retry' ? <RefreshCcw aria-hidden="true" /> : null}{primaryAction.label}</button> : null}
          {secondaryAction ? <button className="button button--secondary" type="button" onClick={secondaryAction.onClick}>{secondaryAction.label}</button> : null}
        </div> : null}
      </div>
    </section>
  );
}
